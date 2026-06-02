import type {
  AppointmentRow,
  CallRecordRow,
  CustomerProfileRow,
  MessageRow,
  QuoteDraftRow,
  TaskRow
} from "@/server/db/schema";
import { hasCustomerRepliedSinceCall } from "@/server/profiles/callbacks";

export type ProfileCallTimelineItem = {
  kind: "call";
  at: string | null;
  call: {
    id: string;
    call_type: CallRecordRow["call_type"];
    started_at: string | null;
    duration_seconds: number | null;
    transcript: string | null;
    recording_url: string | null;
    ai_summary: string | null;
    extracted_json: CallRecordRow["extracted_json"];
    needs_review: boolean;
  };
};

export type ProfileMessageTimelineItem = {
  kind: "message";
  at: string | null;
  message: {
    id: string;
    direction: MessageRow["direction"];
    channel: MessageRow["channel"];
    body: string | null;
    status: string;
    sent_at: string | null;
  };
};

export type ProfileTimelineItem = ProfileCallTimelineItem | ProfileMessageTimelineItem;

export type ProfileOpenTask = {
  id: string;
  task_type: string;
  title: string;
  status: TaskRow["status"];
  due_at: string | null;
};

export type ProfileDetailResponse = {
  profile: CustomerProfileRow;
  timeline: ProfileTimelineItem[];
  open_task: ProfileOpenTask | null;
  appointments: AppointmentRow[];
  quote_drafts: QuoteDraftRow[];
  customer_replied: boolean;
};

export type ProfileDetailInput = {
  businessId: string;
  profileId: string;
  profiles: CustomerProfileRow[];
  calls: CallRecordRow[];
  messages: MessageRow[];
  tasks: TaskRow[];
  appointments?: AppointmentRow[];
  quoteDrafts?: QuoteDraftRow[];
};

export function buildProfileDetail(input: ProfileDetailInput): ProfileDetailResponse | null {
  const profile =
    input.profiles.find(
      (candidate) => candidate.business_id === input.businessId && candidate.id === input.profileId
    ) ?? null;

  if (!profile) {
    return null;
  }

  const calls = input.calls.filter(
    (call) => call.business_id === input.businessId && call.customer_profile_id === profile.id
  );
  const messages = input.messages.filter(
    (message) =>
      message.business_id === input.businessId && message.customer_profile_id === profile.id
  );
  const latestMissedOrVoicemailCall = sortCallsByNewest(
    calls.filter((call) => call.call_type === "missed" || call.call_type === "voicemail")
  )[0] ?? null;

  return {
    profile,
    timeline: buildTimeline(calls, messages),
    open_task: selectOpenCallbackTask(input.businessId, profile.id, input.tasks),
    appointments: selectLinkedAppointments(input.businessId, profile.id, input.appointments ?? []),
    quote_drafts: selectLinkedQuoteDrafts(input.businessId, profile.id, input.quoteDrafts ?? []),
    customer_replied: hasCustomerRepliedSinceCall(messages, latestMissedOrVoicemailCall)
  };
}

function buildTimeline(calls: CallRecordRow[], messages: MessageRow[]): ProfileTimelineItem[] {
  const callItems: ProfileCallTimelineItem[] = calls.map((call) => ({
    kind: "call",
    at: call.started_at ?? call.created_at,
    call: {
      id: call.id,
      call_type: call.call_type,
      started_at: call.started_at,
      duration_seconds: call.duration_seconds,
      transcript: call.transcript,
      recording_url: call.recording_url,
      ai_summary: call.ai_summary,
      extracted_json: call.extracted_json,
      needs_review: call.needs_review
    }
  }));
  const messageItems: ProfileMessageTimelineItem[] = messages.map((message) => ({
    kind: "message",
    at: message.sent_at ?? message.created_at,
    message: {
      id: message.id,
      direction: message.direction,
      channel: message.channel,
      body: message.body,
      status: message.status,
      sent_at: message.sent_at
    }
  }));

  return [...callItems, ...messageItems].sort((a, b) => compareIsoDesc(a.at, b.at));
}

function selectOpenCallbackTask(
  businessId: string,
  profileId: string,
  tasks: TaskRow[]
): ProfileOpenTask | null {
  const task =
    [...tasks]
      .filter(
        (candidate) =>
          candidate.business_id === businessId &&
          candidate.customer_profile_id === profileId &&
          candidate.task_type === "callback" &&
          candidate.status === "open"
      )
      .sort((a, b) => compareIsoDesc(a.created_at, b.created_at))[0] ?? null;

  return task
    ? {
        id: task.id,
        task_type: task.task_type,
        title: task.title,
        status: task.status,
        due_at: task.due_at
      }
    : null;
}

function sortCallsByNewest(calls: CallRecordRow[]): CallRecordRow[] {
  return [...calls].sort((a, b) =>
    compareIsoDesc(a.started_at ?? a.created_at, b.started_at ?? b.created_at)
  );
}

function selectLinkedAppointments(
  businessId: string,
  profileId: string,
  appointments: AppointmentRow[]
): AppointmentRow[] {
  return appointments
    .filter(
      (appointment) =>
        appointment.business_id === businessId && appointment.customer_profile_id === profileId
    )
    .sort((a, b) => compareIsoAsc(a.scheduled_start_at, b.scheduled_start_at));
}

function selectLinkedQuoteDrafts(
  businessId: string,
  profileId: string,
  quoteDrafts: QuoteDraftRow[]
): QuoteDraftRow[] {
  return quoteDrafts
    .filter(
      (quoteDraft) =>
        quoteDraft.business_id === businessId && quoteDraft.customer_profile_id === profileId
    )
    .sort((a, b) => compareIsoDesc(a.created_at, b.created_at));
}

function compareIsoAsc(a?: string | null, b?: string | null): number {
  return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime();
}

function compareIsoDesc(a?: string | null, b?: string | null): number {
  return new Date(b ?? 0).getTime() - new Date(a ?? 0).getTime();
}
