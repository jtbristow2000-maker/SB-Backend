import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { POST } from "./route";

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureBusinessEnv(): void {
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000402";
  process.env.BUSINESS_NAME = "SMS Route Detail Co";
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

describe("BACKEND-11 Twilio SMS route", () => {
  it("threads repeated SMS from the same number onto one profile", async () => {
    configureBusinessEnv();
    resetIntakeRuntimeForTests();

    for (const [body, messageSid] of [
      ["Need a quote", "SM_ROUTE_1"],
      ["Can you come Friday?", "SM_ROUTE_2"]
    ]) {
      const response = await POST(
        new NextRequest("http://localhost:3000/api/webhooks/twilio/sms", {
          method: "POST",
          body: new URLSearchParams({
            From: "(949) 555-0100",
            To: "+13105550199",
            Body: body,
            MessageSid: messageSid
          })
        })
      );
      expect(response.status).toBe(200);
    }

    const runtime = await getIntakeRuntime();
    expect(await runtime.customerProfileRepository.list()).toHaveLength(1);
    expect(await runtime.messageRepository.list()).toHaveLength(2);
  });
});
