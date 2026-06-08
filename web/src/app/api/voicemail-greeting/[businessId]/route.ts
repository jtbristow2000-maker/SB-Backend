import { NextRequest, NextResponse } from "next/server";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { VOICEMAIL_GREETING_CONTENT_TYPE } from "@/server/voicemailGreetings/repository";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await context.params;

  try {
    const intake = await getIntakeRuntime();
    const greeting = await intake.voicemailGreetingRepository.findByBusinessId(businessId);
    if (!greeting) {
      return NextResponse.json({ error: "voicemail_greeting_not_found" }, { status: 404 });
    }

    const body = new ArrayBuffer(greeting.bytes.byteLength);
    new Uint8Array(body).set(greeting.bytes);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": greeting.content_type || VOICEMAIL_GREETING_CONTENT_TYPE,
        "cache-control": "public, max-age=60"
      }
    });
  } catch {
    return NextResponse.json({ error: "voicemail_greeting_not_found" }, { status: 404 });
  }
}
