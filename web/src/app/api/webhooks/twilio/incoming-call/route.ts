import { NextRequest } from "next/server";

import { handleIncomingCallWebhook } from "@/server/webhooks/twilio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleIncomingCallWebhook(request);
}
