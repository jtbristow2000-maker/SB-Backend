import { NextResponse } from "next/server";

import { getAppConfig } from "@/server/config";

export const runtime = "nodejs";

export async function GET() {
  const config = getAppConfig();

  return NextResponse.json({
    status: "ok",
    service: "SB Web API",
    environment: config.environment,
    sandboxMode: config.sandboxMode,
    realMessageSendingEnabled: config.realMessageSendingEnabled,
    realCallAutomationEnabled: config.realCallAutomationEnabled,
    supabaseConfigured: config.supabaseConfigured,
    twilioConfigured: config.twilioConfigured,
    openAiConfigured: config.openAiConfigured
  });
}
