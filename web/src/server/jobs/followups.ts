import type { CustomerProfileRepository } from "@/server/customerProfiles/repository";
import type {
  AuditEventRow,
  CustomerProfileRow,
  JsonValue,
  MessageRow,
  TaskRow
} from "@/server/db/schema";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import type { MessageRepository } from "@/server/intake/messages";
import type { TaskRepository } from "@/server/intake/tasks";

const DEFAULT_STALE_AFTER_HOURS = 24;
const STALE_PROFILE_STATUSES = new Set(["new", "contacted"]);
const AUTO_TEXT_PROVIDER_ID_PREFIX = "missed-call-auto-text:";

export type FollowUpSweepDependencies = {
  customerProfileRepository: CustomerProfileRepository;
  messageRepository: MessageRepository;
  taskRepository: TaskRepository;
  auditEventRepository: AuditEventRepository;
};

export type FollowUpSweepResult = {
  scanned: number;
  stale: number;
  created: number;
  skipped_existing_today: number;
  tasks: TaskRow[];
};

export function getFollowUpStaleHours(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.FOLLOW_UP_STALE_HOURS;
  if (!raw) {
    return DEFAULT_STALE_AFTER_HOURS;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STALE_AFTER_HOURS;
}

export async function sweepFollowUps(
  dependencies: FollowUpSweepDependencies,
  input: {
    businessId: string;
    staleAfterHours?: number;
    now?: Date;
  }
): Promise<FollowUpSweepResult> {
  const now = input.now ?? new Date();
  const staleAfterHours = input.staleAfterHours ?? DEFAULT_STALE_AFTER_HOURS;
  const cutoff = new Date(now.getTime() - staleAfterHours * 60 * 60 * 1000);
  const today = getUtcDayBounds(now);

  const [profiles, messages, tasks, auditEvents] = await Promise.all([
    dependencies.customerProfileRepository.list(),
    dependencies.messageRepository.list(),
    dependencies.taskRepository.list(),
    dependencies.auditEventRepository.list()
  ]);
  const candidates = profiles.filter(
    (profile) =>
      profile.business_id === input.businessId && STALE_PROFILE_STATUSES.has(profile.status)
  );
  const createdTasks: TaskRow[] = [];
  let stale = 0;
  let skippedExistingToday = 0;

  for (const profile of candidates) {
    if (
      !isProfileStale({
        profile,
        messages,
        tasks,
        auditEvents,
        cutoff
      })
    ) {
      continue;
    }

    stale += 1;

    if (hasFollowUpTaskForDay(tasks, profile, today)) {
      skippedExistingToday += 1;
      continue;
    }

    const task = await dependencies.taskRepository.create({
      business_id: input.businessId,
      customer_profile_id: profile.id,
      task_type: "follow_up",
      title: "Follow up with stale lead",
      notes: `No owner action in the last ${staleAfterHours} hours.`,
      due_at: now.toISOString(),
      status: "open"
    });
    tasks.push(task);
    createdTasks.push(task);

    await dependencies.auditEventRepository.create({
      business_id: input.businessId,
      customer_profile_id: profile.id,
      actor: "system",
      event_type: "task.follow_up.created",
      event_json: {
        taskId: task.id,
        profileId: profile.id,
        staleAfterHours,
        cutoff: cutoff.toISOString()
      }
    });
  }

  return {
    scanned: candidates.length,
    stale,
    created: createdTasks.length,
    skipped_existing_today: skippedExistingToday,
    tasks: createdTasks
  };
}

function isProfileStale(input: {
  profile: CustomerProfileRow;
  messages: MessageRow[];
  tasks: TaskRow[];
  auditEvents: AuditEventRow[];
  cutoff: Date;
}): boolean {
  const lastContactTime = readTime(input.profile.last_contact_at ?? input.profile.created_at);
  if (lastContactTime >= input.cutoff.getTime()) {
    return false;
  }

  return !hasOwnerActionSince(input);
}

function hasOwnerActionSince(input: {
  profile: CustomerProfileRow;
  messages: MessageRow[];
  tasks: TaskRow[];
  auditEvents: AuditEventRow[];
  cutoff: Date;
}): boolean {
  return (
    hasOwnerSentMessageSince(input.profile, input.messages, input.cutoff) ||
    hasOwnerStatusChangeSince(input.profile, input.auditEvents, input.cutoff) ||
    hasCompletedTaskSince(input.profile, input.tasks, input.cutoff)
  );
}

function hasOwnerSentMessageSince(
  profile: CustomerProfileRow,
  messages: MessageRow[],
  cutoff: Date
): boolean {
  return messages.some(
    (message) =>
      message.business_id === profile.business_id &&
      message.customer_profile_id === profile.id &&
      message.direction === "outbound" &&
      !message.provider_message_id?.startsWith(AUTO_TEXT_PROVIDER_ID_PREFIX) &&
      readTime(message.created_at) >= cutoff.getTime()
  );
}

function hasOwnerStatusChangeSince(
  profile: CustomerProfileRow,
  auditEvents: AuditEventRow[],
  cutoff: Date
): boolean {
  return auditEvents.some(
    (event) =>
      event.business_id === profile.business_id &&
      event.customer_profile_id === profile.id &&
      event.actor === "owner" &&
      event.event_type === "profile.update" &&
      hasStatusChange(event.event_json) &&
      readTime(event.created_at) >= cutoff.getTime()
  );
}

function hasCompletedTaskSince(
  profile: CustomerProfileRow,
  tasks: TaskRow[],
  cutoff: Date
): boolean {
  return tasks.some(
    (task) =>
      task.business_id === profile.business_id &&
      task.customer_profile_id === profile.id &&
      (task.status === "done" || task.status === "completed") &&
      readTime(task.updated_at) >= cutoff.getTime()
  );
}

function hasFollowUpTaskForDay(
  tasks: TaskRow[],
  profile: CustomerProfileRow,
  today: { start: number; end: number }
): boolean {
  return tasks.some((task) => {
    const createdAt = readTime(task.created_at);
    return (
      task.business_id === profile.business_id &&
      task.customer_profile_id === profile.id &&
      task.task_type === "follow_up" &&
      createdAt >= today.start &&
      createdAt < today.end
    );
  });
}

function hasStatusChange(value: JsonValue): boolean {
  const eventJson = asObject(value);
  const changes = asObject(eventJson.changes);
  return "status" in changes;
}

function asObject(value: JsonValue | undefined): { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function readTime(value: string | null): number {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getUtcDayBounds(value: Date): { start: number; end: number } {
  const start = Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  return {
    start,
    end: start + 24 * 60 * 60 * 1000
  };
}
