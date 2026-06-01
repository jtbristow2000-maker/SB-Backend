import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { buildDeepHealthPayload } from "@/server/health/deepHealth";

import { GET } from "./route";
import { POST as incomingCall } from "../webhooks/twilio/incoming-call/route";

const originalEnv = {
  API_KEY: process.env.API_KEY,
  PERSISTENCE: process.env.PERSISTENCE,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  SMS_SENDING_ENABLED: process.env.SMS_SENDING_ENABLED,
  CALL_FORWARDING_ENABLED: process.env.CALL_FORWARDING_ENABLED,
  WEBHOOK_SIGNATURE_REQUIRED: process.env.WEBHOOK_SIGNATURE_REQUIRED
};

function healthRequest(apiKey?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/health", {
    headers: apiKey ? { "x-api-key": apiKey } : undefined
  });
}

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function restoreEnv(): void {
  restoreEnvVar("API_KEY", originalEnv.API_KEY);
  restoreEnvVar("PERSISTENCE", originalEnv.PERSISTENCE);
  restoreEnvVar("SUPABASE_URL", originalEnv.SUPABASE_URL);
  restoreEnvVar("SUPABASE_SERVICE_ROLE_KEY", originalEnv.SUPABASE_SERVICE_ROLE_KEY);
  restoreEnvVar("SMS_SENDING_ENABLED", originalEnv.SMS_SENDING_ENABLED);
  restoreEnvVar("CALL_FORWARDING_ENABLED", originalEnv.CALL_FORWARDING_ENABLED);
  restoreEnvVar("WEBHOOK_SIGNATURE_REQUIRED", originalEnv.WEBHOOK_SIGNATURE_REQUIRED);
}

afterEach(() => {
  restoreEnv();
});

describe("BACKEND-06 API key guard", () => {
  it("rejects protected API routes without an API key", async () => {
    process.env.API_KEY = "test-key";

    const response = await GET(healthRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: "unauthorized" });
  });

  it("rejects protected API routes with the wrong API key", async () => {
    process.env.API_KEY = "test-key";

    const response = await GET(healthRequest("wrong-key"));

    expect(response.status).toBe(401);
  });

  it("allows protected API routes with the configured API key", async () => {
    process.env.API_KEY = "test-key";
    process.env.PERSISTENCE = "memory";
    process.env.SMS_SENDING_ENABLED = "false";
    process.env.CALL_FORWARDING_ENABLED = "false";
    process.env.WEBHOOK_SIGNATURE_REQUIRED = "false";

    const response = await GET(healthRequest("test-key"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      persistence: {
        mode: "memory",
        supabase: {
          status: "not_applicable"
        }
      },
      providers: {
        sms: "sandbox",
        calls: "sandbox",
        transcription: "sandbox",
        storage: "sandbox"
      },
      safetyFlags: {
        smsSendingEnabled: false,
        callForwardingEnabled: false,
        webhookSignatureRequired: false
      },
      integrations: {
        apiKeyConfigured: true
      }
    });
  });

  it("does not apply the API key guard to Twilio webhooks", async () => {
    process.env.API_KEY = "test-key";
    const request = new NextRequest("http://localhost:3000/api/webhooks/twilio/incoming-call", {
      method: "POST",
      body: new URLSearchParams({
        From: "+12133734253",
        To: "+13105550199",
        CallSid: "CA_TEST"
      })
    });

    const response = await incomingCall(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      kind: "incoming_call",
      action: "placeholder_only"
    });
  });
});

describe("BACKEND-22 deep health", () => {
  it("reports Supabase connectivity without leaking provider errors", async () => {
    process.env.PERSISTENCE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

    const fakeClient = {
      from: () => ({
        select: async () => ({ count: 3, error: null })
      })
    };

    const payload = await buildDeepHealthPayload({
      supabaseClient: fakeClient as never
    });

    expect(payload).toMatchObject({
      status: "ok",
      persistence: {
        mode: "supabase",
        supabase: {
          configured: true,
          status: "ok",
          businessesCount: 3
        }
      }
    });
  });
});
