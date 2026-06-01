import { NextRequest, NextResponse } from "next/server";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { withRequestLogging } from "@/server/observability/requestLogging";
import { readVerifiedTwilioForm } from "@/server/webhooks/twilioForm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, "/api/webhooks/twilio/sms", async (logger) => {
    const verified = await readVerifiedTwilioForm(request);
    if (!verified.ok) {
      logger.setContext({ outcome: "twilio_signature_failed" });
      return verified.response;
    }

    const form = verified.payload;
    logger.setContext({ providerMessageId: form.MessageSid ?? null });

    const intake = await getIntakeRuntime();
    const result = await intake.smsIntakeService.handleInboundSms({
      from: form.From ?? "",
      to: form.To ?? "",
      body: form.Body,
      messageSid: form.MessageSid
    });

    logger.setContext({
      businessId: result.message?.business_id ?? null,
      outcome: result.status
    });

    const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    return new NextResponse(twiml, {
      status: result.status === "stored" ? 200 : 404,
      headers: {
        "content-type": "text/xml; charset=utf-8"
      }
    });
  });
}
