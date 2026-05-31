import type { CallRecordRow, CustomerProfileRow, MessageRow, TaskRow } from "@/server/db/schema";

export type CallbackCallOutcome = "missed" | "voicemail" | "answered";
export type AutoReplyStatus = "sent" | "queued" | "failed" | "none";

export type CallbackProfileListItem = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  status: string;
  last_contact_at: string | null;
  open_task_id: string;
  last_call_outcome: CallbackCallOutcome;
  voicemail_snippet: string | null;
  auto_reply_status: AutoReplyStatus;
  customer_replied: boolean;
  last_inbound_at: string | null;
};

export type CallbackProfileListInput = {
  businessId: string;
  profiles: CustomerProfileRow[];
  calls: CallRecordRow[];
  messages: MessageRow[];
  tasks: TaskRow[];
};

export function buildCallbackProfileList(
  input: CallbackProfileListInput
): CallbackProfileListItem[] {
  const profilesById = new Map(
    input.profiles
      .filter((profile) => profile.business_id === input.businessId)
      .map((profile) => [profile.id, profile])
  );
  const openTasksByProfileId = selectOpenCallbackTasks(input.businessId, input.tasks);

  return Array.from(openTasksByProfileId.entries())
    .flatMap(([profileId, task]) => {
      const profile = profilesById.get(profileId);
      if (!profile) {
        return [];
      }

      const profileCalls = input.calls.filter(
        (call) => call.business_id === input.businessId && call.customer_profile_id === profile.id
      );
      const profileMessages = input.messages.filter(
        (message) =>
          message.business_id === input.businessId && message.customer_profile_id === profile.id
      );
      const latestCall = sortByNewestEvent(profileCalls)[0] ?? null;
      const latestMissedOrVoicemailCall =
        sortByNewestEvent(
          profileCalls.filter(
            (call) => call.call_type === "missed" || call.call_type === "voicemail"
          )
        )[0] ?? null;
      const latestInboundMessage =
        sortMessagesByNewest(profileMessages.filter((message) => message.direction === "inbound"))[0] ??
        null;

      return [
        {
          id: profile.id,
          display_name: profile.display_name,
          phone_e164: profile.phone_e164,
          status: profile.status,
          last_contact_at: profile.last_contact_at,
          open_task_id: task.id,
          last_call_outcome: deriveCallOutcome(latestCall),
          voicemail_snippet: deriveVoicemailSnippet(profileCalls),
          auto_reply_status: deriveAutoReplyStatus(profileMessages),
          customer_replied: hasCustomerRepliedSinceCall(
            profileMessages,
            latestMissedOrVoicemailCall
          ),
          last_inbound_at: latestInboundMessage?.created_at ?? null
        }
      ];
    })
    .sort(compareCallbackProfiles);
}

function selectOpenCallbackTasks(
  businessId: string,
  tasks: TaskRow[]
): Map<string, TaskRow> {
  const selected = new Map<string, TaskRow>();

  for (const task of [...tasks].sort((a, b) => compareIsoDesc(a.created_at, b.created_at))) {
    if (
      task.business_id !== businessId ||
      task.task_type !== "callback" ||
      task.status !== "open" ||
      !task.customer_profile_id
    ) {
      continue;
    }

    if (!selected.has(task.customer_profile_id)) {
      selected.set(task.customer_profile_id, task);
    }
  }

  return selected;
}

function deriveCallOutcome(call: CallRecordRow | null): CallbackCallOutcome {
  if (!call) {
    return "missed";
  }

  if (call.call_type === "answered") {
    return "answered";
  }

  if (call.call_type === "voicemail" || Boolean(call.transcript)) {
    return "voicemail";
  }

  return "missed";
}

function deriveVoicemailSnippet(calls: CallRecordRow[]): string | null {
  const latestTranscript = sortByNewestEvent(calls).find((call) => call.transcript)?.transcript;
  return latestTranscript ? latestTranscript.slice(0, 80) : null;
}

function deriveAutoReplyStatus(messages: MessageRow[]): AutoReplyStatus {
  const latestOutbound = sortMessagesByNewest(
    messages.filter((message) => message.direction === "outbound")
  )[0];

  if (!latestOutbound) {
    return "none";
  }

  return isAutoReplyStatus(latestOutbound.status) ? latestOutbound.status : "none";
}

function hasCustomerRepliedSinceCall(
  messages: MessageRow[],
  latestMissedOrVoicemailCall: CallRecordRow | null
): boolean {
  const callStartedAt = latestMissedOrVoicemailCall?.started_at;
  if (!callStartedAt) {
    return false;
  }

  const callTime = new Date(callStartedAt).getTime();
  return messages.some(
    (message) =>
      message.direction === "inbound" && new Date(message.created_at).getTime() >= callTime
  );
}

function compareCallbackProfiles(
  a: CallbackProfileListItem,
  b: CallbackProfileListItem
): number {
  if (a.customer_replied !== b.customer_replied) {
    return a.customer_replied ? -1 : 1;
  }

  return compareIsoDesc(a.last_contact_at, b.last_contact_at);
}

function sortByNewestEvent<T extends { started_at?: string | null; created_at: string }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) =>
    compareIsoDesc(a.started_at ?? a.created_at, b.started_at ?? b.created_at)
  );
}

function sortMessagesByNewest(messages: MessageRow[]): MessageRow[] {
  return [...messages].sort((a, b) => compareIsoDesc(a.created_at, b.created_at));
}

function compareIsoDesc(a?: string | null, b?: string | null): number {
  return new Date(b ?? 0).getTime() - new Date(a ?? 0).getTime();
}

function isAutoReplyStatus(status: string): status is AutoReplyStatus {
  return status === "sent" || status === "queued" || status === "failed";
}
