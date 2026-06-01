import { NextRequest, NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";
import { withRequestLogging } from "@/server/observability/requestLogging";
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
  return withRequestLogging(request, "/api/webhooks/twilio/incoming-call", async (logger) => {
    const verified = await readVerifiedTwilioPayload(request);
    if (!verified.ok) {
      logger.setContext({ outcome: "twilio_signature_failed" });
      return verified.response;
    }

    logger.setContext({
      providerCallId: verified.payload.CallSid ?? null,
      outcome: "placeholder_only"
    });
    return placeholderResponse("incoming_call", verified.payload);
  });
}

export async function handleIncomingSmsWebhook(request: NextRequest) {
  return withRequestLogging(request, "/api/webhooks/twilio/incoming-sms", async (logger) => {
    const verified = await readVerifiedTwilioPayload(request);
    if (!verified.ok) {
      logger.setContext({ outcome: "twilio_signature_failed" });
      return verified.response;
    }

    logger.setContext({
      providerMessageId: verified.payload.MessageSid ?? null,
      outcome: "placeholder_only"
    });
    return placeholderResponse("incoming_sms", verified.payload);
  });
}

export async function handleRecordingCallbackWebhook(request: NextRequest) {
  return withRequestLogging(request, "/api/webhooks/twilio/recording-callback", async (logger) => {
    const verified = await readVerifiedTwilioPayload(request);
    if (!verified.ok) {
      logger.setContext({ outcome: "twilio_signature_failed" });
      return verified.response;
    }

    logger.setContext({
      providerCallId: verified.payload.CallSid ?? null,
      outcome: "placeholder_only"
    });
    return placeholderResponse("recording_callback", verified.payload);
  });
}
