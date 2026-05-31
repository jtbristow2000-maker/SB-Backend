import { randomUUID } from "node:crypto";

import type { CallRecordRow, CallType, Direction, JsonValue } from "@/server/db/schema";

export type CallRecordCreateInput = {
  business_id: string;
  customer_profile_id?: string | null;
  provider?: string;
  provider_call_id?: string | null;
  direction: Direction;
  call_type: CallType;
  from_phone_e164?: string | null;
  to_phone_e164?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  transcript?: string | null;
  ai_summary?: string | null;
  extracted_json?: JsonValue;
  needs_review?: boolean;
};

export interface CallRecordRepository {
  create(input: CallRecordCreateInput): Promise<CallRecordRow>;
  findByProviderCallId(businessId: string, providerCallId: string): Promise<CallRecordRow | null>;
  list(): Promise<CallRecordRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryCallRecordRepository implements CallRecordRepository {
  private readonly calls = new Map<string, CallRecordRow>();

  async create(input: CallRecordCreateInput): Promise<CallRecordRow> {
    const timestamp = nowIso();
    const call: CallRecordRow = {
      id: randomUUID(),
      business_id: input.business_id,
      customer_profile_id: input.customer_profile_id ?? null,
      provider: input.provider ?? "sandbox",
      provider_call_id: input.provider_call_id ?? null,
      direction: input.direction,
      call_type: input.call_type,
      from_phone_e164: input.from_phone_e164 ?? null,
      to_phone_e164: input.to_phone_e164 ?? null,
      started_at: input.started_at ?? timestamp,
      ended_at: input.ended_at ?? null,
      duration_seconds: input.duration_seconds ?? null,
      recording_url: input.recording_url ?? null,
      transcript: input.transcript ?? null,
      ai_summary: input.ai_summary ?? null,
      extracted_json: input.extracted_json ?? {},
      needs_review: input.needs_review ?? false,
      created_at: timestamp,
      updated_at: timestamp
    };

    this.calls.set(call.id, call);
    return call;
  }

  async findByProviderCallId(
    businessId: string,
    providerCallId: string
  ): Promise<CallRecordRow | null> {
    return (
      Array.from(this.calls.values()).find(
        (call) => call.business_id === businessId && call.provider_call_id === providerCallId
      ) ?? null
    );
  }

  async list(): Promise<CallRecordRow[]> {
    return Array.from(this.calls.values());
  }
}
