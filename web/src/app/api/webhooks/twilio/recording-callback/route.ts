import { NextRequest } from "next/server";

import { handleRecordingWebhook } from "@/server/webhooks/twilioRecording";

export const runtime = "nodejs";

// Legacy alias kept for older tunnel/Twilio configs. New TwiML points to /recording.
export async function POST(request: NextRequest) {
  return handleRecordingWebhook(request, "/api/webhooks/twilio/recording-callback");
}
