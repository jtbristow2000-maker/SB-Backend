import { NextRequest, NextResponse } from "next/server";

import { verifyTwilioRequestSignature } from "@/server/webhooks/twilioSignature";

export type VerifiedTwilioPayload =
  | { ok: true; payload: Record<string, string> }
  | { ok: false; response: NextResponse };

export async function readTwilioForm(request: NextRequest): Promise<Record<string, string>> {
  const form = await request.formData();
  return Object.fromEntries(
    Array.from(form.entries()).map(([key, value]) => [key, String(value)])
  );
}

export async function readTwilioPayload(request: NextRequest): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, String(value ?? "")])
    );
  }

  return readTwilioForm(request);
}

export async function readVerifiedTwilioForm(
  request: NextRequest
): Promise<VerifiedTwilioPayload> {
  const payload = await readTwilioForm(request);
  return verifyPayload(request, payload);
}

export async function readVerifiedTwilioPayload(
  request: NextRequest
): Promise<VerifiedTwilioPayload> {
  const payload = await readTwilioPayload(request);
  return verifyPayload(request, payload);
}

function verifyPayload(
  request: NextRequest,
  payload: Record<string, string>
): VerifiedTwilioPayload {
  const verification = verifyTwilioRequestSignature(request, payload);

  if (!verification.ok) {
    return { ok: false, response: verification.response };
  }

  return { ok: true, payload };
}
