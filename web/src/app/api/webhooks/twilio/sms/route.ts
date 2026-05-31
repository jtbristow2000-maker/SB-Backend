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
  const result = await intake.smsIntakeService.handleInboundSms({
    from: form.From ?? "",
    to: form.To ?? "",
    body: form.Body,
    messageSid: form.MessageSid
  });

  const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  return new NextResponse(twiml, {
    status: result.status === "stored" ? 200 : 404,
    headers: {
      "content-type": "text/xml; charset=utf-8"
    }
  });
}
