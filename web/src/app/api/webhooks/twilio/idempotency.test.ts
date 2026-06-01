import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { POST as recordingPost } from "./recording/route";
import { POST as smsPost } from "./sms/route";
import { POST as voicePost } from "./voice/route";
import { POST as statusPost } from "./voice/status/route";

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE,
  SMS_SENDING_ENABLED: process.env.SMS_SENDING_ENABLED,
  WEBHOOK_SIGNATURE_REQUIRED: process.env.WEBHOOK_SIGNATURE_REQUIRED
};

function configureBusinessEnv(): void {
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000413";
  process.env.BUSINESS_NAME = "Retry Detail Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
  process.env.SMS_SENDING_ENABLED = "false";
  process.env.WEBHOOK_SIGNATURE_REQUIRED = "false";
}

function twilioRequest(url: string, body: Record<string, string>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: new URLSearchParams(body)
  });
}

async function createVoice(callSid: string): Promise<void> {
  await voicePost(
    twilioRequest("http://localhost:3000/api/webhooks/twilio/voice", {
      From: "(949) 555-0100",
      To: "+13105550199",
      CallSid: callSid
    })
  );
}

afterEach(() => {
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  process.env.SMS_SENDING_ENABLED = originalEnv.SMS_SENDING_ENABLED;
  process.env.WEBHOOK_SIGNATURE_REQUIRED = originalEnv.WEBHOOK_SIGNATURE_REQUIRED;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-13 Twilio webhook idempotency", () => {
  it("dedupes repeated incoming voice webhooks by CallSid", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();

    const first = await voicePost(
      twilioRequest("http://localhost:3000/api/webhooks/twilio/voice", {
        From: "(949) 555-0100",
        To: "+13105550199",
        CallSid: "CA_IDEMPOTENT_VOICE"
      })
    );
    const second = await voicePost(
      twilioRequest("http://localhost:3000/api/webhooks/twilio/voice", {
        From: "+1 949 555 0100",
        To: "+13105550199",
        CallSid: "CA_IDEMPOTENT_VOICE"
      })
    );

    const runtime = await getIntakeRuntime();
    const calls = await runtime.callRecordRepository.list();
    const profiles = await runtime.customerProfileRepository.list();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(profiles).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      provider_call_id: "CA_IDEMPOTENT_VOICE",
      customer_profile_id: profiles[0].id,
      from_phone_e164: "+19495550100"
    });
  });

  it("dedupes repeated no-answer dial status side effects", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();
    await createVoice("CA_IDEMPOTENT_STATUS");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await statusPost(
        twilioRequest("http://localhost:3000/api/webhooks/twilio/voice/status", {
          CallSid: "CA_IDEMPOTENT_STATUS",
          DialCallStatus: "no-answer"
        })
      );
      expect(response.status).toBe(200);
    }

    const runtime = await getIntakeRuntime();
    const calls = await runtime.callRecordRepository.list();
    const tasks = await runtime.taskRepository.list();
    const messages = await runtime.messageRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();
    expect(calls).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "outbound",
      status: "queued",
      provider_message_id: "missed-call-auto-text:CA_IDEMPOTENT_STATUS"
    });
    expect(auditEvents.map((event) => event.event_type)).toEqual([
      "call.missed",
      "message.auto_text.queued"
    ]);
  });

  it("updates repeated recording webhooks in place", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();
    await createVoice("CA_IDEMPOTENT_RECORDING");

    for (const transcript of ["First transcript.", "Updated transcript."]) {
      const response = await recordingPost(
        twilioRequest("http://localhost:3000/api/webhooks/twilio/recording", {
          CallSid: "CA_IDEMPOTENT_RECORDING",
          RecordingUrl: "https://api.twilio.test/recording.wav",
          TranscriptionText: transcript
        })
      );
      expect(response.status).toBe(200);
    }

    const runtime = await getIntakeRuntime();
    const calls = await runtime.callRecordRepository.list();
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      call_type: "voicemail",
      recording_url: "https://api.twilio.test/recording.wav",
      transcript: "First transcript.",
      needs_review: true
    });
  });

  it("dedupes repeated inbound SMS webhooks by MessageSid", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();

    for (const body of ["Need a quote", "Need a quote, updated"]) {
      const response = await smsPost(
        twilioRequest("http://localhost:3000/api/webhooks/twilio/sms", {
          From: "(949) 555-0100",
          To: "+13105550199",
          Body: body,
          MessageSid: "SM_IDEMPOTENT"
        })
      );
      expect(response.status).toBe(200);
    }

    const runtime = await getIntakeRuntime();
    const profiles = await runtime.customerProfileRepository.list();
    const messages = await runtime.messageRepository.list();
    expect(profiles).toHaveLength(1);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      provider_message_id: "SM_IDEMPOTENT",
      body: "Need a quote, updated",
      direction: "inbound",
      status: "received",
      customer_profile_id: profiles[0].id
    });
  });
});
