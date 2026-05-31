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
  const result = await intake.voiceIntakeService.handleDialStatus({
    callSid: form.CallSid ?? "",
    dialCallStatus: form.DialCallStatus ?? ""
  });

  return new NextResponse(result.twiml, {
    status: result.status === "call_not_found" ? 404 : 200,
    headers: {
      "content-type": "text/xml; charset=utf-8"
    }
  });
}
