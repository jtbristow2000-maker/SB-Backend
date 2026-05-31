import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { POST } from "./route";

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

afterEach(() => {
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-07 Twilio voice route", () => {
  it("returns Dial TwiML for a configured business number", async () => {
    process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000301";
    process.env.BUSINESS_NAME = "Route Detail Co";
    process.env.OWNER_PHONE = "(213) 373-4253";
    process.env.BUSINESS_PHONE = "(310) 555-0199";
    process.env.TIMEZONE = "America/New_York";
    resetIntakeRuntimeForTests();

    const request = new NextRequest("http://localhost:3000/api/webhooks/twilio/voice", {
      method: "POST",
      body: new URLSearchParams({
        From: "(949) 555-0100",
        To: "+13105550199",
        CallSid: "CA_ROUTE_TEST"
      })
    });

    const response = await POST(request);
    const twiml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/xml");
    expect(twiml).toContain("<Response>");
    expect(twiml).toContain('<Dial timeout="18" action="/api/webhooks/twilio/voice/status">+12133734253</Dial>');
  });
});
