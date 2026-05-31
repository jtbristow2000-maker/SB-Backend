import { NextRequest } from "next/server";

import { handleRecordingCallbackWebhook } from "@/server/webhooks/twilio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleRecordingCallbackWebhook(request);
}
