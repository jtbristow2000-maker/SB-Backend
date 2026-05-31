import type { BusinessRepository } from "@/server/business/bootstrap";
import type { CustomerProfileService } from "@/server/customerProfiles/service";
import type { AuditEventRow, CallRecordRow, CustomerProfileRow, TaskRow } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";
import type { CallProvider } from "@/server/providers";

import type { AuditEventRepository } from "./auditEvents";
import type { CallRecordRepository } from "./callRecords";
import type { MessageRepository } from "./messages";
import type { TaskRepository } from "./tasks";

export const VOICE_STATUS_ACTION_URL = "/api/webhooks/twilio/voice/status";
export const RECORDING_CALLBACK_URL = "/api/webhooks/twilio/recording";
export const OWNER_DIAL_TIMEOUT_SECONDS = 18;
export const VOICEMAIL_MAX_LENGTH_SECONDS = 120;

export type IncomingVoicePayload = {
  from: string;
  to: string;
  callSid?: string;
};

export type IncomingVoiceResult = {
  status: "dial" | "business_not_found" | "owner_phone_missing";
  twiml: string;
  profile?: CustomerProfileRow;
  callRecord?: CallRecordRow;
};

export type DialStatus = "completed" | "no-answer" | "busy" | "failed" | string;

export type DialStatusPayload = {
  callSid: string;
  dialCallStatus: DialStatus;
};

export type DialStatusResult = {
  status: "answered" | "voicemail" | "call_not_found";
  twiml: string;
  callRecord?: CallRecordRow;
  task?: TaskRow;
  auditEvent?: AuditEventRow;
};

export type RecordingPayload = {
  callSid: string;
  recordingUrl?: string | null;
  transcript?: string | null;
};

export type RecordingResult = {
  status: "updated" | "call_not_found";
  callRecord?: CallRecordRow;
};

export type VoiceIntakeDependencies = {
  businessRepository: BusinessRepository;
  customerProfileService: CustomerProfileService;
  callRecordRepository: CallRecordRepository;
  messageRepository: MessageRepository;
  taskRepository: TaskRepository;
  auditEventRepository: AuditEventRepository;
  callProvider: CallProvider;
  smsProvider: {
    sendMessage(input: {
      businessId: string;
      to: string;
      from?: string;
      body: string;
    }): Promise<{ status: string }>;
  };
  isSmsSendingEnabled: () => boolean;
};

export class VoiceIntakeService {
  constructor(private readonly dependencies: VoiceIntakeDependencies) {}

