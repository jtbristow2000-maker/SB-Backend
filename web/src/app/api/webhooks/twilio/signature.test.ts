import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { createTwilioSignature } from "@/server/webhooks/twilioSignature";

import { POST as incomingCallPost } from "./incoming-call/route";
import { POST as incomingSmsPost } from "./incoming-sms/route";
import { POST as recordingPost } from "./recording/route";
import { POST as recordingCallbackPost } from "./recording-callback/route";
import { POST as smsPost } from "./sms/route";
import { POST as voicePost } from "./voice/route";
import { POST as voiceStatusPost } from "./voice/status/route";

type TwilioPost = (request: NextRequest) => Promise<Response>;

const authToken = "test_twilio_auth_token";
const originalEnv = {
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  WEBHOOK_SIGNATURE_REQUIRED: process.env.WEBHOOK_SIGNATURE_REQUIRED,
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL,
  APP_BASE_URL: process.env.APP_BASE_URL,
  NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL
};

const routes: Array<{ name: string; url: string; post: TwilioPost }> = [
  {
    name: "incoming-call",
    url: "http://localhost:3000/api/webhooks/twilio/incoming-call",
    post: incomingCallPost
  },
  {
    name: "incoming-sms",
    url: "http://localhost:3000/api/webhooks/twilio/incoming-sms",
    post: incomingSmsPost
  },
  {
    name: "recording-callback",
    url: "http://localhost:3000/api/webhooks/twilio/recording-callback",
    post: recordingCallbackPost
  },
  {
    name: "voice",
    url: "http://localhost:3000/api/webhooks/twilio/voice",
    post: voicePost
  },
  {
    name: "voice-status",
    url: "http://localhost:3000/api/webhooks/twilio/voice/status",
    post: voiceStatusPost
  },
  {
    name: "recording",
    url: "http://localhost:3000/api/webhooks/twilio/recording",
    post: recordingPost
  },
  {
    name: "sms",
    url: "http://localhost:3000/api/webhooks/twilio/sms",
    post: smsPost
  }
];

function configureRequiredSignatures(): void {
  process.env.WEBHOOK_SIGNATURE_REQUIRED = "true";
  process.env.TWILIO_AUTH_TOKEN = authToken;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.APP_BASE_URL;
  delete process.env.NEXT_PUBLIC_APP_BASE_URL;
}

function makeRequest(
  url: string,
  params: Record<string, string>,
  signatureParams: Record<string, string> = params
): NextRequest {
  const signature = createTwilioSignature(url, signatureParams, authToken);

  return new NextRequest(url, {
    method: "POST",
    headers: {
      "x-twilio-signature": signature
    },
    body: new URLSearchParams(params)
  });
}

function makeUnsignedRequest(url: string, params: Record<string, string>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: new URLSearchParams(params)
  });
}

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnvVar("TWILIO_AUTH_TOKEN", originalEnv.TWILIO_AUTH_TOKEN);
  restoreEnvVar("WEBHOOK_SIGNATURE_REQUIRED", originalEnv.WEBHOOK_SIGNATURE_REQUIRED);
  restoreEnvVar("PUBLIC_BASE_URL", originalEnv.PUBLIC_BASE_URL);
  restoreEnvVar("APP_BASE_URL", originalEnv.APP_BASE_URL);
  restoreEnvVar("NEXT_PUBLIC_APP_BASE_URL", originalEnv.NEXT_PUBLIC_APP_BASE_URL);
});

describe("BACKEND-12 Twilio webhook signatures", () => {
  it("allows local sandbox requests when signature checks are disabled", async () => {
    process.env.WEBHOOK_SIGNATURE_REQUIRED = "false";
    process.env.TWILIO_AUTH_TOKEN = "";

    const response = await incomingCallPost(
      makeUnsignedRequest("http://localhost:3000/api/webhooks/twilio/incoming-call", {
        From: "+15551234567",
        To: "+15557654321",
        CallSid: "CA_SIGNATURE_BYPASS"
      })
    );

    expect(response.status).toBe(200);
  });

  it("accepts a valid Twilio signature when checks are required", async () => {
    configureRequiredSignatures();
    const url = "http://localhost:3000/api/webhooks/twilio/incoming-call";
    const params = {
      From: "+15551234567",
      To: "+15557654321",
      CallSid: "CA_SIGNATURE_VALID"
    };

    const response = await incomingCallPost(makeRequest(url, params));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.receivedFieldNames).toEqual(["CallSid", "From", "To"]);
  });

  it("accepts a valid signature generated for the public URL behind a proxy", async () => {
    configureRequiredSignatures();
    process.env.PUBLIC_BASE_URL = "https://jobs.example.com";

    const publicUrl = "https://jobs.example.com/api/webhooks/twilio/incoming-call";
    const internalUrl = "http://127.0.0.1:3000/api/webhooks/twilio/incoming-call";
    const params = {
      From: "+15551234567",
      To: "+15557654321",
      CallSid: "CA_SIGNATURE_PROXY"
    };
    const signature = createTwilioSignature(publicUrl, params, authToken);
    const request = new NextRequest(internalUrl, {
      method: "POST",
      headers: {
        "x-twilio-signature": signature,
        "x-forwarded-host": "jobs.example.com",
        "x-forwarded-proto": "https"
      },
      body: new URLSearchParams(params)
    });

    const response = await incomingCallPost(request);

    expect(response.status).toBe(200);
  });

  it("rejects a tampered signature when checks are required", async () => {
    configureRequiredSignatures();
    const url = "http://localhost:3000/api/webhooks/twilio/incoming-call";

    const response = await incomingCallPost(
      makeRequest(
        url,
        {
          From: "+15550000000",
          To: "+15557654321",
          CallSid: "CA_SIGNATURE_TAMPERED"
        },
        {
          From: "+15551234567",
          To: "+15557654321",
          CallSid: "CA_SIGNATURE_TAMPERED"
        }
      )
    );

    expect(response.status).toBe(403);
  });

  it("rejects missing signatures on every Twilio webhook route when checks are required", async () => {
    configureRequiredSignatures();

    for (const route of routes) {
      const response = await route.post(
        makeUnsignedRequest(route.url, {
          From: "+15551234567",
          To: "+15557654321",
          CallSid: "CA_SIGNATURE_MISSING",
          MessageSid: "SM_SIGNATURE_MISSING",
          Body: "Need a quote",
          DialCallStatus: "no-answer"
        })
      );

      expect(response.status, route.name).toBe(403);
    }
  });
});
