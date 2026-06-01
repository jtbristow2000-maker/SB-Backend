import { NextRequest, NextResponse } from "next/server";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { readVerifiedTwilioForm } from "@/server/webhooks/twilioForm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, "/api/webhooks/twilio/voice/status", async (logger) => {
    const verified = await readVerifiedTwilioForm(request);
    if (!verified.ok) {
      logger.setContext({ outcome: "twilio_signature_failed" });
      return verified.response;
    }

    const form = verified.payload;
    logger.setContext({ providerCallId: form.CallSid ?? null });

    const intake = await getIntakeRuntime();
    const result = await intake.voiceIntakeService.handleDialStatus({
      callSid: form.CallSid ?? "",
      dialCallStatus: form.DialCallStatus ?? ""
    });

    logger.setContext({
      businessId: result.callRecord?.business_id ?? null,
      outcome: result.status
    });

    return new NextResponse(result.twiml, {
      status: result.status === "call_not_found" ? 404 : 200,
      headers: {
        "content-type": "text/xml; charset=utf-8"
      }
    });
  });
}
