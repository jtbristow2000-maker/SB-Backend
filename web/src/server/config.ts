function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function readString(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw ? raw : undefined;
}

export type AppConfig = {
  appBaseUrl: string;
  publicBaseUrl: string | null;
  apiKeyConfigured: boolean;
  environment: string;
  persistence: "memory" | "supabase";
  sandboxMode: boolean;
  webhookSignatureRequired: boolean;
  smsSendingEnabled: boolean;
  callForwardingEnabled: boolean;
  fastTranscriptionEnabled: boolean;
  realMessageSendingEnabled: boolean;
  realCallAutomationEnabled: boolean;
  supabaseConfigured: boolean;
  twilioConfigured: boolean;
  openAiConfigured: boolean;
  anthropicConfigured: boolean;
  aiExtractionEnabled: boolean;
  sentryConfigured: boolean;
};

export function getAppConfig(): AppConfig {
  const persistence = process.env.PERSISTENCE === "supabase" ? "supabase" : "memory";
  const publicBaseUrl =
    readString("PUBLIC_BASE_URL") ??
    readString("APP_BASE_URL") ??
    readString("NEXT_PUBLIC_APP_BASE_URL") ??
    null;

  return {
    appBaseUrl:
      publicBaseUrl ?? "http://localhost:3000",
    publicBaseUrl,
    apiKeyConfigured: Boolean(process.env.API_KEY),
    environment: process.env.NODE_ENV ?? "development",
    persistence,
    sandboxMode: readBoolean("SANDBOX_MODE", true),
    webhookSignatureRequired: readBoolean("WEBHOOK_SIGNATURE_REQUIRED", false),
    smsSendingEnabled: readBoolean("SMS_SENDING_ENABLED", false),
    callForwardingEnabled: readBoolean("CALL_FORWARDING_ENABLED", false),
    fastTranscriptionEnabled: readBoolean("FAST_TRANSCRIPTION_ENABLED", false),
    realMessageSendingEnabled: readBoolean("REAL_MESSAGE_SENDING_ENABLED", false),
    realCallAutomationEnabled: readBoolean("REAL_CALL_AUTOMATION_ENABLED", false),
    aiExtractionEnabled: readBoolean("AI_EXTRACTION_ENABLED", false),
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
    openAiConfigured: Boolean(readString("OPENAI_API_KEY")),
    anthropicConfigured: Boolean(readString("ANTHROPIC_API_KEY")),
    sentryConfigured: Boolean(process.env.SENTRY_DSN)
  };
}
