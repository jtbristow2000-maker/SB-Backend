import { NextRequest, NextResponse } from "next/server";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { readVerifiedTwilioForm } from "@/server/webhooks/twilioForm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const verified = await readVerifiedTwilioForm(request);
  if (!verified.ok) {
    return verified.response;
  }

  const form = verified.payload;
  const intake = await getIntakeRuntime();
  const result = await intake.voiceIntakeService.handleRecording({
    callSid: form.CallSid ?? "",
    recordingUrl: form.RecordingUrl,
    transcript: form.TranscriptionText
  });

  return NextResponse.json(
    {
      status: result.status,
      action: result.status === "updated" ? "recording_attached" : "call_not_found"
    },
    { status: result.status === "updated" ? 200 : 404 }
  );
}
