import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { POST as recordingPost } from "./route";
import { POST as voicePost } from "../voice/route";
import { POST as statusPost } from "../voice/status/route";

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureBusinessEnv(): void {
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000303";
  process.env.BUSINESS_NAME = "Recording Detail Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

afterEach(() => {
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-09 Twilio recording route", () => {
  it("updates the existing call record without creating duplicates", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();

    await voicePost(
      new NextRequest("http://localhost:3000/api/webhooks/twilio/voice", {
        method: "POST",
        body: new URLSearchParams({
          From: "(949) 555-0100",
          To: "+13105550199",
          CallSid: "CA_RECORDING_ROUTE"
        })
      })
    );
    await statusPost(
      new NextRequest("http://localhost:3000/api/webhooks/twilio/voice/status", {
        method: "POST",
        body: new URLSearchParams({
          CallSid: "CA_RECORDING_ROUTE",
          DialCallStatus: "no-answer"
        })
      })
    );

    const response = await recordingPost(
      new NextRequest("http://localhost:3000/api/webhooks/twilio/recording", {
        method: "POST",
        body: new URLSearchParams({
          CallSid: "CA_RECORDING_ROUTE",
          RecordingUrl: "https://api.twilio.test/recording.wav",
          TranscriptionText: "Please call me about a detail."
        })
      })
    );
    const secondResponse = await recordingPost(
      new NextRequest("http://localhost:3000/api/webhooks/twilio/recording", {
        method: "POST",
        body: new URLSearchParams({
          CallSid: "CA_RECORDING_ROUTE",
          RecordingUrl: "https://api.twilio.test/recording.wav",
          TranscriptionText: "Please call me about a detail. Updated."
        })
      })
    );

    const runtime = await getIntakeRuntime();
    const calls = await runtime.callRecordRepository.list();
    expect(response.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].transcript).toBe("Please call me about a detail. Updated.");
    expect(calls[0].needs_review).toBe(true);
  });
});
