import { NextRequest, NextResponse } from "next/server";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { readTwilioForm } from "@/server/webhooks/twilioForm";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await readTwilioForm(request);
  const intake = await getIntakeRuntime();
  const result = await intake.voiceIntakeService.handleIncomingVoice({
    from: form.From ?? "",
    to: form.To ?? "",
    callSid: form.CallSid
  });

  return new NextResponse(result.twiml, {
    status: result.status === "dial" ? 200 : 404,
    headers: {
      "content-type": "text/xml; charset=utf-8"
    }
  });
}
