import { NextRequest } from "next/server";

import { handleIncomingSmsWebhook } from "@/server/webhooks/twilio";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleIncomingSmsWebhook(request);
}
