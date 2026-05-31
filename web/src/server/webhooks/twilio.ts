import { NextRequest, NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";
import { readVerifiedTwilioPayload } from "@/server/webhooks/twilioForm";

export type TwilioWebhookKind = "incoming_call" | "incoming_sms" | "recording_callback";

function placeholderResponse(kind: TwilioWebhookKind, payload: Record<string, string>) {
  const config = getAppConfig();

  return NextResponse.json({
    status: "received",
    provider: "twilio",
    kind,
    sandboxMode: config.sandboxMode,
    action: "placeholder_only",
    realCustomerCommunicationPossible: false,
    receivedFieldNames: Object.keys(payload).sort(),
    message:
      "Webhook received by a sandbox stub. No database writes, SMS sending, call placement, transcription, or AI processing ran."
  });
}

export async function handleIncomingCallWebhook(request: NextRequest) {
  const verified = await readVerifiedTwilioPayload(request);
  if (!verified.ok) {
    return verified.response;
  }

  return placeholderResponse("incoming_call", verified.payload);
}

export async function handleIncomingSmsWebhook(request: NextRequest) {
  const verified = await readVerifiedTwilioPayload(request);
  if (!verified.ok) {
    return verified.response;
  }

  return placeholderResponse("incoming_sms", verified.payload);
}

export async function handleRecordingCallbackWebhook(request: NextRequest) {
  const verified = await readVerifiedTwilioPayload(request);
  if (!verified.ok) {
    return verified.response;
  }

  return placeholderResponse("recording_callback", verified.payload);
}
