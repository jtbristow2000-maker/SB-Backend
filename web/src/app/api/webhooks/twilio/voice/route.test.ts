import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { POST } from "./route";

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE,
  WEBHOOK_SIGNATURE_REQUIRED: process.env.WEBHOOK_SIGNATURE_REQUIRED
};

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnvVar("BUSINESS_ID", originalEnv.BUSINESS_ID);
  restoreEnvVar("BUSINESS_NAME", originalEnv.BUSINESS_NAME);
  restoreEnvVar("OWNER_PHONE", originalEnv.OWNER_PHONE);
  restoreEnvVar("BUSINESS_PHONE", originalEnv.BUSINESS_PHONE);
  restoreEnvVar("TIMEZONE", originalEnv.TIMEZONE);
  restoreEnvVar("WEBHOOK_SIGNATURE_REQUIRED", originalEnv.WEBHOOK_SIGNATURE_REQUIRED);
  resetIntakeRuntimeForTests();
  vi.restoreAllMocks();
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

  it("returns Record TwiML with HTTP 200 when call forwarding is disabled", async () => {
    process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000303";
    process.env.BUSINESS_NAME = "Route Voicemail Detail Co";
    process.env.OWNER_PHONE = "(213) 373-4253";
    process.env.BUSINESS_PHONE = "(310) 555-0199";
    process.env.TIMEZONE = "America/New_York";
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    await runtime.businessRepository.updateSettings("00000000-0000-4000-8000-000000000303", {
      forward_calls: false
    });

    const request = new NextRequest("http://localhost:3000/api/webhooks/twilio/voice", {
      method: "POST",
      body: new URLSearchParams({
        From: "(949) 555-0100",
        To: "+13105550199",
        CallSid: "CA_ROUTE_FORWARD_OFF"
      })
    });

    const response = await POST(request);
    const twiml = await response.text();

    expect(response.status).toBe(200);
    expect(twiml).toContain("<Record");
    expect(twiml).not.toContain("<Dial");
    expect(await runtime.taskRepository.list()).toHaveLength(1);
  });

  it("emits a structured webhook log with provider and business ids", async () => {
    process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000302";
    process.env.BUSINESS_NAME = "Route Log Detail Co";
    process.env.OWNER_PHONE = "(213) 373-4253";
    process.env.BUSINESS_PHONE = "(310) 555-0199";
    process.env.TIMEZONE = "America/New_York";
    process.env.WEBHOOK_SIGNATURE_REQUIRED = "false";
    resetIntakeRuntimeForTests();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    const request = new NextRequest("http://localhost:3000/api/webhooks/twilio/voice", {
      method: "POST",
      headers: {
        "x-request-id": "req_webhook_log"
      },
      body: new URLSearchParams({
        From: "(949) 555-0100",
        To: "+13105550199",
        CallSid: "CA_ROUTE_LOG"
      })
    });

    const response = await POST(request);
    const logLine = infoSpy.mock.calls
      .map(([line]) => String(line))
      .find((line) => line.includes('"event":"http.request"'));

    expect(response.status).toBe(200);
    expect(logLine).toBeDefined();
    expect(JSON.parse(logLine ?? "{}")).toMatchObject({
      event: "http.request",
      request_id: "req_webhook_log",
      route: "/api/webhooks/twilio/voice",
      status: 200,
      outcome: "dial",
      business_id: "00000000-0000-4000-8000-000000000302",
      provider_call_id: "CA_ROUTE_LOG"
    });
  });
});
