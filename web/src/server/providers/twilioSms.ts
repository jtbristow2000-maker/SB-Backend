import type { InboundSmsInput, ProviderActionResult, SmsProvider, SmsSendInput } from "./types";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";
const DEFAULT_TIMEOUT_MS = 8000;

// Real outbound SMS via Twilio's Messages API. Inbound is handled separately by the
// webhook → SmsIntakeService, so recordInboundMessage is a no-op here.
export class TwilioSmsProvider implements SmsProvider {
  readonly providerName = "twilio";

  constructor(
    private readonly input: {
      accountSid: string;
      authToken: string;
      fromNumber?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async sendMessage(input: SmsSendInput): Promise<ProviderActionResult> {
    const from = input.from || this.input.fromNumber;
    if (!from) {
      throw new Error("Twilio SMS: no from number configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const form = new URLSearchParams({ To: input.to, From: from, Body: input.body });
      const auth = Buffer.from(`${this.input.accountSid}:${this.input.authToken}`).toString("base64");
      const response = await (this.input.fetchImpl ?? fetch)(
        `${TWILIO_API_BASE}/Accounts/${this.input.accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            authorization: `Basic ${auth}`,
            "content-type": "application/x-www-form-urlencoded"
          },
          body: form.toString(),
          signal: controller.signal
        }
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(`Twilio SMS send failed with HTTP ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
      }

      return { provider: "twilio", status: "completed", action: "sms.send", networkCallsMade: true };
    } finally {
      clearTimeout(timeout);
    }
  }

  async recordInboundMessage(_input: InboundSmsInput): Promise<ProviderActionResult> {
    return { provider: "twilio", status: "skipped", action: "sms.inbound.noop", networkCallsMade: false };
  }
}
