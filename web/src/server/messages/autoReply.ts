import { suggestOpenSlots } from "@/server/appointments/availability";
import type { AppointmentRepository } from "@/server/intake/appointments";
import {
  getBusinessSettings,
  quotePriceLabel,
  type AiReplySettings,
  type BusinessSettings
} from "@/server/business/settings";
import type { BusinessRepository } from "@/server/business/bootstrap";
import type { CustomerProfileRepository } from "@/server/customerProfiles/repository";
import type {
  BusinessRow,
  CallRecordRow,
  CustomerProfileRow,
  JsonValue,
  MessageRow
} from "@/server/db/schema";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import type { CallRecordRepository } from "@/server/intake/callRecords";
import type { MessageRepository } from "@/server/intake/messages";
import type { AutoReplyProvider, SmsProvider } from "@/server/providers";

const AUTO_REPLY_PROVIDER_MESSAGE_PREFIX = "missed-call-auto-text";
export const AUTO_TEXT_DELAY_JITTER_SECONDS = 2;

export type MissedCallAutoReplyReason = "transcript" | "timeout";

export type MissedCallAutoReplyDependencies = {
  businessRepository: BusinessRepository;
  customerProfileRepository: CustomerProfileRepository;
  callRecordRepository: CallRecordRepository;
  messageRepository: MessageRepository;
  appointmentRepository: AppointmentRepository;
  auditEventRepository: AuditEventRepository;
  smsProvider: SmsProvider;
  autoReplyProvider: AutoReplyProvider;
  isSmsSendingEnabled: () => boolean;
  isAiReplyEnabled: () => boolean;
  now?: () => Date;
  sleepBeforeAutoReplySend?: (delayMs: number) => Promise<void>;
  autoReplyDelayRandom?: () => number;
};

export type MissedCallAutoReplyResult =
  | { status: "created"; message: MessageRow; body: string; aiGenerated: boolean }
  | { status: "already_exists"; message: MessageRow }
  | { status: "call_not_found" | "business_not_found" | "profile_not_found" | "phone_missing" };

export async function sendMissedCallAutoReply(
  dependencies: MissedCallAutoReplyDependencies,
  input: {
    callRecordId: string;
    reason: MissedCallAutoReplyReason;
  }
): Promise<MissedCallAutoReplyResult> {
  const call = (await dependencies.callRecordRepository.list()).find(
    (candidate) => candidate.id === input.callRecordId
  );
  if (!call) {
    return { status: "call_not_found" };
  }

  const providerMessageId = buildMissedCallAutoReplyMessageId(call);
  const existing = await dependencies.messageRepository.findByProviderMessageId(
    call.business_id,
    providerMessageId
  );
  if (existing) {
    return { status: "already_exists", message: existing };
  }

  if (!call.from_phone_e164) {
    return { status: "phone_missing" };
  }

  const business = await dependencies.businessRepository.findById(call.business_id);
  if (!business) {
    return { status: "business_not_found" };
  }

  const profile = call.customer_profile_id
    ? (await dependencies.customerProfileRepository.list()).find(
        (candidate) =>
          candidate.business_id === call.business_id && candidate.id === call.customer_profile_id
      ) ?? null
    : null;
  if (!profile) {
    return { status: "profile_not_found" };
  }

  const settings = getBusinessSettings(business);
  const composition = await composeMissedCallAutoReply(dependencies, {
    business,
    profile,
    call,
    reason: input.reason,
    settings
  });
  const smsSendingEnabled = dependencies.isSmsSendingEnabled();
  const createdAt = (dependencies.now?.() ?? new Date()).toISOString();
  const sendDelayMs = smsSendingEnabled
    ? autoTextSendDelayMs(settings, dependencies.autoReplyDelayRandom)
    : 0;
  let message = await dependencies.messageRepository.create({
    business_id: call.business_id,
    customer_profile_id: profile.id,
    provider: dependencies.smsProvider.providerName,
    provider_message_id: providerMessageId,
    direction: "outbound",
    channel: "sms",
    from_phone_e164: call.to_phone_e164,
    to_phone_e164: call.from_phone_e164,
    body: composition.body,
    media_json: buildAutoReplyMetadata(composition, input.reason, !smsSendingEnabled),
    status: smsSendingEnabled ? "queued" : "draft",
    sent_at: null,
    created_at: createdAt
  });

  if (smsSendingEnabled) {
    try {
      if (sendDelayMs > 0) {
        await (dependencies.sleepBeforeAutoReplySend ?? sleep)(sendDelayMs);
      }

      const result = await dependencies.smsProvider.sendMessage({
        businessId: call.business_id,
        to: call.from_phone_e164,
        from: call.to_phone_e164 ?? undefined,
        body: composition.body
      });

      if (result.networkCallsMade) {
        message = await dependencies.messageRepository.update(message.id, {
          status: "sent",
          sent_at: createdAt
        });
      }
    } catch (error) {
      message = await dependencies.messageRepository.update(message.id, {
        status: "failed",
        sent_at: null,
        media_json: {
          ...buildAutoReplyMetadata(composition, input.reason, false),
          send_error: error instanceof Error ? error.message : "unknown"
        }
      });
    }
  }

  await dependencies.auditEventRepository.create({
    business_id: call.business_id,
    customer_profile_id: profile.id,
    actor: "system",
    event_type: `message.auto_text.${message.status}`,
    event_json: {
      messageId: message.id,
      providerCallId: call.provider_call_id,
      reason: input.reason,
      level: composition.level,
      aiGenerated: composition.aiGenerated,
      smsSendingEnabled,
      sendDelayMs
    }
  });

  return {
    status: "created",
    message,
    body: composition.body,
    aiGenerated: composition.aiGenerated
  };
}

