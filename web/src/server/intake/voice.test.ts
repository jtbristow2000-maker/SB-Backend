import { describe, expect, it } from "vitest";

import { bootstrapSingleTenantBusiness, InMemoryBusinessRepository } from "@/server/business/bootstrap";
import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { CustomerProfileService } from "@/server/customerProfiles/service";
import { createSandboxProviders } from "@/server/providers";

import { InMemoryAuditEventRepository } from "./auditEvents";
import { InMemoryCallRecordRepository } from "./callRecords";
import { InMemoryTaskRepository } from "./tasks";
import { OWNER_DIAL_TIMEOUT_SECONDS, VOICE_STATUS_ACTION_URL, VoiceIntakeService } from "./voice";

describe("BACKEND-07 voice intake service", () => {
  async function setupService() {
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
    const taskRepository = new InMemoryTaskRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    const providers = createSandboxProviders();
    const service = new VoiceIntakeService({
      businessRepository,
      customerProfileService,
      callRecordRepository,
      taskRepository,
      auditEventRepository,
      callProvider: providers.calls
    });

    return {
      customerProfileRepository,
      callRecordRepository,
      taskRepository,
      auditEventRepository,
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
    const { callRecordRepository, taskRepository, auditEventRepository, service } = await setupService();
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
    const tasks = await taskRepository.list();
    const auditEvents = await auditEventRepository.list();
    expect(result.status).toBe("voicemail");
    expect(result.twiml).toContain("<Record");
    expect(result.twiml).toContain('transcribe="true"');
    expect(result.twiml).toContain('transcribeCallback="/api/webhooks/twilio/recording"');
    expect(calls[0].call_type).toBe("missed");
    expect(calls[0].needs_review).toBe(true);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      task_type: "callback",
      status: "open"
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "system",
      event_type: "call.missed"
    });
  });
});
