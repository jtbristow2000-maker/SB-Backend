import { NextRequest, NextResponse } from "next/server";

import { requireApiKey } from "@/server/auth/apiKey";
import { getAppConfig } from "@/server/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const authError = requireApiKey(request);
  if (authError) {
    return authError;
  }

  const config = getAppConfig();

  return NextResponse.json({
    status: "ok",
    service: "SB Web API",
    environment: config.environment,
    sandboxMode: config.sandboxMode,
    apiKeyConfigured: config.apiKeyConfigured,
    smsSendingEnabled: config.smsSendingEnabled,
    callForwardingEnabled: config.callForwardingEnabled,
    realMessageSendingEnabled: config.realMessageSendingEnabled,
    realCallAutomationEnabled: config.realCallAutomationEnabled,
    supabaseConfigured: config.supabaseConfigured,
    twilioConfigured: config.twilioConfigured,
    openAiConfigured: config.openAiConfigured
  });
}
