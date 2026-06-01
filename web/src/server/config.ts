function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export type AppConfig = {
  appBaseUrl: string;
  apiKeyConfigured: boolean;
  environment: string;
  persistence: "memory" | "supabase";
  sandboxMode: boolean;
  webhookSignatureRequired: boolean;
  smsSendingEnabled: boolean;
  callForwardingEnabled: boolean;
  realMessageSendingEnabled: boolean;
  realCallAutomationEnabled: boolean;
  supabaseConfigured: boolean;
  twilioConfigured: boolean;
  openAiConfigured: boolean;
};

export function getAppConfig(): AppConfig {
  const persistence = process.env.PERSISTENCE === "supabase" ? "supabase" : "memory";

  return {
    appBaseUrl:
      process.env.APP_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_BASE_URL ??
      "http://localhost:3000",
    apiKeyConfigured: Boolean(process.env.API_KEY),
    environment: process.env.NODE_ENV ?? "development",
    persistence,
    sandboxMode: readBoolean("SANDBOX_MODE", true),
    webhookSignatureRequired: readBoolean("WEBHOOK_SIGNATURE_REQUIRED", false),
    smsSendingEnabled: readBoolean("SMS_SENDING_ENABLED", false),
    callForwardingEnabled: readBoolean("CALL_FORWARDING_ENABLED", false),
    realMessageSendingEnabled: readBoolean("REAL_MESSAGE_SENDING_ENABLED", false),
    realCallAutomationEnabled: readBoolean("REAL_CALL_AUTOMATION_ENABLED", false),
    supabaseConfigured: Boolean(
      process.env.SUPABASE_URL ??
        process.env.NEXT_PUBLIC_SUPABASE_URL ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ),
    twilioConfigured: Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_PHONE_NUMBER
    ),
    openAiConfigured: Boolean(process.env.OPENAI_API_KEY)
  };
}
