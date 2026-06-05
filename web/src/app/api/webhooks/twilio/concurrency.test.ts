import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import { createTwilioSignature } from "@/server/webhooks/twilioSignature";

import { POST as recordingPost } from "./recording/route";
import { POST as voicePost } from "./voice/route";
import { POST as statusPost } from "./voice/status/route";

const authToken = "test_twilio_auth_token";
const businessId = "00000000-0000-4000-8000-000000000901";
const businessPhone = "+13105550199";
const voiceUrl = "http://localhost:3000/api/webhooks/twilio/voice";
const statusUrl = "http://localhost:3000/api/webhooks/twilio/voice/status";
const recordingUrl = "http://localhost:3000/api/webhooks/twilio/recording";

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE,
  PERSISTENCE: process.env.PERSISTENCE,
  SANDBOX_MODE: process.env.SANDBOX_MODE,
  SMS_SENDING_ENABLED: process.env.SMS_SENDING_ENABLED,
  FAST_TRANSCRIPTION_ENABLED: process.env.FAST_TRANSCRIPTION_ENABLED,
  AI_EXTRACTION_ENABLED: process.env.AI_EXTRACTION_ENABLED,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  WEBHOOK_SIGNATURE_REQUIRED: process.env.WEBHOOK_SIGNATURE_REQUIRED,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL
};

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function configureConcurrencyEnv(): void {
  process.env.BUSINESS_ID = businessId;
  process.env.BUSINESS_NAME = "Concurrency Detail Co";
  process.env.OWNER_PHONE = "+12133734253";
  process.env.BUSINESS_PHONE = businessPhone;
  process.env.TIMEZONE = "America/New_York";
  process.env.PERSISTENCE = "memory";
  process.env.SANDBOX_MODE = "true";
  process.env.SMS_SENDING_ENABLED = "false";
  process.env.FAST_TRANSCRIPTION_ENABLED = "false";
  process.env.AI_EXTRACTION_ENABLED = "false";
  process.env.WEBHOOK_SIGNATURE_REQUIRED = "true";
  process.env.TWILIO_AUTH_TOKEN = authToken;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.APP_BASE_URL;
  delete process.env.NEXT_PUBLIC_APP_BASE_URL;
}

function signedRequest(url: string, params: Record<string, string>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "x-twilio-signature": createTwilioSignature(url, params, authToken)
    },
    body: new URLSearchParams(params)
  });
}

function callerPhone(index: number): string {
  return `+1949555${String(index).padStart(4, "0")}`;
}

async function runVoicemailLifecycle(index: number): Promise<void> {
  const callSid = `CA_CONCURRENCY_${String(index).padStart(4, "0")}`;
  const from = callerPhone(index);

  const voiceResponse = await voicePost(
    signedRequest(voiceUrl, {
      From: from,
      To: businessPhone,
      CallSid: callSid
    })
  );
  expect(voiceResponse.status, `${callSid} voice`).toBe(200);

  const statusResponse = await statusPost(
    signedRequest(statusUrl, {
      CallSid: callSid,
      DialCallStatus: "no-answer"
    })
  );
  expect(statusResponse.status, `${callSid} status`).toBe(200);

  const recordingReadyResponse = await recordingPost(
    signedRequest(recordingUrl, {
      CallSid: callSid,
      RecordingSid: `RE_CONCURRENCY_${String(index).padStart(4, "0")}`,
      RecordingStatus: "completed",
      RecordingUrl: `https://api.twilio.test/recordings/${callSid}`
    })
  );
  expect(recordingReadyResponse.status, `${callSid} recording-ready`).toBe(200);

  const transcriptionResponse = await recordingPost(
    signedRequest(recordingUrl, {
      CallSid: callSid,
      RecordingSid: `RE_CONCURRENCY_${String(index).padStart(4, "0")}`,
      TranscriptionText: `Caller ${index} needs a full detail.`
    })
  );
  expect(transcriptionResponse.status, `${callSid} transcription`).toBe(200);
}

