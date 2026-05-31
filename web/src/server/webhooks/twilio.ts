import { NextRequest, NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";

export type TwilioWebhookKind = "incoming_call" | "incoming_sms" | "recording_callback";

async function readSafePayload(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, String(value ?? "")])
    );
  }

  const form = await request.formData().catch(() => new FormData());
  return Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, String(value)])
  );
}

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
  const payload = await readSafePayload(request);
  return placeholderResponse("incoming_call", payload);
}

export async function handleIncomingSmsWebhook(request: NextRequest) {
  const payload = await readSafePayload(request);
  return placeholderResponse("incoming_sms", payload);
}

export async function handleRecordingCallbackWebhook(request: NextRequest) {
  const payload = await readSafePayload(request);
  return placeholderResponse("recording_callback", payload);
}
