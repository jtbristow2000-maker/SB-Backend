import { NextRequest, NextResponse } from "next/server";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { readVerifiedTwilioForm } from "@/server/webhooks/twilioForm";

export async function handleRecordingWebhook(
  request: NextRequest,
  route = "/api/webhooks/twilio/recording"
): Promise<Response> {
  return withRequestLogging(request, route, async (logger) => {
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

    const callbackPhase = form.TranscriptionText ? "transcription_attached" : "recording_ready";
    logger.setContext({
      businessId: result.callRecord?.business_id ?? null,
      outcome: result.status === "updated" ? callbackPhase : result.status
    });

    return NextResponse.json(
      {
        status: result.status,
        action: result.status === "updated" ? callbackPhase : "call_not_found"
      },
      { status: result.status === "updated" ? 200 : 404 }
    );
  });
}
