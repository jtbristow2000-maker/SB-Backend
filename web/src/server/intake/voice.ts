import type { BusinessRepository } from "@/server/business/bootstrap";
import { DEFAULT_VOICEMAIL_GREETING, getBusinessSettings } from "@/server/business/settings";
import type { AppointmentRepository } from "@/server/intake/appointments";
import { sendMissedCallAutoReply } from "@/server/messages/autoReply";
import type {
  CustomerProfileRepository,
  CustomerProfileUpdateInput
} from "@/server/customerProfiles/repository";
import type { CustomerProfileService } from "@/server/customerProfiles/service";
import type {
  AuditEventRow,
  CallRecordRow,
  CustomerProfileRow,
  JsonValue,
  PreferredContactMethod,
  TaskRow
} from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";
import { resolveBusinessByInboundPhone } from "@/server/telephony/routing";
import type { VoicemailGreetingRepository } from "@/server/voicemailGreetings/repository";
import type {
  AutoReplyProvider,
  CallProvider,
  ExtractionProvider,
  SmsProvider,
  TranscriptionProvider,
  VoicemailExtractionResult
} from "@/server/providers";

import type { AuditEventRepository } from "./auditEvents";
import type { CallRecordRepository } from "./callRecords";
import type { MessageRepository } from "./messages";
import type { TaskRepository } from "./tasks";

export const VOICE_STATUS_ACTION_URL = "/api/webhooks/twilio/voice/status";
export const RECORDING_WEBHOOK_URL = "/api/webhooks/twilio/recording";
export const TRANSCRIPTION_CALLBACK_URL = RECORDING_WEBHOOK_URL;
export const OWNER_DIAL_TIMEOUT_SECONDS = 18;
export const VOICEMAIL_MAX_LENGTH_SECONDS = 120;
export const MISSED_CALL_AUTO_REPLY_TIMEOUT_MS = 75_000;

export type IncomingVoicePayload = {
  from: string;
  to: string;
  callSid?: string;
};

export type IncomingVoiceResult = {
  status: "dial" | "voicemail" | "business_not_found";
  twiml: string;
  profile?: CustomerProfileRow;
  callRecord?: CallRecordRow;
  task?: TaskRow;
  auditEvent?: AuditEventRow;
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
  customerProfileRepository: CustomerProfileRepository;
  customerProfileService: CustomerProfileService;
  callRecordRepository: CallRecordRepository;
  messageRepository: MessageRepository;
  taskRepository: TaskRepository;
  auditEventRepository: AuditEventRepository;
  appointmentRepository: AppointmentRepository;
  voicemailGreetingRepository: VoicemailGreetingRepository;
  callProvider: CallProvider;
  extractionProvider: ExtractionProvider;
  autoReplyProvider: AutoReplyProvider;
  transcriptionProvider: TranscriptionProvider;
  smsProvider: SmsProvider;
  isSmsSendingEnabled: () => boolean;
  isAiExtractionEnabled: () => boolean;
  isAiReplyEnabled: () => boolean;
  isFastTranscriptionEnabled: () => boolean;
  getPublicBaseUrl?: () => string | null;
  scheduleAutoReplyTimeout?: (callback: () => void, delayMs: number) => void;
  scheduleAutomatedOutbound?: (callback: () => Promise<void>) => Promise<void> | void;
  sleepBeforeAutoReplySend?: (delayMs: number) => Promise<void>;
  autoReplyDelayRandom?: () => number;
};

export class VoiceIntakeService {
  constructor(private readonly dependencies: VoiceIntakeDependencies) {}

