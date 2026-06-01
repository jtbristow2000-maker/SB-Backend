import type { AuditEventRepository } from "@/server/intake/auditEvents";
import type { TaskRepository } from "@/server/intake/tasks";
import type { JsonValue, TaskRow } from "@/server/db/schema";

export type TaskListItem = {
  id: string;
  customer_profile_id: string | null;
  task_type: string;
  title: string;
  notes: string | null;
  due_at: string | null;
  status: TaskRow["status"];
  created_at: string;
};

export type TaskPatchInput = {
  status?: "done" | "dismissed";
  due_at?: string | null;
};

export type TaskPatchValidation =
  | { ok: true; updates: TaskPatchInput }
  | { ok: false; status: number; error: string; fields?: string[] };

export type TaskUpdateResult =
  | { status: "updated"; task: TaskRow }
  | { status: "not_found" };

export type TaskUpdateDependencies = {
  taskRepository: TaskRepository;
  auditEventRepository: AuditEventRepository;
};

const allowedPatchFields = new Set(["status", "due_at"]);

export function buildTaskList(input: {
  businessId: string;
  tasks: TaskRow[];
  status: string;
}): TaskListItem[] {
  return input.tasks
    .filter((task) => task.business_id === input.businessId && task.status === input.status)
    .sort(compareTasksByDueThenCreated)
    .map(toTaskListItem);
}

export function validateTaskPatchPayload(payload: unknown): TaskPatchValidation {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_task_update_payload"
    };
  }

  const entries = Object.entries(payload as Record<string, unknown>);
  const unknownFields = entries
    .map(([field]) => field)
    .filter((field) => !allowedPatchFields.has(field));

  if (unknownFields.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "unknown_task_update_fields",
      fields: unknownFields.sort()
    };
  }

  if (entries.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "empty_task_update_payload"
    };
  }

  const invalidFields: string[] = [];
  const updates: TaskPatchInput = {};
  const record = payload as Record<string, unknown>;

  if ("status" in record) {
    if (record.status === "done" || record.status === "dismissed") {
      updates.status = record.status;
    } else {
      invalidFields.push("status");
    }
  }

  if ("due_at" in record) {
    if (record.due_at === null) {
      updates.due_at = null;
    } else if (typeof record.due_at === "string" && isValidIsoDate(record.due_at)) {
      updates.due_at = record.due_at;
    } else {
      invalidFields.push("due_at");
    }
  }

  if (invalidFields.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "invalid_task_update_field_values",
      fields: invalidFields.sort()
    };
  }

  return { ok: true, updates };
}

export async function updateTaskForOwner(
  dependencies: TaskUpdateDependencies,
  input: {
    businessId: string;
    taskId: string;
    updates: TaskPatchInput;
  }
): Promise<TaskUpdateResult> {
  const tasks = await dependencies.taskRepository.list();
  const existing =
    tasks.find((task) => task.business_id === input.businessId && task.id === input.taskId) ?? null;

  if (!existing) {
    return { status: "not_found" };
  }

  const diff = buildTaskDiff(existing, input.updates);
  const task = await dependencies.taskRepository.update(existing.id, input.updates);

  if (Object.keys(diff).length > 0) {
    await dependencies.auditEventRepository.create({
      business_id: existing.business_id,
      customer_profile_id: existing.customer_profile_id,
      actor: "owner",
      event_type: "task.update",
      event_json: {
        taskId: existing.id,
        changes: diff
      }
    });
  }

  return { status: "updated", task };
}

function toTaskListItem(task: TaskRow): TaskListItem {
  return {
    id: task.id,
    customer_profile_id: task.customer_profile_id,
    task_type: task.task_type,
    title: task.title,
    notes: task.notes,
    due_at: task.due_at,
    status: task.status,
    created_at: task.created_at
  };
}

function buildTaskDiff(existing: TaskRow, updates: TaskPatchInput): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(updates)
      .filter(([field, nextValue]) => existing[field as keyof TaskPatchInput] !== nextValue)
      .map(([field, nextValue]) => [
        field,
        {
          from: existing[field as keyof TaskPatchInput] ?? null,
          to: nextValue ?? null
        }
      ])
  );
}

function compareTasksByDueThenCreated(a: TaskRow, b: TaskRow): number {
  const dueCompare = compareIsoAscNullLast(a.due_at, b.due_at);
  if (dueCompare !== 0) {
    return dueCompare;
  }

  return compareIsoAscNullLast(a.created_at, b.created_at);
}

function compareIsoAscNullLast(a?: string | null, b?: string | null): number {
  return timeOrMax(a) - timeOrMax(b);
}

function timeOrMax(value?: string | null): number {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(value).getTime());
}
