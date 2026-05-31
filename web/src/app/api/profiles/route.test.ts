import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import type { CallbackProfileListItem } from "@/server/profiles/callbacks";

import { GET } from "./route";

const originalEnv = {
  API_KEY: process.env.API_KEY,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

const expectedKeys = [
  "id",
  "display_name",
  "phone_e164",
  "status",
  "last_contact_at",
  "open_task_id",
  "last_call_outcome",
  "voicemail_snippet",
  "auto_reply_status",
  "customer_replied",
  "last_inbound_at"
].sort();

function configureEnv(): void {
  process.env.API_KEY = "profiles-test-key";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000514";
  process.env.BUSINESS_NAME = "Read API Detail Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

function profilesRequest(apiKey?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/profiles", {
    headers: apiKey ? { "x-api-key": apiKey } : undefined
  });
}

afterEach(() => {
  process.env.API_KEY = originalEnv.API_KEY;
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-14 GET /api/profiles", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await GET(profilesRequest());

    expect(response.status).toBe(401);
  });

  it("returns callback profiles with authoritative OWNER_UX list fields", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const longTranscript =
      "Customer needs a full detail this Saturday morning and wants a quote before noon.";

    const repliedProfile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550100",
        displayName: "Sarah Reply",
        source: "incoming_call",
        lastContactAt: "2026-05-31T14:05:00.000Z"
      })
    ).profile;
    const quietProfile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550101",
        displayName: "Ben Quiet",
        source: "incoming_call",
        lastContactAt: "2026-05-31T15:30:00.000Z"
      })
    ).profile;
    const completedProfile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550102",
        displayName: "Done Lead",
        source: "incoming_call",
        lastContactAt: "2026-05-31T16:00:00.000Z"
      })
    ).profile;

    await runtime.callRecordRepository.create({
      business_id: business.id,
      customer_profile_id: repliedProfile.id,
      provider: "twilio",
      provider_call_id: "CA_REPLIED",
      direction: "inbound",
      call_type: "voicemail",
      from_phone_e164: repliedProfile.phone_e164,
      to_phone_e164: business.business_phone_e164,
      started_at: "2026-05-31T14:00:00.000Z",
      transcript: longTranscript,
      needs_review: true
    });
    const repliedTask = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: repliedProfile.id,
      task_type: "callback",
      title: "Call back missed caller",
      status: "open"
    });
    await runtime.messageRepository.create({
      business_id: business.id,
      customer_profile_id: repliedProfile.id,
      provider: "sandbox",
      provider_message_id: "missed-call-auto-text:CA_REPLIED",
      direction: "outbound",
      channel: "sms",
      from_phone_e164: business.business_phone_e164,
      to_phone_e164: repliedProfile.phone_e164,
      body: "Sorry we missed your call.",
      status: "queued",
      created_at: "2026-05-31T14:01:00.000Z"
    });
    await runtime.messageRepository.create({
      business_id: business.id,
      customer_profile_id: repliedProfile.id,
      provider: "twilio",
      provider_message_id: "SM_REPLIED",
      direction: "inbound",
      channel: "sms",
      from_phone_e164: repliedProfile.phone_e164,
      to_phone_e164: business.business_phone_e164,
      body: "Can you call me back?",
      status: "received",
      created_at: "2026-05-31T14:05:00.000Z"
    });

    await runtime.callRecordRepository.create({
      business_id: business.id,
      customer_profile_id: quietProfile.id,
      provider: "twilio",
      provider_call_id: "CA_QUIET",
      direction: "inbound",
      call_type: "missed",
      from_phone_e164: quietProfile.phone_e164,
      to_phone_e164: business.business_phone_e164,
      started_at: "2026-05-31T15:20:00.000Z"
    });
    const quietTask = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: quietProfile.id,
      task_type: "callback",
      title: "Call back missed caller",
      status: "open"
    });
    await runtime.messageRepository.create({
      business_id: business.id,
      customer_profile_id: quietProfile.id,
      provider: "sandbox",
      provider_message_id: "missed-call-auto-text:CA_QUIET",
      direction: "outbound",
      channel: "sms",
      from_phone_e164: business.business_phone_e164,
      to_phone_e164: quietProfile.phone_e164,
      body: "Sorry we missed your call.",
      status: "sent",
      created_at: "2026-05-31T15:21:00.000Z"
    });

    await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: completedProfile.id,
      task_type: "callback",
      title: "Already done",
      status: "completed"
    });

    const response = await GET(profilesRequest("profiles-test-key"));
    const body = (await response.json()) as CallbackProfileListItem[];

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body.map((item) => item.id)).toEqual([repliedProfile.id, quietProfile.id]);
    expect(Object.keys(body[0]).sort()).toEqual(expectedKeys);
    expect(body[0]).toEqual({
      id: repliedProfile.id,
      display_name: "Sarah Reply",
      phone_e164: "+19495550100",
      status: "new",
      last_contact_at: "2026-05-31T14:05:00.000Z",
      open_task_id: repliedTask.id,
      last_call_outcome: "voicemail",
      voicemail_snippet: longTranscript.slice(0, 80),
      auto_reply_status: "queued",
      customer_replied: true,
      last_inbound_at: "2026-05-31T14:05:00.000Z"
    });
    expect(body[1]).toMatchObject({
      id: quietProfile.id,
      open_task_id: quietTask.id,
      last_call_outcome: "missed",
      voicemail_snippet: null,
      auto_reply_status: "sent",
      customer_replied: false,
      last_inbound_at: null
    });
    expect(body.some((item) => item.id === completedProfile.id)).toBe(false);
  });
});