  async handleIncomingVoice(payload: IncomingVoicePayload): Promise<IncomingVoiceResult> {
    const toPhone = normalizePhoneNumber(payload.to);
    const fromPhone = normalizePhoneNumber(payload.from);
    const businessMatch = await resolveBusinessByInboundPhone(
      this.dependencies.businessRepository,
      toPhone
    );
    const business = businessMatch?.business ?? null;

    if (!business) {
      return {
        status: "business_not_found",
        twiml: this.dependencies.callProvider.buildSayTwiml("This business number is not configured.")
      };
    }

    const { profile } = await this.dependencies.customerProfileService.upsertByBusinessAndPhone({
      businessId: business.id,
      phone: fromPhone,
      source: "incoming_call",
      lastContactAt: new Date().toISOString()
    });

    const existingCallRecord = payload.callSid
      ? await this.dependencies.callRecordRepository.findByProviderCallId(
          business.id,
          payload.callSid
        )
      : null;
    const callRecord = existingCallRecord
      ? await this.dependencies.callRecordRepository.update(existingCallRecord.id, {
          customer_profile_id: profile.id,
          provider: "twilio",
          provider_call_id: payload.callSid,
          direction: "inbound",
          from_phone_e164: fromPhone,
          to_phone_e164: toPhone
        })
      : await this.dependencies.callRecordRepository.create({
          business_id: business.id,
          customer_profile_id: profile.id,
          provider: "twilio",
          provider_call_id: payload.callSid ?? null,
          direction: "inbound",
          call_type: "missed",
          from_phone_e164: fromPhone,
          to_phone_e164: toPhone
        });

    const settings = getBusinessSettings(business);
    if (settings.forward_calls === false || !business.owner_phone_e164) {
      const voicemail = await this.prepareVoicemailRecording({
        callRecord,
        dialCallStatus: settings.forward_calls === false ? "forwarding-disabled" : "owner-phone-missing"
      });

      return {
        status: "voicemail",
        profile,
        callRecord: voicemail.callRecord,
        task: voicemail.task,
        auditEvent: voicemail.auditEvent,
        twiml: voicemail.twiml
      };
    }

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

    const voicemail = await this.prepareVoicemailRecording({
      callRecord,
      dialCallStatus: payload.dialCallStatus
    });

    return {
      status: "voicemail",
      callRecord: voicemail.callRecord,
      task: voicemail.task,
      auditEvent: voicemail.auditEvent,
      twiml: voicemail.twiml
    };
  }

  private async prepareVoicemailRecording(input: {
    callRecord: CallRecordRow;
    dialCallStatus: string;
  }): Promise<{
    callRecord: CallRecordRow;
    task: TaskRow;
    auditEvent?: AuditEventRow;
    twiml: string;
  }> {
    const { callRecord, dialCallStatus } = input;
    const missedCallAlreadyProcessed =
      callRecord.needs_review &&
      (callRecord.call_type === "missed" || callRecord.call_type === "voicemail");
    const missedCall = await this.dependencies.callRecordRepository.update(callRecord.id, {
      call_type: callRecord.call_type === "voicemail" ? "voicemail" : "missed",
      needs_review: true
    });
    const existingTask = callRecord.customer_profile_id
      ? await this.dependencies.taskRepository.findOpenCallbackTask(callRecord.customer_profile_id)
      : null;
    const task =
      existingTask ??
      (await this.dependencies.taskRepository.create({
        business_id: callRecord.business_id,
        customer_profile_id: callRecord.customer_profile_id,
        task_type: "callback",
        title: "Call back missed caller",
        notes: `Missed call status: ${dialCallStatus}`,
        status: "open"
      }));
    const auditEvent = missedCallAlreadyProcessed
      ? undefined
      : await this.dependencies.auditEventRepository.create({
          business_id: callRecord.business_id,
          customer_profile_id: callRecord.customer_profile_id,
          actor: "system",
          event_type: "call.missed",
          event_json: {
            providerCallId: callRecord.provider_call_id,
            dialCallStatus,
            taskId: task.id
          }
        });

    if (!missedCallAlreadyProcessed) {
      this.scheduleMissedCallAutoReplyTimeout(missedCall.id);
    }

    const greeting = await this.buildVoicemailGreeting(callRecord.business_id);

    return {
      callRecord: missedCall,
      task,
      auditEvent,
      twiml: this.dependencies.callProvider.buildRecordVoicemailTwiml({
        greeting: greeting.text,
        playUrl: greeting.playUrl,
        recordingStatusCallbackUrl: RECORDING_WEBHOOK_URL,
        transcribeCallbackUrl: this.dependencies.isFastTranscriptionEnabled()
          ? null
          : TRANSCRIPTION_CALLBACK_URL,
        maxLengthSeconds: VOICEMAIL_MAX_LENGTH_SECONDS
      })
    };
  }

