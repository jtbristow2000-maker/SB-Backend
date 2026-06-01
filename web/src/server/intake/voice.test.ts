import { describe, expect, it } from "vitest";

import { bootstrapSingleTenantBusiness, InMemoryBusinessRepository } from "@/server/business/bootstrap";
import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { CustomerProfileService } from "@/server/customerProfiles/service";
import {
  createSandboxProviders,
  type ExtractionProvider,
  type SandboxProviderLog,
  type VoicemailExtractionInput,
  type VoicemailExtractionResult
} from "@/server/providers";

import { InMemoryAuditEventRepository } from "./auditEvents";
import { InMemoryCallRecordRepository } from "./callRecords";
import { InMemoryMessageRepository } from "./messages";
import { InMemoryTaskRepository } from "./tasks";
import { OWNER_DIAL_TIMEOUT_SECONDS, VOICE_STATUS_ACTION_URL, VoiceIntakeService } from "./voice";

describe("BACKEND-07 voice intake service", () => {
  function createFakeExtractionProvider(input: {
    result: VoicemailExtractionResult;
    calls: VoicemailExtractionInput[];
  }): ExtractionProvider {
    return {
      providerName: "fake",
      async extractVoicemailDetails(payload) {
        input.calls.push(payload);
        return input.result;
      }
    };
  }

  async function setupService(
    options: {
      smsSendingEnabled?: boolean;
      smsThrows?: boolean;
      aiExtractionEnabled?: boolean;
      extractionProvider?: ExtractionProvider;
    } = {}
  ) {
    const providerLogs: SandboxProviderLog[] = [];
    const businessRepository = new InMemoryBusinessRepository();
    await bootstrapSingleTenantBusiness(businessRepository, {
      id: "00000000-0000-4000-8000-000000000201",
      name: "Detail Test Co",
      ownerName: "Owner",
      ownerPhone: "(213) 373-4253",
      businessPhone: "(310) 555-0199",
      timezone: "America/New_York"
    });
    const customerProfileRepository = new InMemoryCustomerProfileRepository();
    const customerProfileService = new CustomerProfileService(customerProfileRepository);
    const callRecordRepository = new InMemoryCallRecordRepository();
    const messageRepository = new InMemoryMessageRepository();
    const taskRepository = new InMemoryTaskRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    const providers = createSandboxProviders((entry) => providerLogs.push(entry));
    const service = new VoiceIntakeService({
      businessRepository,
      customerProfileRepository,
      customerProfileService,
      callRecordRepository,
      messageRepository,
      taskRepository,
      auditEventRepository,
      callProvider: providers.calls,
      extractionProvider: options.extractionProvider ?? providers.extraction,
      smsProvider: options.smsThrows
        ? {
            async sendMessage() {
              throw new Error("sandbox send failure");
            }
          }
        : providers.sms,
      isSmsSendingEnabled: () => options.smsSendingEnabled ?? false,
      isAiExtractionEnabled: () => options.aiExtractionEnabled ?? false
    });

    return {
      customerProfileRepository,
      callRecordRepository,
      messageRepository,
      taskRepository,
      auditEventRepository,
      providerLogs,
      service
    };
  }

  it("upserts the caller, creates a provisional call record, and returns Dial TwiML", async () => {
    const { customerProfileRepository, callRecordRepository, service } = await setupService();

    const result = await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_TEST"
    });

    expect(result.status).toBe("dial");
    expect(result.twiml).toContain("<Dial");
    expect(result.twiml).toContain("+12133734253");
    expect(result.twiml).toContain(`timeout="${OWNER_DIAL_TIMEOUT_SECONDS}"`);
    expect(result.twiml).toContain(`action="${VOICE_STATUS_ACTION_URL}"`);

    const profiles = await customerProfileRepository.list();
    const calls = await callRecordRepository.list();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].phone_e164).toBe("+19495550100");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      provider: "twilio",
      provider_call_id: "CA_TEST",
      direction: "inbound",
      call_type: "missed",
      from_phone_e164: "+19495550100",
      to_phone_e164: "+13105550199",
      customer_profile_id: profiles[0].id
    });
  });

  it("marks completed dial calls as answered and returns empty TwiML", async () => {
    const { callRecordRepository, taskRepository, service } = await setupService();
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_COMPLETED"
    });

    const result = await service.handleDialStatus({
      callSid: "CA_COMPLETED",
      dialCallStatus: "completed"
    });

    expect(result.status).toBe("answered");
    expect(result.twiml).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    expect(result.callRecord?.call_type).toBe("answered");
    expect(await taskRepository.list()).toHaveLength(0);
    expect((await callRecordRepository.list())[0].needs_review).toBe(false);
  });

  it("creates callback task and voicemail Record TwiML for missed dial calls", async () => {
    const { callRecordRepository, messageRepository, taskRepository, auditEventRepository, providerLogs, service } = await setupService();
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_MISSED"
    });

    const result = await service.handleDialStatus({
      callSid: "CA_MISSED",
      dialCallStatus: "no-answer"
    });

    const calls = await callRecordRepository.list();
    const messages = await messageRepository.list();
    const tasks = await taskRepository.list();
    const auditEvents = await auditEventRepository.list();
    expect(result.status).toBe("voicemail");
    expect(result.twiml).toContain("<Record");
    expect(result.twiml).toContain('transcribe="true"');
    expect(result.twiml).toContain('recordingStatusCallback="/api/webhooks/twilio/recording"');
    expect(result.twiml).toContain('recordingStatusCallbackEvent="completed"');
    expect(result.twiml).toContain('transcribeCallback="/api/webhooks/twilio/recording"');
    expect(calls[0].call_type).toBe("missed");
    expect(calls[0].needs_review).toBe(true);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      task_type: "callback",
      status: "open"
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "outbound",
      channel: "sms",
      status: "queued",
      to_phone_e164: "+19495550100"
    });
    expect(messages[0].body).toContain("Sorry we missed your call");
    expect(providerLogs).toHaveLength(0);
    expect(auditEvents).toHaveLength(2);
    expect(auditEvents[0]).toMatchObject({
      actor: "system",
      event_type: "call.missed"
    });
    expect(auditEvents[1]).toMatchObject({
      actor: "system",
      event_type: "message.auto_text.queued"
    });
  });

  it("sends missed-call auto-text through sandbox provider when SMS sending is enabled", async () => {
    const { messageRepository, auditEventRepository, providerLogs, service } = await setupService({
      smsSendingEnabled: true
    });
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_AUTOTEXT_ON"
    });

    await service.handleDialStatus({
      callSid: "CA_AUTOTEXT_ON",
      dialCallStatus: "busy"
    });

    const messages = await messageRepository.list();
    const auditEvents = await auditEventRepository.list();
    expect(messages).toHaveLength(1);
    expect(messages[0].status).toBe("sent");
    expect(providerLogs.map((entry) => entry.action)).toContain("sms.send.logged_only");
    expect(auditEvents.map((event) => event.event_type)).toContain("message.auto_text.sent");
  });

  it("does not break missed-call flow when auto-text provider send fails", async () => {
    const { messageRepository, auditEventRepository, service } = await setupService({
      smsSendingEnabled: true,
      smsThrows: true
    });
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_AUTOTEXT_FAIL"
    });

    const result = await service.handleDialStatus({
      callSid: "CA_AUTOTEXT_FAIL",
      dialCallStatus: "failed"
    });

    const messages = await messageRepository.list();
    const auditEvents = await auditEventRepository.list();
    expect(result.status).toBe("voicemail");
    expect(messages).toHaveLength(1);
    expect(messages[0].status).toBe("sent");
    expect(auditEvents.map((event) => event.event_type)).toContain("message.auto_text.failed");
  });

  it("attaches recording first and transcript later to the existing call", async () => {
    const { callRecordRepository, service } = await setupService();
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_RECORDING"
    });

    const first = await service.handleRecording({
      callSid: "CA_RECORDING",
      recordingUrl: "https://api.twilio.test/recording.wav"
    });
    const callsAfterRecording = await callRecordRepository.list();
    expect(first.status).toBe("updated");
    expect(callsAfterRecording).toHaveLength(1);
    expect(callsAfterRecording[0]).toMatchObject({
      call_type: "voicemail",
      recording_url: "https://api.twilio.test/recording.wav",
      transcript: null,
      needs_review: true
    });

    const second = await service.handleRecording({
      callSid: "CA_RECORDING",
      transcript: "Hi, I need a detail this week. Updated transcript."
    });

    const calls = await callRecordRepository.list();
    expect(second.status).toBe("updated");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      call_type: "voicemail",
      recording_url: "https://api.twilio.test/recording.wav",
      transcript: "Hi, I need a detail this week. Updated transcript.",
      needs_review: true
    });
  });

  it("extracts voicemail suggestions from transcripts when AI extraction is enabled", async () => {
    const extractionCalls: VoicemailExtractionInput[] = [];
    const extractionProvider = createFakeExtractionProvider({
      calls: extractionCalls,
      result: {
        caller_name: "Shaw",
        requested_datetime: "Saturday",
        service_requested: "full exterior and interior detail",
        summary: "Shaw wants a full exterior and interior detail on Saturday."
      }
    });
    const {
      auditEventRepository,
      callRecordRepository,
      customerProfileRepository,
      service
    } = await setupService({
      aiExtractionEnabled: true,
      extractionProvider
    });
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_AI_EXTRACT"
    });

    const result = await service.handleRecording({
      callSid: "CA_AI_EXTRACT",
      transcript: "Hi, this is Shaw. Could I get a full exterior and interior detail Saturday?"
    });

    const calls = await callRecordRepository.list();
    const profiles = await customerProfileRepository.list();
    const auditEvents = await auditEventRepository.list();
    expect(result.status).toBe("updated");
    expect(extractionCalls).toHaveLength(1);
    expect(extractionCalls[0].transcript).toContain("this is Shaw");
    expect(calls[0]).toMatchObject({
      call_type: "voicemail",
      ai_summary: "Shaw wants a full exterior and interior detail on Saturday.",
      extracted_json: {
        caller_name: "Shaw",
        requested_datetime: "Saturday",
        service_requested: "full exterior and interior detail",
        summary: "Shaw wants a full exterior and interior detail on Saturday."
      },
      needs_review: true
    });
    expect(profiles[0].display_name).toBe("Shaw");
    expect(auditEvents.map((event) => event.event_type)).toContain("voicemail.ai_extracted");
  });

  it("does not call the extraction provider when AI extraction is disabled", async () => {
    const extractionCalls: VoicemailExtractionInput[] = [];
    const { callRecordRepository, service } = await setupService({
      aiExtractionEnabled: false,
      extractionProvider: createFakeExtractionProvider({
        calls: extractionCalls,
        result: {
          caller_name: "Shaw",
          requested_datetime: "Saturday",
          service_requested: "detail",
          summary: "Shaw wants a detail."
        }
      })
    });
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_AI_OFF"
    });

    await service.handleRecording({
      callSid: "CA_AI_OFF",
      transcript: "Hi, this is Shaw. I need a detail."
    });

    const calls = await callRecordRepository.list();
    expect(extractionCalls).toHaveLength(0);
    expect(calls[0].ai_summary).toBeNull();
    expect(calls[0].extracted_json).toEqual({});
  });

  it("does not call the extraction provider for missed calls without a transcript", async () => {
    const extractionCalls: VoicemailExtractionInput[] = [];
    const { callRecordRepository, service } = await setupService({
      aiExtractionEnabled: true,
      extractionProvider: createFakeExtractionProvider({
        calls: extractionCalls,
        result: {
          caller_name: "Shaw",
          requested_datetime: "Saturday",
          service_requested: "detail",
          summary: "Shaw wants a detail."
        }
      })
    });
    await service.handleIncomingVoice({
      from: "(949) 555-0100",
      to: "+13105550199",
      callSid: "CA_NO_TRANSCRIPT"
    });

    await service.handleRecording({
      callSid: "CA_NO_TRANSCRIPT",
      recordingUrl: "https://api.twilio.test/recording.wav"
    });

    const calls = await callRecordRepository.list();
    expect(extractionCalls).toHaveLength(0);
    expect(calls[0]).toMatchObject({
      call_type: "voicemail",
      recording_url: "https://api.twilio.test/recording.wav",
      transcript: null,
      ai_summary: null,
      extracted_json: {}
    });
  });
});