  async handleIncomingVoice(payload: IncomingVoicePayload): Promise<IncomingVoiceResult> {
    const toPhone = normalizePhoneNumber(payload.to);
    const fromPhone = normalizePhoneNumber(payload.from);
    const business = await this.dependencies.businessRepository.findByBusinessPhone(toPhone);

    if (!business) {
      return {
        status: "business_not_found",
        twiml: this.dependencies.callProvider.buildSayTwiml("This business number is not configured.")
      };
    }

    if (!business.owner_phone_e164) {
      return {
        status: "owner_phone_missing",
        twiml: this.dependencies.callProvider.buildSayTwiml("The owner phone number is not configured.")
      };
    }

    const { profile } = await this.dependencies.customerProfileService.upsertByBusinessAndPhone({
      businessId: business.id,
      phone: fromPhone,
      source: "incoming_call",
      lastContactAt: new Date().toISOString()
    });

    const callRecord = await this.dependencies.callRecordRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      provider: "twilio",
      provider_call_id: payload.callSid ?? null,
      direction: "inbound",
      call_type: "missed",
      from_phone_e164: fromPhone,
      to_phone_e164: toPhone
    });

    return {
      status: "dial",
      profile,
      callRecord,
      twiml: this.dependencies.callProvider.buildDialTwiml({
        ownerPhoneE164: business.owner_phone_e164,
        actionUrl: VOICE_STATUS_ACTION_URL,
        timeoutSeconds: OWNER_DIAL_TIMEOUT_SECONDS
      })
    };
  }

  async handleDialStatus(payload: DialStatusPayload): Promise<DialStatusResult> {
    const callRecord = await this.dependencies.callRecordRepository.findByProviderCallId(
      payload.callSid
    );

    if (!callRecord) {
      return {
        status: "call_not_found",
        twiml: this.dependencies.callProvider.buildSayTwiml("Call record was not found.")
      };
    }

    if (payload.dialCallStatus === "completed") {
      const answeredCall = await this.dependencies.callRecordRepository.update(callRecord.id, {
        call_type: "answered",
        needs_review: false
      });

      return {
        status: "answered",
        callRecord: answeredCall,
        twiml: this.dependencies.callProvider.buildEmptyTwiml()
      };
    }

    const missedCall = await this.dependencies.callRecordRepository.update(callRecord.id, {
      call_type: "missed",
      needs_review: true
    });
    const business = await this.dependencies.businessRepository.findById(callRecord.business_id);
    const task = await this.dependencies.taskRepository.create({
      business_id: callRecord.business_id,
      customer_profile_id: callRecord.customer_profile_id,
      task_type: "callback",
      title: "Call back missed caller",
      notes: `Missed call status: ${payload.dialCallStatus}`,
      status: "open"
    });
    const auditEvent = await this.dependencies.auditEventRepository.create({
      business_id: callRecord.business_id,
      customer_profile_id: callRecord.customer_profile_id,
      actor: "system",
      event_type: "call.missed",
      event_json: {
        providerCallId: callRecord.provider_call_id,
        dialCallStatus: payload.dialCallStatus,
        taskId: task.id
      }
    });
    const autoText = this.buildMissedCallAutoText({
      businessName: business?.name ?? "our team",
      settingsJson: business?.settings_json ?? {}
    });
    const smsSendingEnabled = this.dependencies.isSmsSendingEnabled();
    const messageStatus = smsSendingEnabled ? "sent" : "queued";
    const outboundMessage = await this.dependencies.messageRepository.create({
      business_id: callRecord.business_id,
      customer_profile_id: callRecord.customer_profile_id,
      provider: "sandbox",
      direction: "outbound",
      channel: "sms",
      from_phone_e164: callRecord.to_phone_e164,
      to_phone_e164: callRecord.from_phone_e164,
      body: autoText,
      status: messageStatus,
      sent_at: messageStatus === "sent" ? new Date().toISOString() : null
    });

    if (smsSendingEnabled && callRecord.from_phone_e164) {
      try {
        await this.dependencies.smsProvider.sendMessage({
          businessId: callRecord.business_id,
          to: callRecord.from_phone_e164,
          from: callRecord.to_phone_e164 ?? undefined,
          body: autoText
        });
        await this.dependencies.auditEventRepository.create({
          business_id: callRecord.business_id,
          customer_profile_id: callRecord.customer_profile_id,
          actor: "system",
          event_type: "message.auto_text.sent",
          event_json: {
            messageId: outboundMessage.id,
            providerCallId: callRecord.provider_call_id
          }
        });
      } catch (error) {
        await this.dependencies.auditEventRepository.create({
          business_id: callRecord.business_id,
          customer_profile_id: callRecord.customer_profile_id,
          actor: "system",
          event_type: "message.auto_text.failed",
          event_json: {
            messageId: outboundMessage.id,
            providerCallId: callRecord.provider_call_id,
            error: error instanceof Error ? error.message : "unknown"
          }
        });
      }
    } else {
      await this.dependencies.auditEventRepository.create({
        business_id: callRecord.business_id,
        customer_profile_id: callRecord.customer_profile_id,
        actor: "system",
        event_type: "message.auto_text.queued",
        event_json: {
          messageId: outboundMessage.id,
          providerCallId: callRecord.provider_call_id,
          smsSendingEnabled: false
        }
      });
    }

    return {
      status: "voicemail",
      callRecord: missedCall,
      task,
      auditEvent,
      twiml: this.dependencies.callProvider.buildRecordVoicemailTwiml({
        greeting: "Sorry we missed your call. Please leave a message after the beep.",
        transcribeCallbackUrl: RECORDING_CALLBACK_URL,
        maxLengthSeconds: VOICEMAIL_MAX_LENGTH_SECONDS
      })
    };
  }

  private buildMissedCallAutoText(input: {
    businessName: string;
    settingsJson: unknown;
  }): string {
    const template =
      typeof input.settingsJson === "object" &&
      input.settingsJson !== null &&
      "missed_call_auto_text" in input.settingsJson &&
      typeof (input.settingsJson as Record<string, unknown>).missed_call_auto_text === "string"
        ? (input.settingsJson as Record<string, string>).missed_call_auto_text
        : "Sorry we missed your call — reply here and we'll get right back to you. — {business_name}";

    return template.replaceAll("{business_name}", input.businessName);
  }

  async handleRecording(payload: RecordingPayload): Promise<RecordingResult> {
    const callRecord = await this.dependencies.callRecordRepository.findByProviderCallId(
      payload.callSid
    );

    if (!callRecord) {
      return { status: "call_not_found" };
    }

    const updated = await this.dependencies.callRecordRepository.update(callRecord.id, {
      call_type: "voicemail",
      recording_url: payload.recordingUrl ?? callRecord.recording_url,
      transcript: payload.transcript ?? callRecord.transcript,
      needs_review: true
    });

    return {
      status: "updated",
      callRecord: updated
    };
  }
}
