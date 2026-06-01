import type {
  ExtractionProvider,
  VoicemailExtractionInput,
  VoicemailExtractionResult
} from "./types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 8000;

type AnthropicMessageResponse = {
  content?: Array<{ type?: string; text?: string }>;
};

export class AnthropicExtractionProvider implements ExtractionProvider {
  readonly providerName = "anthropic";

  constructor(
    private readonly input: {
      apiKey: string;
      model?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async extractVoicemailDetails(
    input: VoicemailExtractionInput
  ): Promise<VoicemailExtractionResult | null> {
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
          model: this.input.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL,
          max_tokens: 400,
          temperature: 0,
          system:
            "Extract voicemail details for a small local service business. Return only strict JSON.",
          messages: [
            {
              role: "user",
              content: buildExtractionPrompt(input)
            }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Anthropic extraction failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as AnthropicMessageResponse;
      const text = body.content?.find((item) => item.type === "text" && item.text)?.text ?? "";
      return parseExtractionJson(text);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function buildExtractionPrompt(input: VoicemailExtractionInput): string {
  return [
    "Return JSON with exactly these keys:",
    '{ "caller_name": string|null, "requested_datetime": string|null, "service_requested": string|null, "summary": string|null }',
    "",
    "Rules:",
    "- Use null when a detail is not stated.",
    "- requested_datetime should preserve relative language if no exact date is known, e.g. \"Saturday\".",
    "- summary must be one short plain-English sentence for the business owner.",
    "- Do not invent names, dates, services, addresses, prices, or commitments.",
    "",
    `Business timezone: ${input.timezone ?? "unknown"}`,
    `Voicemail transcript: ${input.transcript}`
  ].join("\n");
}

export function parseExtractionJson(text: string): VoicemailExtractionResult | null {
  const jsonText = extractJsonObject(text);
  if (!jsonText) {
    return null;
  }

  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  return {
    caller_name: stringOrNull(parsed.caller_name),
    requested_datetime: stringOrNull(parsed.requested_datetime),
    service_requested: stringOrNull(parsed.service_requested),
    summary: stringOrNull(parsed.summary)
  };
}

function extractJsonObject(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
