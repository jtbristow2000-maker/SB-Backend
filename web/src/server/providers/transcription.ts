import type { TranscriptionInput, TranscriptionProvider, TranscriptionResult } from "./types";

const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";
const DEFAULT_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const DEFAULT_TIMEOUT_MS = 10000;

type OpenAiTranscriptionResponse = {
  text?: string;
};

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  readonly providerName = "openai";

  constructor(
    private readonly input: {
      apiKey: string;
      twilioAccountSid?: string | null;
      twilioAuthToken?: string | null;
      model?: string;
      timeoutMs?: number;
      fetchImpl?: typeof fetch;
    }
  ) {}

  async transcribeRecording(input: TranscriptionInput): Promise<TranscriptionResult> {
    if (!this.input.twilioAccountSid || !this.input.twilioAuthToken) {
      throw new Error("Twilio credentials are required to fetch recording media.");
    }

    const fetchImpl = this.input.fetchImpl ?? fetch;
    const audioBytes = await this.fetchTwilioRecording(input.recordingUrl, fetchImpl);
    const transcript = await this.transcribeAudio(audioBytes, fetchImpl);

    return {
      provider: this.providerName,
      status: "completed",
      action: "transcription.openai.completed",
      networkCallsMade: true,
      transcript,
      confidence: null
    };
  }

  private async fetchTwilioRecording(
    recordingUrl: string,
    fetchImpl: typeof fetch
  ): Promise<ArrayBuffer> {
    const response = await withTimeout(
      this.input.timeoutMs,
      (signal) =>
        fetchImpl(toTwilioMediaUrl(recordingUrl), {
          headers: {
            authorization: buildBasicAuthHeader(
              this.input.twilioAccountSid ?? "",
              this.input.twilioAuthToken ?? ""
            )
          },
          signal
        })
    );

    if (!response.ok) {
      throw new Error(`Twilio recording fetch failed with HTTP ${response.status}`);
    }

    return response.arrayBuffer();
  }

  private async transcribeAudio(
    audioBytes: ArrayBuffer,
    fetchImpl: typeof fetch
  ): Promise<string | null> {
    const formData = new FormData();
    formData.append("model", this.input.model ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? DEFAULT_TRANSCRIPTION_MODEL);
    formData.append("response_format", "json");
    formData.append("file", new Blob([audioBytes], { type: "audio/mpeg" }), "voicemail.mp3");

    const response = await withTimeout(
      this.input.timeoutMs,
      (signal) =>
        fetchImpl(OPENAI_TRANSCRIPTIONS_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${this.input.apiKey}`
          },
          body: formData,
          signal
        })
    );

    if (!response.ok) {
      throw new Error(`OpenAI transcription failed with HTTP ${response.status}`);
    }

    const body = (await response.json()) as OpenAiTranscriptionResponse;
    return typeof body.text === "string" && body.text.trim() ? body.text.trim() : null;
  }
}

export function toTwilioMediaUrl(recordingUrl: string): string {
  const trimmed = recordingUrl.trim();
  return /\.(mp3|wav)$/i.test(trimmed) ? trimmed : `${trimmed}.mp3`;
}

function buildBasicAuthHeader(accountSid: string, authToken: string): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function withTimeout<T>(
  timeoutMs: number | undefined,
  callback: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
