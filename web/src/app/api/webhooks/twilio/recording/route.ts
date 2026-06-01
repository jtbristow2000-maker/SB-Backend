import { NextRequest, NextResponse } from "next/server";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { readVerifiedTwilioForm } from "@/server/webhooks/twilioForm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, "/api/webhooks/twilio/recording", async (logger) => {
    const verified = await readVerifiedTwilioForm(request);
    if (!verified.ok) {
      logger.setContext({ outcome: "twilio_signature_failed" });
      return verified.response;
    }

    const form = verified.payload;
    logger.setContext({ providerCallId: form.CallSid ?? null });

    const intake = await getIntakeRuntime();
    const result = await intake.voiceIntakeService.handleRecording({
      callSid: form.CallSid ?? "",
      recordingUrl: form.RecordingUrl,
      transcript: form.TranscriptionText
    });

    logger.setContext({
      businessId: result.callRecord?.business_id ?? null,
      outcome: result.status
    });

    return NextResponse.json(
      {
        status: result.status,
        action: result.status === "updated" ? "recording_attached" : "call_not_found"
      },
      { status: result.status === "updated" ? 200 : 404 }
    );
  });
}