export function buildMissedCallAutoReplyMessageId(callRecord: CallRecordRow): string {
  return `${AUTO_REPLY_PROVIDER_MESSAGE_PREFIX}:${
    callRecord.provider_call_id ?? callRecord.id
  }`;
}

async function composeMissedCallAutoReply(
  dependencies: MissedCallAutoReplyDependencies,
  input: {
    business: BusinessRow;
    profile: CustomerProfileRow;
    call: CallRecordRow;
    reason: MissedCallAutoReplyReason;
    settings: BusinessSettings;
  }
): Promise<{
  body: string;
  level: number;
  aiGenerated: boolean;
  serviceRequested: string | null;
  priceLabel: string | null;
  openSlots: string[];
}> {
  const settings = input.settings;
  const level = input.reason === "timeout" ? 0 : settings.ai_reply.auto_reply_level;
  const fallback = buildTemplateReply(input.business.name, settings);
  const extracted = readExtractedCallDetails(input.call.extracted_json);
  const serviceRequested = extracted.service_requested;
  const priceLabel = level >= 2 ? quotePriceLabel(serviceRequested, settings.quote_ranges) : null;
  const openSlots =
    level >= 2
      ? suggestOpenSlots({
          appointments: await dependencies.appointmentRepository.list(),
          businessId: input.business.id,
          hours: settings.business_hours,
          requestedDatetime: extracted.requested_datetime,
          now: dependencies.now?.(),
          maxSlots: 2
        })
      : [];

  if (level === 0 || !dependencies.isAiReplyEnabled()) {
    return {
      body: fallback,
      level,
      aiGenerated: false,
      serviceRequested,
      priceLabel,
      openSlots
    };
  }

  try {
    const result = await dependencies.autoReplyProvider.generateMissedCallReply({
      businessId: input.business.id,
      businessName: input.business.name,
      customerName: input.profile.display_name ?? extracted.caller_name,
      transcript: input.call.transcript,
      callerSummary: input.call.ai_summary ?? extracted.summary,
      requestedDatetime: extracted.requested_datetime,
      serviceRequested: level >= 2 ? serviceRequested : null,
      priceLabel,
      openSlots,
      level: level as 1 | 2 | 3,
      tone: {
        formality: settings.ai_reply.formality,
        warmth: settings.ai_reply.warmth
      },
      customNote: settings.ai_reply.custom_note,
      signOff: settings.ai_reply.sign_off || input.business.name
    });
    const body = cleanReplyBody(result.body);
    if (body) {
      return {
        body,
        level,
        aiGenerated: true,
        serviceRequested,
        priceLabel,
        openSlots
      };
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: "missed_call.auto_reply_failed",
        business_id: input.business.id,
        call_record_id: input.call.id,
        error: error instanceof Error ? error.message : "unknown"
      })
    );
  }

  return {
    body: fallback,
    level,
    aiGenerated: false,
    serviceRequested,
    priceLabel,
    openSlots
  };
}

export function autoTextSendDelayMs(
  settings: Pick<BusinessSettings, "auto_text_delay_seconds">,
  random: () => number = Math.random
): number {
  const delaySeconds = settings.auto_text_delay_seconds;
  if (delaySeconds <= 0) {
    return 0;
  }

  const jitterSeconds = (random() * AUTO_TEXT_DELAY_JITTER_SECONDS * 2) - AUTO_TEXT_DELAY_JITTER_SECONDS;
  return Math.max(0, Math.round((delaySeconds + jitterSeconds) * 1000));
}

function buildTemplateReply(businessName: string, settings: BusinessSettings): string {
  return settings.auto_text_message.replaceAll("{business_name}", businessName);
}

function buildAutoReplyMetadata(
  composition: {
    level: number;
    aiGenerated: boolean;
    serviceRequested: string | null;
    priceLabel: string | null;
    openSlots: string[];
  },
  reason: MissedCallAutoReplyReason,
  draft: boolean
): { [key: string]: JsonValue } {
  return {
    kind: "missed_call_auto_reply",
    draft,
    reason,
    ai_generated: composition.aiGenerated,
    auto_reply_level: composition.level,
    service_requested: composition.serviceRequested,
    price_label: composition.priceLabel,
    open_slots: composition.openSlots
  };
}

function readExtractedCallDetails(value: JsonValue): {
  caller_name: string | null;
  requested_datetime: string | null;
  service_requested: string | null;
  summary: string | null;
} {
  const raw = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  return {
    caller_name: readString(raw.caller_name),
    requested_datetime: readString(raw.requested_datetime),
    service_requested: readString(raw.service_requested),
    summary: readString(raw.summary)
  };
}

function readString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanReplyBody(body: string | null): string | null {
  const trimmed = body?.trim();
  return trimmed ? trimmed : null;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
