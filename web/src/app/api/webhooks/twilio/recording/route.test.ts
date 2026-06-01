import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import { createTwilioSignature } from "@/server/webhooks/twilioSignature";

import { POST as recordingPost } from "./route";
import { POST as voicePost } from "../voice/route";
import { POST as statusPost } from "../voice/status/route";

const recordingUrl = "http://localhost:3000/api/webhooks/twilio/recording";
const authToken = "test_twilio_auth_token";
const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  WEBHOOK_SIGNATURE_REQUIRED: process.env.WEBHOOK_SIGNATURE_REQUIRED,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL
};

function configureBusinessEnv(): void {
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000303";
  process.env.BUSINESS_NAME = "Recording Detail Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function signedRecordingRequest(params: Record<string, string>): NextRequest {
  return new NextRequest(recordingUrl, {
    method: "POST",
    headers: {
      "x-twilio-signature": createTwilioSignature(recordingUrl, params, authToken)
    },
    body: new URLSearchParams(params)
  });
}

async function seedMissedCall(callSid: string): Promise<void> {
  process.env.WEBHOOK_SIGNATURE_REQUIRED = "false";
  await voicePost(
    new NextRequest("http://localhost:3000/api/webhooks/twilio/voice", {
      method: "POST",
      body: new URLSearchParams({
        From: "(949) 555-0100",
        To: "+13105550199",
        CallSid: callSid
      })
    })
  );
  await statusPost(
    new NextRequest("http://localhost:3000/api/webhooks/twilio/voice/status", {
      method: "POST",
      body: new URLSearchParams({
        CallSid: callSid,
        DialCallStatus: "no-answer"
      })
    })
  );
}

afterEach(() => {
  restoreEnvVar("BUSINESS_ID", originalEnv.BUSINESS_ID);
  restoreEnvVar("BUSINESS_NAME", originalEnv.BUSINESS_NAME);
  restoreEnvVar("OWNER_PHONE", originalEnv.OWNER_PHONE);
  restoreEnvVar("BUSINESS_PHONE", originalEnv.BUSINESS_PHONE);
  restoreEnvVar("TIMEZONE", originalEnv.TIMEZONE);
  restoreEnvVar("TWILIO_AUTH_TOKEN", originalEnv.TWILIO_AUTH_TOKEN);
  restoreEnvVar("WEBHOOK_SIGNATURE_REQUIRED", originalEnv.WEBHOOK_SIGNATURE_REQUIRED);
  restoreEnvVar("PUBLIC_BASE_URL", originalEnv.PUBLIC_BASE_URL);
  restoreEnvVar("APP_BASE_URL", originalEnv.APP_BASE_URL);
  restoreEnvVar("NEXT_PUBLIC_APP_BASE_URL", originalEnv.NEXT_PUBLIC_APP_BASE_URL);
  resetIntakeRuntimeForTests();
});

describe("BACKEND-09 Twilio recording route", () => {
  it("marks voicemail when recording is ready, then fills transcript later", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();
    await seedMissedCall("CA_RECORDING_ROUTE");

    process.env.WEBHOOK_SIGNATURE_REQUIRED = "true";
    process.env.TWILIO_AUTH_TOKEN = authToken;
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.APP_BASE_URL;
    delete process.env.NEXT_PUBLIC_APP_BASE_URL;

    const recordingReadyParams = {
      CallSid: "CA_RECORDING_ROUTE",
      RecordingSid: "RE_RECORDING_ROUTE",
      RecordingStatus: "completed",
      RecordingUrl: "https://api.twilio.test/recording.wav"
    };
    const recordingReadyResponse = await recordingPost(signedRecordingRequest(recordingReadyParams));
    const recordingReadyBody = await recordingReadyResponse.json();

    const runtimeAfterRecording = await getIntakeRuntime();
    const callsAfterRecording = await runtimeAfterRecording.callRecordRepository.list();
    expect(recordingReadyResponse.status).toBe(200);
    expect(recordingReadyBody.action).toBe("recording_ready");
    expect(callsAfterRecording).toHaveLength(1);
    expect(callsAfterRecording[0]).toMatchObject({
      call_type: "voicemail",
      recording_url: "https://api.twilio.test/recording.wav",
      transcript: null,
      needs_review: true
    });

    const transcriptionParams = {
      CallSid: "CA_RECORDING_ROUTE",
      RecordingSid: "RE_RECORDING_ROUTE",
      TranscriptionText: "Please call me about a detail."
    };
    const transcriptionResponse = await recordingPost(signedRecordingRequest(transcriptionParams));
    const transcriptionBody = await transcriptionResponse.json();

    const runtimeAfterTranscript = await getIntakeRuntime();
    const callsAfterTranscript = await runtimeAfterTranscript.callRecordRepository.list();
    expect(transcriptionResponse.status).toBe(200);
    expect(transcriptionBody.action).toBe("transcription_attached");
    expect(callsAfterTranscript).toHaveLength(1);
    expect(callsAfterTranscript[0]).toMatchObject({
      call_type: "voicemail",
      recording_url: "https://api.twilio.test/recording.wav",
      transcript: "Please call me about a detail.",
      needs_review: true
    });
  });

  it("rejects unsigned recording callbacks when signatures are required", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();
    await seedMissedCall("CA_RECORDING_UNSIGNED");

    process.env.WEBHOOK_SIGNATURE_REQUIRED = "true";
    process.env.TWILIO_AUTH_TOKEN = authToken;

    const response = await recordingPost(
      new NextRequest(recordingUrl, {
        method: "POST",
        body: new URLSearchParams({
          CallSid: "CA_RECORDING_UNSIGNED",
          RecordingUrl: "https://api.twilio.test/recording.wav"
        })
      })
    );

    expect(response.status).toBe(403);
  });
});
