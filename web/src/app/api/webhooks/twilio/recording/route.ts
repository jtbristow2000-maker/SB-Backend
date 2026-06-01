import { NextRequest } from "next/server";

import { handleRecordingWebhook } from "@/server/webhooks/twilioRecording";

export const runtime = "nodejs";

// Handles both Twilio recording-status callbacks and transcription callbacks.
// RecordingUrl can arrive seconds after hangup; TranscriptionText can arrive minutes later.
export async function POST(request: NextRequest) {
  return handleRecordingWebhook(request);
}