  private async buildVoicemailGreeting(
    businessId: string
  ): Promise<{ text: string; playUrl: string | null }> {
    const business = await this.dependencies.businessRepository.findById(businessId);
    const settings = getBusinessSettings(business);
    const text = settings.voicemail_greeting || DEFAULT_VOICEMAIL_GREETING;
    const baseUrl = this.dependencies.getPublicBaseUrl?.() ?? null;

    if (!baseUrl) {
      return { text, playUrl: null };
    }

    try {
      const greeting = await this.dependencies.voicemailGreetingRepository.findByBusinessId(
        businessId
      );
      if (!greeting) {
        return { text, playUrl: null };
      }

      return {
        text,
        playUrl: new URL(`/api/voicemail-greeting/${businessId}`, baseUrl).toString()
      };
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "voicemail.greeting_audio_lookup_failed",
          business_id: businessId,
          error: error instanceof Error ? error.message : "unknown"
        })
      );
      return { text, playUrl: null };
    }
  }

  async handleRecording(payload: RecordingPayload): Promise<RecordingResult> {
    const callRecord = await this.dependencies.callRecordRepository.findByProviderCallId(
      payload.callSid
    );

    if (!callRecord) {
      return { status: "call_not_found" };
    }

    const incomingTranscript = payload.transcript?.trim() || null;
    const recordingUrl = payload.recordingUrl ?? callRecord.recording_url;
    let transcript = callRecord.transcript ?? incomingTranscript;
    let updated = await this.dependencies.callRecordRepository.update(callRecord.id, {
      call_type: "voicemail",
      recording_url: recordingUrl,
      transcript,
      needs_review: true
    });

    if (!transcript && payload.recordingUrl && this.dependencies.isFastTranscriptionEnabled()) {
      transcript = await this.transcribeRecordingSafe(updated, payload.recordingUrl);
      if (transcript) {
        updated = await this.dependencies.callRecordRepository.update(updated.id, {
          transcript,
          needs_review: true
        });
      }
    }

    const shouldExtract = Boolean(transcript && !callRecord.transcript);
    const enriched =
      shouldExtract && transcript
        ? await this.extractVoicemailSuggestions(updated, transcript)
        : updated;

    if (transcript) {
      await this.scheduleMissedCallAutoReplySend(enriched.id, "transcript");
    }

    return {
      status: "updated",
      callRecord: enriched
    };
  }

  private scheduleMissedCallAutoReplyTimeout(callRecordId: string): void {
    const schedule = this.dependencies.scheduleAutoReplyTimeout ?? defaultAutoReplyTimeoutScheduler;
    schedule(() => {
      void this.sendMissedCallAutoReplySafe(callRecordId, "timeout");
    }, MISSED_CALL_AUTO_REPLY_TIMEOUT_MS);
  }

  private async scheduleMissedCallAutoReplySend(
    callRecordId: string,
    reason: "transcript" | "timeout"
  ): Promise<void> {
    const schedule = this.dependencies.scheduleAutomatedOutbound ?? defaultAutomatedOutboundScheduler;
    await schedule(() => this.sendMissedCallAutoReplySafe(callRecordId, reason));
  }

  private async sendMissedCallAutoReplySafe(
    callRecordId: string,
    reason: "transcript" | "timeout"
  ): Promise<void> {
    try {
      await sendMissedCallAutoReply(this.dependencies, {
        callRecordId,
        reason
      });
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "missed_call.auto_reply_send_failed",
          call_record_id: callRecordId,
          reason,
          error: error instanceof Error ? error.message : "unknown"
        })
      );
    }
  }

  private async transcribeRecordingSafe(
    callRecord: CallRecordRow,
    recordingUrl: string
  ): Promise<string | null> {
    try {
      const result = await this.dependencies.transcriptionProvider.transcribeRecording({
        businessId: callRecord.business_id,
        recordingUrl,
        sourceId: callRecord.id
      });

      return result.transcript?.trim() || null;
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "voicemail.fast_transcription_failed",
          business_id: callRecord.business_id,
          call_record_id: callRecord.id,
          error: error instanceof Error ? error.message : "unknown"
        })
      );
      return null;
    }
  }

  private async extractVoicemailSuggestions(
    callRecord: CallRecordRow,
    transcript: string
  ): Promise<CallRecordRow> {
    if (!this.dependencies.isAiExtractionEnabled()) {
      return callRecord;
    }

    try {
      const business = await this.dependencies.businessRepository.findById(callRecord.business_id);
      const extraction = await this.dependencies.extractionProvider.extractVoicemailDetails({
        businessId: callRecord.business_id,
        callRecordId: callRecord.id,
        customerProfileId: callRecord.customer_profile_id,
        transcript,
        timezone: business?.timezone ?? null
      });

      if (!extraction) {
        return callRecord;
      }

      const extractedJson = buildExtractedJson(extraction);
      const enrichedCallRecord = await this.dependencies.callRecordRepository.update(callRecord.id, {
        ai_summary: extraction.summary,
        extracted_json: extractedJson,
        needs_review: true
      });

      await this.applyExtractedProfileDetailsSafe(callRecord, extraction);
      await this.dependencies.auditEventRepository.create({
        business_id: callRecord.business_id,
        customer_profile_id: callRecord.customer_profile_id,
        actor: "system",
        event_type: "voicemail.ai_extracted",
        event_json: {
          callRecordId: callRecord.id,
          provider: this.dependencies.extractionProvider.providerName,
          extracted: extractedJson
        }
      });

      return enrichedCallRecord;
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "voicemail.ai_extraction_failed",
          business_id: callRecord.business_id,
          call_record_id: callRecord.id,
          error: error instanceof Error ? error.message : "unknown"
        })
      );
      return callRecord;
    }
  }

  private async applyExtractedProfileDetailsSafe(
    callRecord: CallRecordRow,
    extraction: VoicemailExtractionResult
  ): Promise<void> {
    if (!callRecord.customer_profile_id) {
      return;
    }

    try {
      const profiles = await this.dependencies.customerProfileRepository.list();
      const profile = profiles.find((candidate) => candidate.id === callRecord.customer_profile_id);
      if (!profile) {
        return;
      }

      const updates = buildExtractedProfileUpdates(profile, extraction);
      if (Object.keys(updates).length === 0) {
        return;
      }

      await this.dependencies.customerProfileRepository.update(profile.id, updates);
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: "voicemail.profile_enrichment_failed",
          business_id: callRecord.business_id,
          call_record_id: callRecord.id,
          customer_profile_id: callRecord.customer_profile_id,
          error: error instanceof Error ? error.message : "unknown"
        })
      );
    }
  }
}

