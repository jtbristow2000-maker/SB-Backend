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
  WEBHOOK_SIGNATURE_REQUIRED: process.env.WEBHOOK_SIGNATURE_REQUIRED
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

afterEach(() => {
  process.env.TWILIO_AUTH_TOKEN = originalEnv.TWILIO_AUTH_TOKEN;
  process.env.WEBHOOK_SIGNATURE_REQUIRED = originalEnv.WEBHOOK_SIGNATURE_REQUIRED;
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
