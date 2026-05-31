import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { POST as voicePost } from "../route";
import { POST as statusPost } from "./route";

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureBusinessEnv(): void {
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000302";
  process.env.BUSINESS_NAME = "Status Detail Co";
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

describe("BACKEND-08 Twilio voice status route", () => {
  it("returns voicemail Record TwiML for a no-answer dial status", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();

    await voicePost(
      new NextRequest("http://localhost:3000/api/webhooks/twilio/voice", {
        method: "POST",
        body: new URLSearchParams({
          From: "(949) 555-0100",
          To: "+13105550199",
          CallSid: "CA_STATUS_TEST"
        })
      })
    );

    const response = await statusPost(
      new NextRequest("http://localhost:3000/api/webhooks/twilio/voice/status", {
        method: "POST",
        body: new URLSearchParams({
          CallSid: "CA_STATUS_TEST",
          DialCallStatus: "no-answer"
        })
      })
    );
    const twiml = await response.text();

    expect(response.status).toBe(200);
    expect(twiml).toContain("<Record");
    expect(twiml).toContain('maxLength="120"');
  });
});
