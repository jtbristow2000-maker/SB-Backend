import type {
  AutoReplyInput,
  AutoReplyProvider,
  AutoReplyResult
} from "./types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const OPENAI_CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8000;

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export class AnthropicAutoReplyProvider implements AutoReplyProvider {
  readonly providerName = "anthropic";

  constructor(
    private readonly input: {
      apiKey: string;
      model?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async generateMissedCallReply(input: AutoReplyInput): Promise<AutoReplyResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.input.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await (this.input.fetchImpl ?? fetch)(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.input.apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: this.input.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
          max_tokens: 280,
          temperature: 0.3,
          system:
            "Write a concise SMS reply for a local service business. Return only the message text.",
          messages: [{ role: "user", content: buildAutoReplyPrompt(input) }]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Anthropic auto-reply failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as AnthropicMessageResponse;
      return completedReply(
        body.content?.find((item) => item.type === "text" && item.text)?.text ?? null,
        this.providerName
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}

export class OpenAIAutoReplyProvider implements AutoReplyProvider {
  readonly providerName = "openai";

  constructor(
    private readonly input: {
      apiKey: string;
      model?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async generateMissedCallReply(input: AutoReplyInput): Promise<AutoReplyResult> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.input.timeoutMs ?? DEFAULT_TIMEOUT_MS
    );

    try {
      const response = await (this.input.fetchImpl ?? fetch)(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.input.apiKey}`
        },
        body: JSON.stringify({
          model: this.input.model ?? process.env.OPENAI_REPLY_MODEL ?? DEFAULT_OPENAI_MODEL,
          temperature: 0.3,
          messages: [
            {
              role: "system",
              content:
                "Write a concise SMS reply for a local service business. Return only the message text."
            },
            { role: "user", content: buildAutoReplyPrompt(input) }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI auto-reply failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as OpenAIChatCompletionResponse;
      return completedReply(body.choices?.[0]?.message?.content ?? null, this.providerName);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildAutoReplyPrompt(input: AutoReplyInput): string {
  const includeService = input.level >= 2;
  const includeSlots = input.level >= 2;
  const includePrice = input.level >= 2 && Boolean(input.priceLabel);

  return [
    "Write one natural SMS reply to a missed-call voicemail.",
    "",
    "Hard rules:",
    "- Be human and concise. One SMS, about 320 characters or less.",
    "- Do not promise exact availability, final pricing, or completion until the owner confirms.",
    "- Never mention AI, automation, transcripts, settings, or internal levels.",
    "- Do not invent services, names, prices, or times.",
    "- Return only the SMS body, no JSON and no commentary.",
    "",
    `Business: ${input.businessName}`,
    `Caller name: ${input.customerName || "unknown"}`,
    `Reply level: ${input.level}`,
    `Tone formality 0-4: ${input.tone.formality}`,
    `Tone warmth 0-4: ${input.tone.warmth}`,
    `Sign off as: ${input.signOff || input.businessName}`,
    input.customNote ? `Append this owner note naturally: ${input.customNote}` : "Owner note: none",
    "",
    "Allowed content by level:",
    "- Level 1: warm greeting with caller name when known; acknowledge missed call only; no service, prices, or times.",
    "- Level 2: include service and a couple open times when provided; include price only if priceLabel is provided.",
    "- Level 3: include name, service, price if provided, and open times when provided.",
    "",
    `Include service details: ${includeService ? "yes" : "no"}`,
    `Service requested: ${includeService ? input.serviceRequested || "unknown" : "do not mention"}`,
    `Include price: ${includePrice ? "yes" : "no"}`,
    `Price label: ${includePrice ? input.priceLabel : "do not mention"}`,
    `Include open times: ${includeSlots ? "yes" : "no"}`,
    `Open times: ${includeSlots ? input.openSlots.slice(0, 2).join("; ") || "none" : "do not mention"}`,
    `Requested date/time: ${input.requestedDatetime || "unknown"}`,
    `Owner-facing summary: ${input.callerSummary || "none"}`,
    `Transcript: ${input.transcript || "none"}`
  ].join("\n");
}

function completedReply(body: string | null, provider: string): AutoReplyResult {
  return {
    provider,
    status: "completed",
    action: "ai.auto_reply.completed",
    networkCallsMade: true,
    body: cleanBody(body)
  };
}

function cleanBody(body: string | null): string | null {
  const trimmed = body?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/^["']|["']$/g, "").trim() || null;
}
