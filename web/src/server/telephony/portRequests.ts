import { randomUUID } from "node:crypto";

import type { NumberPortRequestRow, NumberPortRequestStatus } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";

export type NumberPortRequestCreateInput = {
  business_id: string;
  current_number_e164: string;
  current_carrier?: string | null;
  account_number?: string | null;
  account_pin?: string | null;
  billing_name?: string | null;
  billing_address?: string | null;
  loa_signed_at?: string | null;
  bill_uploaded?: boolean;
  status?: NumberPortRequestStatus;
};

export type NumberPortRequestUpdateInput = Partial<
  Omit<NumberPortRequestRow, "id" | "business_id" | "created_at">
>;

export interface NumberPortRequestRepository {
  create(input: NumberPortRequestCreateInput): Promise<NumberPortRequestRow>;
  update(id: string, input: NumberPortRequestUpdateInput): Promise<NumberPortRequestRow>;
  findById(id: string): Promise<NumberPortRequestRow | null>;
  findLatestByBusinessId(businessId: string): Promise<NumberPortRequestRow | null>;
  list(): Promise<NumberPortRequestRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cleanOptional(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePortRequestInput(
  input: NumberPortRequestCreateInput
): NumberPortRequestCreateInput {
  return {
    ...input,
    current_number_e164: normalizePhoneNumber(input.current_number_e164),
    current_carrier: cleanOptional(input.current_carrier),
    account_number: cleanOptional(input.account_number),
    account_pin: cleanOptional(input.account_pin),
    billing_name: cleanOptional(input.billing_name),
    billing_address: cleanOptional(input.billing_address),
    loa_signed_at: cleanOptional(input.loa_signed_at)
  };
}

export class InMemoryNumberPortRequestRepository implements NumberPortRequestRepository {
  private readonly requests = new Map<string, NumberPortRequestRow>();

  async create(input: NumberPortRequestCreateInput): Promise<NumberPortRequestRow> {
    const normalized = normalizePortRequestInput(input);
    const request: NumberPortRequestRow = {
      id: randomUUID(),
      business_id: normalized.business_id,
      current_number_e164: normalized.current_number_e164,
      current_carrier: normalized.current_carrier ?? null,
      account_number: normalized.account_number ?? null,
      account_pin: normalized.account_pin ?? null,
      billing_name: normalized.billing_name ?? null,
      billing_address: normalized.billing_address ?? null,
      loa_signed_at: normalized.loa_signed_at ?? null,
      bill_uploaded: normalized.bill_uploaded ?? false,
      status: normalized.status ?? "collecting",
      created_at: nowIso()
    };

    this.requests.set(request.id, request);
    return request;
  }

  async update(
    id: string,
    input: NumberPortRequestUpdateInput
  ): Promise<NumberPortRequestRow> {
    const existing = this.requests.get(id);
    if (!existing) {
      throw new Error(`Number port request ${id} was not found.`);
    }

    const updated: NumberPortRequestRow = {
      ...existing,
      ...input,
      current_number_e164:
        input.current_number_e164 === undefined
          ? existing.current_number_e164
          : normalizePhoneNumber(input.current_number_e164),
      current_carrier:
        input.current_carrier === undefined ? existing.current_carrier : cleanOptional(input.current_carrier),
      account_number:
        input.account_number === undefined ? existing.account_number : cleanOptional(input.account_number),
      account_pin: input.account_pin === undefined ? existing.account_pin : cleanOptional(input.account_pin),
      billing_name:
        input.billing_name === undefined ? existing.billing_name : cleanOptional(input.billing_name),
      billing_address:
        input.billing_address === undefined
          ? existing.billing_address
          : cleanOptional(input.billing_address),
      loa_signed_at:
        input.loa_signed_at === undefined ? existing.loa_signed_at : cleanOptional(input.loa_signed_at)
    };

    this.requests.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<NumberPortRequestRow | null> {
    return this.requests.get(id) ?? null;
  }

  async findLatestByBusinessId(businessId: string): Promise<NumberPortRequestRow | null> {
    return (
      Array.from(this.requests.values())
        .filter((request) => request.business_id === businessId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null
    );
  }

  async list(): Promise<NumberPortRequestRow[]> {
    return Array.from(this.requests.values());
  }
}
