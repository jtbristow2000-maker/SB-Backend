function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export type AppConfig = {
  appBaseUrl: string;
  environment: string;
  sandboxMode: boolean;
  realMessageSendingEnabled: boolean;
  realCallAutomationEnabled: boolean;
  supabaseConfigured: boolean;
  twilioConfigured: boolean;
  openAiConfigured: boolean;
};

export function getAppConfig(): AppConfig {
  return {
    appBaseUrl:
      process.env.APP_BASE_URL ??
      process.env.NEXT_PUBLIC_APP_BASE_URL ??
      "http://localhost:3000",
    environment: process.env.NODE_ENV ?? "development",
    sandboxMode: readBoolean("SANDBOX_MODE", true),
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
