import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";

const SIGNATURE_HEADER = "x-twilio-signature";

export type TwilioSignatureVerification =
  | { ok: true; required: boolean; bypassed: boolean }
  | { ok: false; response: NextResponse };

export function createTwilioSignature(
  url: string,
  params: Record<string, string>,
  authToken: string
): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((accumulator, key) => `${accumulator}${key}${params[key]}`, url);

  return createHmac("sha1", authToken).update(payload).digest("base64");
}

export function validateTwilioSignature({
  url,
  params,
  signature,
  authToken
}: {
  url: string;
  params: Record<string, string>;
  signature: string;
  authToken: string;
}): boolean {
  const expected = createTwilioSignature(url, params, authToken);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function verifyTwilioRequestSignature(
  request: NextRequest,
  params: Record<string, string>
): TwilioSignatureVerification {
  const config = getAppConfig();

  if (!config.webhookSignatureRequired) {
    return { ok: true, required: false, bypassed: true };
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    return signatureFailure("twilio_auth_token_not_configured");
  }

  const signature = request.headers.get(SIGNATURE_HEADER);
  if (!signature) {
    return signatureFailure("missing_twilio_signature");
  }

  const isValid = validateTwilioSignature({
    url: request.url,
    params,
    signature,
    authToken
  });

  if (!isValid) {
    return signatureFailure("invalid_twilio_signature");
  }

  return { ok: true, required: true, bypassed: false };
}

function signatureFailure(reason: string): TwilioSignatureVerification {
  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "twilio_signature_verification_failed",
        reason
      },
      { status: 403 }
    )
  };
}
