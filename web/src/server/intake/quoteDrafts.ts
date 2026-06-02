import { randomUUID } from "node:crypto";

import type { QuoteDraftRow, QuoteDraftStatus } from "@/server/db/schema";

export type QuoteDraftCreateInput = {
  business_id: string;
  customer_profile_id?: string | null;
  source_call_record_id?: string | null;
  service_requested?: string | null;
  job_address?: string | null;
  scope_notes?: string | null;
  timeline?: string | null;
  budget_hint?: string | null;
  estimated_amount?: number | null;
  status?: QuoteDraftStatus;
};

export interface QuoteDraftRepository {
  create(input: QuoteDraftCreateInput): Promise<QuoteDraftRow>;
  list(): Promise<QuoteDraftRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class InMemoryQuoteDraftRepository implements QuoteDraftRepository {
  private readonly quoteDrafts = new Map<string, QuoteDraftRow>();

  async create(input: QuoteDraftCreateInput): Promise<QuoteDraftRow> {
    const timestamp = nowIso();
    const quoteDraft: QuoteDraftRow = {
      id: randomUUID(),
      business_id: input.business_id,
      customer_profile_id: input.customer_profile_id ?? null,
      source_call_record_id: input.source_call_record_id ?? null,
      service_requested: input.service_requested ?? null,
      job_address: input.job_address ?? null,
      scope_notes: input.scope_notes ?? null,
      timeline: input.timeline ?? null,
      budget_hint: input.budget_hint ?? null,
      estimated_amount: input.estimated_amount ?? null,
      status: input.status ?? "draft",
      created_at: timestamp,
      updated_at: timestamp
    };

    this.quoteDrafts.set(quoteDraft.id, quoteDraft);
    return quoteDraft;
  }

  async list(): Promise<QuoteDraftRow[]> {
    return Array.from(this.quoteDrafts.values());
  }
}
