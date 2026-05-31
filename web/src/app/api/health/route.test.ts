import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";
import { POST as incomingCall } from "../webhooks/twilio/incoming-call/route";

const originalApiKey = process.env.API_KEY;

function healthRequest(apiKey?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/health", {
    headers: apiKey ? { "x-api-key": apiKey } : undefined
  });
}

afterEach(() => {
  process.env.API_KEY = originalApiKey;
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

    const response = await GET(healthRequest("test-key"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      apiKeyConfigured: true,
      smsSendingEnabled: false,
      callForwardingEnabled: false
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