afterEach(() => {
  restoreEnvVar("BUSINESS_ID", originalEnv.BUSINESS_ID);
  restoreEnvVar("BUSINESS_NAME", originalEnv.BUSINESS_NAME);
  restoreEnvVar("OWNER_PHONE", originalEnv.OWNER_PHONE);
  restoreEnvVar("BUSINESS_PHONE", originalEnv.BUSINESS_PHONE);
  restoreEnvVar("TIMEZONE", originalEnv.TIMEZONE);
  restoreEnvVar("PERSISTENCE", originalEnv.PERSISTENCE);
  restoreEnvVar("SANDBOX_MODE", originalEnv.SANDBOX_MODE);
  restoreEnvVar("SMS_SENDING_ENABLED", originalEnv.SMS_SENDING_ENABLED);
  restoreEnvVar("FAST_TRANSCRIPTION_ENABLED", originalEnv.FAST_TRANSCRIPTION_ENABLED);
  restoreEnvVar("AI_EXTRACTION_ENABLED", originalEnv.AI_EXTRACTION_ENABLED);
  restoreEnvVar("TWILIO_AUTH_TOKEN", originalEnv.TWILIO_AUTH_TOKEN);
  restoreEnvVar("WEBHOOK_SIGNATURE_REQUIRED", originalEnv.WEBHOOK_SIGNATURE_REQUIRED);
  restoreEnvVar("PUBLIC_BASE_URL", originalEnv.PUBLIC_BASE_URL);
  restoreEnvVar("APP_BASE_URL", originalEnv.APP_BASE_URL);
  restoreEnvVar("NEXT_PUBLIC_APP_BASE_URL", originalEnv.NEXT_PUBLIC_APP_BASE_URL);
  resetIntakeRuntimeForTests();
});

describe("Twilio call-capture concurrency", () => {
  it("persists a burst of 50 distinct voicemail calls exactly once each", async () => {
    configureConcurrencyEnv();
    resetIntakeRuntimeForTests();
    await getIntakeRuntime();

    const startedAt = performance.now();
    await Promise.all(Array.from({ length: 50 }, (_, index) => runVoicemailLifecycle(index)));
    const elapsedMs = performance.now() - startedAt;

    const runtime = await getIntakeRuntime();
    const calls = await runtime.callRecordRepository.list();
    const profiles = await runtime.customerProfileRepository.list();
    const tasks = await runtime.taskRepository.list();
    const messages = await runtime.messageRepository.list();

    const providerCallIds = calls.map((call) => call.provider_call_id);
    const fromNumbers = calls.map((call) => call.from_phone_e164);

    expect(calls).toHaveLength(50);
    expect(profiles).toHaveLength(50);
    expect(tasks).toHaveLength(50);
    expect(messages).toHaveLength(50);
    expect(new Set(providerCallIds)).toHaveLength(50);
    expect(new Set(fromNumbers)).toHaveLength(50);
    for (let index = 0; index < 50; index += 1) {
      const callSid = `CA_CONCURRENCY_${String(index).padStart(4, "0")}`;
      const call = calls.find((candidate) => candidate.provider_call_id === callSid);
      expect(call, callSid).toBeDefined();
      expect(call).toMatchObject({
        business_id: businessId,
        call_type: "voicemail",
        from_phone_e164: callerPhone(index),
        to_phone_e164: businessPhone,
        recording_url: `https://api.twilio.test/recordings/${callSid}`,
        transcript: `Caller ${index} needs a full detail.`,
        needs_review: true
      });
    }

    expect(elapsedMs).toBeLessThan(5_000);
  });

  it("dedupes the same incoming voice webhook under a 10-request race", async () => {
    configureConcurrencyEnv();
    resetIntakeRuntimeForTests();
    await getIntakeRuntime();

    const params = {
      From: "+19495550100",
      To: businessPhone,
      CallSid: "CA_CONCURRENT_IDEMPOTENCY"
    };

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => voicePost(signedRequest(voiceUrl, params)))
    );

    const runtime = await getIntakeRuntime();
    const calls = await runtime.callRecordRepository.list();
    const profiles = await runtime.customerProfileRepository.list();

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(calls).toHaveLength(1);
    expect(profiles).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      provider_call_id: "CA_CONCURRENT_IDEMPOTENCY",
      from_phone_e164: "+19495550100",
      to_phone_e164: businessPhone
    });
  });
});
