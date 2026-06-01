import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppConfig } from "@/server/config";
import { getSupabaseServerClient } from "@/server/db/supabaseClient";
import type { Database } from "@/server/db/schema";

export type DeepHealthPayload = {
  status: "ok" | "degraded";
  service: "SB Web API";
  environment: string;
  persistence: {
    mode: "memory" | "supabase";
    supabase: {
      configured: boolean;
      status: "not_applicable" | "ok" | "failed";
      businessesCount: number | null;
    };
  };
  providers: {
    sms: "sandbox";
    calls: "sandbox";
    transcription: "sandbox";
    storage: "sandbox";
  };
  safetyFlags: {
    sandboxMode: boolean;
    smsSendingEnabled: boolean;
    callForwardingEnabled: boolean;
    webhookSignatureRequired: boolean;
    realMessageSendingEnabled: boolean;
    realCallAutomationEnabled: boolean;
  };
  integrations: {
    apiKeyConfigured: boolean;
    supabaseConfigured: boolean;
    twilioConfigured: boolean;
    openAiConfigured: boolean;
    sentryConfigured: boolean;
  };
};

export async function buildDeepHealthPayload(input: {
  supabaseClient?: SupabaseClient<Database>;
} = {}): Promise<DeepHealthPayload> {
  const config = getAppConfig();
  const supabase = await checkSupabase(config.persistence, input.supabaseClient);
  const status = config.persistence === "supabase" && supabase.status !== "ok" ? "degraded" : "ok";

  return {
    status,
    service: "SB Web API",
    environment: config.environment,
    persistence: {
      mode: config.persistence,
      supabase
    },
    providers: {
      sms: "sandbox",
      calls: "sandbox",
      transcription: "sandbox",
      storage: "sandbox"
    },
    safetyFlags: {
      sandboxMode: config.sandboxMode,
      smsSendingEnabled: config.smsSendingEnabled,
      callForwardingEnabled: config.callForwardingEnabled,
      webhookSignatureRequired: config.webhookSignatureRequired,
      realMessageSendingEnabled: config.realMessageSendingEnabled,
      realCallAutomationEnabled: config.realCallAutomationEnabled
    },
    integrations: {
      apiKeyConfigured: config.apiKeyConfigured,
      supabaseConfigured: config.supabaseConfigured,
      twilioConfigured: config.twilioConfigured,
      openAiConfigured: config.openAiConfigured,
      sentryConfigured: config.sentryConfigured
    }
  };
}

async function checkSupabase(
  persistence: "memory" | "supabase",
  injectedClient?: SupabaseClient<Database>
): Promise<DeepHealthPayload["persistence"]["supabase"]> {
  const configured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (persistence !== "supabase") {
    return {
      configured,
      status: "not_applicable",
      businessesCount: null
    };
  }

  if (!configured) {
    return {
      configured: false,
      status: "failed",
      businessesCount: null
    };
  }

  try {
    const client = injectedClient ?? getSupabaseServerClient();
    const { count, error } = await client
      .from("businesses")
      .select("id", { count: "exact", head: true });

    if (error) {
      return {
        configured: true,
        status: "failed",
        businessesCount: null
      };
    }

    return {
      configured: true,
      status: "ok",
      businessesCount: count ?? 0
    };
  } catch {
    return {
      configured: true,
      status: "failed",
      businessesCount: null
    };
  }
}