function buildExtractedJson(extraction: VoicemailExtractionResult): JsonValue {
  return {
    caller_name: extraction.caller_name,
    requested_datetime: extraction.requested_datetime,
    service_requested: extraction.service_requested,
    summary: extraction.summary,
    vehicle: extraction.vehicle,
    preferred_contact: extraction.preferred_contact,
    address: extraction.address,
    referral_source: extraction.referral_source
  };
}

function buildExtractedProfileUpdates(
  profile: CustomerProfileRow,
  extraction: VoicemailExtractionResult
): CustomerProfileUpdateInput {
  const updates: CustomerProfileUpdateInput = {};

  setIfBlank(updates, profile, "display_name", extraction.caller_name);
  setIfBlank(updates, profile, "vehicles", extraction.vehicle);
  setIfBlank(updates, profile, "referral_source", extraction.referral_source);

  if (isPreferredContact(extraction.preferred_contact)) {
    setIfBlank(updates, profile, "preferred_contact", extraction.preferred_contact);
  }

  const address = extraction.address?.trim() || null;
  if (address) {
    const addressField = isPoBox(address) ? "po_box" : "address_line1";
    setIfBlank(updates, profile, addressField, address);
  }

  return updates;
}

function setIfBlank<K extends keyof CustomerProfileRow>(
  updates: CustomerProfileUpdateInput,
  profile: CustomerProfileRow,
  field: K,
  value: CustomerProfileRow[K] | null | undefined
): void {
  if (typeof value !== "string" || !value.trim()) {
    return;
  }

  const existing = profile[field];
  if (typeof existing === "string" && existing.trim()) {
    return;
  }

  (updates as Record<K, CustomerProfileRow[K]>)[field] = value.trim() as CustomerProfileRow[K];
}

function isPreferredContact(value: unknown): value is PreferredContactMethod {
  return value === "call" || value === "text" || value === "email";
}

function isPoBox(value: string): boolean {
  return /^\s*(p\.?\s*o\.?\s*box|post\s+office\s+box)\b/i.test(value);
}

function defaultAutoReplyTimeoutScheduler(callback: () => void, delayMs: number): void {
  const timer = setTimeout(callback, delayMs);
  timer.unref?.();
}

function defaultAutomatedOutboundScheduler(callback: () => Promise<void>): Promise<void> {
  return callback();
}
