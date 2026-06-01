import type {
  ExtractionProvider,
  VoicemailExtractionInput,
  VoicemailExtractionResult
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
          model: this.input.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
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

export class OpenAIExtractionProvider implements ExtractionProvider {
  readonly providerName = "openai";

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
      const response = await (this.input.fetchImpl ?? fetch)(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.input.apiKey}`
        },
        body: JSON.stringify({
          model: this.input.model ?? process.env.OPENAI_EXTRACTION_MODEL ?? DEFAULT_OPENAI_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Extract voicemail details for a small local service business. Return only strict JSON."
            },
            {
              role: "user",
              content: buildExtractionPrompt(input)
            }
          ]
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`OpenAI extraction failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as OpenAIChatCompletionResponse;
      const text = body.choices?.[0]?.message?.content ?? "";
      return parseExtractionJson(text);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function buildExtractionPrompt(input: VoicemailExtractionInput): string {
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

// ---------------------------------------------------------------------------
// Service matching — given a voicemail transcript and the business's exact
// service menu, let the model pick which menu item(s) the caller actually needs
// (judging severity, damage, vehicle), rather than brittle keyword rules.
// Returns only names that exist in the provided menu.
// ---------------------------------------------------------------------------

export function buildServiceMatchPrompt(transcript: string, serviceNames: string[]): string {
  return [
    "A customer left this voicemail for a local service business:",
    `"""${transcript}"""`,
    "",
    "The business offers exactly these services (use these EXACT names):",
    serviceNames.map((n) => `- ${n}`).join("\n"),
    "",
    "Pick the 1-3 services that best match what the caller needs. Guidance:",
    "- Judge severity: a very dirty / messy / trashed vehicle needs a FULL detail, not a light one.",
    "- Add any specialty service that fits the described problem (e.g. blood, feathers, spills, mud, vomit, sap → a stain-removal service; heavy pet/dog hair → a pet-hair service).",
    "- If the vehicle type (sedan / SUV / midsize) is not clearly stated, choose the sedan option.",
    "- Only choose from the list above, by their exact names. Do not invent services.",
    "",
    'Return strict JSON: { "services": string[] }'
  ].join("\n");
}

export async function recommendServicesFromTranscript(input: {
  transcript: string;
  serviceNames: string[];
  provider: "anthropic" | "openai";
  apiKey: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<string[]> {
  if (!input.transcript.trim() || input.serviceNames.length === 0) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const prompt = buildServiceMatchPrompt(input.transcript, input.serviceNames);
  const system = "You match a caller's request to a fixed service menu. Return only strict JSON.";

  try {
    let text = "";
    if (input.provider === "anthropic") {
      const response = await (input.fetchImpl ?? fetch)(ANTHROPIC_MESSAGES_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": input.apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: input.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
          max_tokens: 200,
          temperature: 0,
          system,
          messages: [{ role: "user", content: prompt }]
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Anthropic service match failed with HTTP ${response.status}`);
      const body = (await response.json()) as AnthropicMessageResponse;
      text = body.content?.find((item) => item.type === "text" && item.text)?.text ?? "";
    } else {
      const response = await (input.fetchImpl ?? fetch)(OPENAI_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${input.apiKey}`
        },
        body: JSON.stringify({
          model: input.model ?? process.env.OPENAI_EXTRACTION_MODEL ?? DEFAULT_OPENAI_MODEL,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt }
          ]
        }),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`OpenAI service match failed with HTTP ${response.status}`);
      const body = (await response.json()) as OpenAIChatCompletionResponse;
      text = body.choices?.[0]?.message?.content ?? "";
    }
    return parseServiceNames(text, input.serviceNames);
  } finally {
    clearTimeout(timeout);
  }
}

function parseServiceNames(text: string, allowed: string[]): string[] {
  const jsonText = extractJsonObject(text);
  if (!jsonText) return [];
  try {
    const parsed = JSON.parse(jsonText) as { services?: unknown };
    if (!Array.isArray(parsed.services)) return [];
    const byLower = new Map(allowed.map((n) => [n.trim().toLowerCase(), n]));
    const out: string[] = [];
    for (const candidate of parsed.services) {
      if (typeof candidate !== "string") continue;
      const canonical = byLower.get(candidate.trim().toLowerCase());
      if (canonical && !out.includes(canonical)) out.push(canonical);
    }
    return out;
  } catch {
    return [];
  }
}
