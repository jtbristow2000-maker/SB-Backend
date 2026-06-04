import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import type { SmsProvider, SmsSendInput } from "@/server/providers";

import { POST } from "./route";

const originalEnv = {
  API_KEY: process.env.API_KEY,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE,
  SMS_SENDING_ENABLED: process.env.SMS_SENDING_ENABLED
};

function configureEnv(options: { smsSendingEnabled?: boolean } = {}): void {
  process.env.API_KEY = "messages-test-key";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000519";
  process.env.BUSINESS_NAME = "Owner Message API Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
  process.env.SMS_SENDING_ENABLED = options.smsSendingEnabled ? "true" : "false";
}

function messagesRequest(body: Record<string, unknown>, apiKey?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify(body)
  });
}

function fakeSmsProvider(input: {
  providerName?: string;
  networkCallsMade?: boolean;
  throws?: boolean;
  sendCalls?: SmsSendInput[];
}): SmsProvider {
  return {
    providerName: input.providerName ?? "fake",
    async sendMessage(sendInput) {
      input.sendCalls?.push(sendInput);
      if (input.throws) {
        throw new Error("fake SMS provider failure");
      }

      return {
        provider: input.providerName ?? "fake",
        status: input.networkCallsMade ? "completed" : "logged",
        action: "sms.send.fake",
        networkCallsMade: input.networkCallsMade ?? false
      };
    },
    async recordInboundMessage() {
      return {
        provider: input.providerName ?? "fake",
        status: "logged",
        action: "sms.inbound.fake",
        networkCallsMade: false
      };
    }
  };
}

afterEach(() => {
  process.env.API_KEY = originalEnv.API_KEY;
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  process.env.SMS_SENDING_ENABLED = originalEnv.SMS_SENDING_ENABLED;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-18 POST /api/messages", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await POST(messagesRequest({ profile_id: "profile-1", body: "Hello" }));

    expect(response.status).toBe(401);
  });

  it("rejects empty message bodies", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await POST(
      messagesRequest({ profile_id: "profile-1", body: "   " }, "messages-test-key")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "invalid_message_field_values",
      fields: ["body"]
    });
  });

  it("returns 404 for an unknown profile id", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await POST(
      messagesRequest({ profile_id: "missing-profile", body: "Can I help?" }, "messages-test-key")
    );

    expect(response.status).toBe(404);
  });

  it("queues exactly one outbound message without provider send when SMS sending is disabled", async () => {
    configureEnv({ smsSendingEnabled: false });
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = await runtime.businessRepository.updateTelephony(
      (await runtime.businessRepository.list())[0].id,
      {
        twilioNumber: "+14155550100",
        twilioNumberSid: "PN_OWNER_SMS",
        numberStatus: "trial"
      }
    );
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550100",
        displayName: "Queued Customer",
        source: "manual"
      })
    ).profile;
    const sendCalls: SmsSendInput[] = [];
    runtime.smsProvider = fakeSmsProvider({ providerName: "sandbox", sendCalls });

    const response = await POST(
      messagesRequest(
        { profile_id: profile.id, body: "Thanks for reaching out." },
        "messages-test-key"
      )
    );
    const body = await response.json();
    const messages = await runtime.messageRepository.list();
    const profiles = await runtime.customerProfileRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(sendCalls).toHaveLength(0);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: body.message.id,
      business_id: business.id,
      customer_profile_id: profile.id,
      provider: "sandbox",
      direction: "outbound",
      channel: "sms",
      from_phone_e164: business.twilio_number_e164,
      to_phone_e164: profile.phone_e164,
      body: "Thanks for reaching out.",
      status: "queued",
      sent_at: null
    });
    expect(profiles.find((candidate) => candidate.id === profile.id)?.last_contact_at).toBe(
      messages[0].created_at
    );
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "message.owner_sms.queued",
      business_id: business.id,
      customer_profile_id: profile.id
    });
  });

  it("records sent status only when the selected provider transmits", async () => {
    configureEnv({ smsSendingEnabled: true });
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = await runtime.businessRepository.updateTelephony(
      (await runtime.businessRepository.list())[0].id,
      {
        twilioNumber: "+14155550100",
        twilioNumberSid: "PN_OWNER_SMS",
        numberStatus: "trial"
      }
    );
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550101",
        displayName: "Sent Customer",
        source: "manual"
      })
    ).profile;
    const sendCalls: SmsSendInput[] = [];
    runtime.smsProvider = fakeSmsProvider({
      providerName: "twilio",
      networkCallsMade: true,
      sendCalls
    });

    const response = await POST(
      messagesRequest({ profile_id: profile.id, body: "I can come by at 3." }, "messages-test-key")
    );
    const body = await response.json();
    const messages = await runtime.messageRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(sendCalls).toEqual([
      {
        businessId: business.id,
        to: profile.phone_e164,
        from: business.twilio_number_e164 ?? undefined,
        body: "I can come by at 3."
      }
    ]);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      id: body.message.id,
      provider: "twilio",
      direction: "outbound",
      channel: "sms",
      status: "sent",
      sent_at: messages[0].created_at,
      body: "I can come by at 3."
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "message.owner_sms.sent",
      customer_profile_id: profile.id
    });
  });

  it("keeps owner SMS queued when the selected provider does not transmit", async () => {
    configureEnv({ smsSendingEnabled: true });
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550102",
        displayName: "Queued Sending Customer",
        source: "manual"
      })
    ).profile;
    const sendCalls: SmsSendInput[] = [];
    runtime.smsProvider = fakeSmsProvider({
      providerName: "sandbox",
      networkCallsMade: false,
      sendCalls
    });

    const response = await POST(
      messagesRequest({ profile_id: profile.id, body: "Still checking the schedule." }, "messages-test-key")
    );
    const messages = await runtime.messageRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(sendCalls).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      provider: "sandbox",
      status: "queued",
      sent_at: null
    });
    expect(auditEvents[0]).toMatchObject({
      event_type: "message.owner_sms.queued",
      customer_profile_id: profile.id
    });
  });

  it("records failed status when the selected provider throws", async () => {
    configureEnv({ smsSendingEnabled: true });
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550103",
        displayName: "Failed Sending Customer",
        source: "manual"
      })
    ).profile;
    const sendCalls: SmsSendInput[] = [];
    runtime.smsProvider = fakeSmsProvider({
      providerName: "twilio",
      throws: true,
      sendCalls
    });

    const response = await POST(
      messagesRequest({ profile_id: profile.id, body: "This send should fail." }, "messages-test-key")
    );
    const messages = await runtime.messageRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(sendCalls).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      provider: "twilio",
      status: "failed",
      sent_at: null
    });
    expect(auditEvents[0]).toMatchObject({
      event_type: "message.owner_sms.failed",
      customer_profile_id: profile.id
    });
  });
});
