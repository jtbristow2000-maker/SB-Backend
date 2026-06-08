export const VOICEMAIL_GREETING_CONTENT_TYPE = "audio/wav";
export const MAX_VOICEMAIL_GREETING_BYTES = 1024 * 1024;

export type VoicemailGreetingAudio = {
  business_id: string;
  bytes: Uint8Array;
  content_type: typeof VOICEMAIL_GREETING_CONTENT_TYPE;
  created_at: string;
  updated_at: string;
};

export interface VoicemailGreetingRepository {
  findByBusinessId(businessId: string): Promise<VoicemailGreetingAudio | null>;
  upsert(input: {
    businessId: string;
    bytes: Uint8Array;
    contentType?: typeof VOICEMAIL_GREETING_CONTENT_TYPE;
  }): Promise<VoicemailGreetingAudio>;
  deleteByBusinessId(businessId: string): Promise<void>;
}

export type VoicemailGreetingValidationResult =
  | { ok: true; bytes: Uint8Array; contentType: typeof VOICEMAIL_GREETING_CONTENT_TYPE }
  | { ok: false; error: "invalid_base64" | "file_too_large" | "invalid_wav" };

export class InMemoryVoicemailGreetingRepository implements VoicemailGreetingRepository {
  private readonly greetings = new Map<string, VoicemailGreetingAudio>();

  async findByBusinessId(businessId: string): Promise<VoicemailGreetingAudio | null> {
    return this.greetings.get(businessId) ?? null;
  }

  async upsert(input: {
    businessId: string;
    bytes: Uint8Array;
    contentType?: typeof VOICEMAIL_GREETING_CONTENT_TYPE;
  }): Promise<VoicemailGreetingAudio> {
    const now = new Date().toISOString();
    const existing = this.greetings.get(input.businessId);
    const row: VoicemailGreetingAudio = {
      business_id: input.businessId,
      bytes: copyBytes(input.bytes),
      content_type: input.contentType ?? VOICEMAIL_GREETING_CONTENT_TYPE,
      created_at: existing?.created_at ?? now,
      updated_at: now
    };
    this.greetings.set(input.businessId, row);
    return { ...row, bytes: copyBytes(row.bytes) };
  }

  async deleteByBusinessId(businessId: string): Promise<void> {
    this.greetings.delete(businessId);
  }
}

export function validateVoicemailGreetingWav(
  base64Wav: string
): VoicemailGreetingValidationResult {
  const normalized = stripDataUrlPrefix(base64Wav).trim();
  if (!normalized) {
    return { ok: false, error: "invalid_base64" };
  }

  let bytes: Uint8Array;
  try {
    bytes = Buffer.from(normalized, "base64");
  } catch {
    return { ok: false, error: "invalid_base64" };
  }

  if (bytes.byteLength > MAX_VOICEMAIL_GREETING_BYTES) {
    return { ok: false, error: "file_too_large" };
  }

  if (!isWav(bytes)) {
    return { ok: false, error: "invalid_wav" };
  }

  return {
    ok: true,
    bytes,
    contentType: VOICEMAIL_GREETING_CONTENT_TYPE
  };
}

function stripDataUrlPrefix(value: string): string {
  const commaIndex = value.indexOf(",");
  if (/^data:audio\/(?:wav|wave|x-wav);base64,/i.test(value.slice(0, commaIndex + 1))) {
    return value.slice(commaIndex + 1);
  }
  return value;
}

function isWav(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) {
    return false;
  }

  return (
    ascii(bytes, 0, 4) === "RIFF" &&
    ascii(bytes, 8, 12) === "WAVE" &&
    bytes.byteLength >= riffDeclaredSize(bytes)
  );
}

function riffDeclaredSize(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(4, true) + 8;
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}
