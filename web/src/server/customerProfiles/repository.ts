import { randomUUID } from "node:crypto";

import type { CustomerProfileRow } from "@/server/db/schema";

export type CustomerProfileCreateInput = Omit<
  CustomerProfileRow,
  "id" | "created_at" | "updated_at"
>;

export type CustomerProfileUpdateInput = Partial<
  Omit<CustomerProfileRow, "id" | "business_id" | "phone_e164" | "created_at">
>;

export interface CustomerProfileRepository {
  findByBusinessAndPhone(businessId: string, phoneE164: string): Promise<CustomerProfileRow | null>;
  create(input: CustomerProfileCreateInput): Promise<CustomerProfileRow>;
  update(id: string, input: CustomerProfileUpdateInput): Promise<CustomerProfileRow>;
  list(): Promise<CustomerProfileRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function profileKey(businessId: string, phoneE164: string): string {
  return `${businessId}:${phoneE164}`;
}

export class DuplicateCustomerProfileError extends Error {
  constructor(businessId: string, phoneE164: string) {
    super(`Customer profile already exists for business ${businessId} and phone ${phoneE164}`);
    this.name = "DuplicateCustomerProfileError";
  }
}

export class CustomerProfileNotFoundError extends Error {
  constructor(id: string) {
    super(`Customer profile not found: ${id}`);
    this.name = "CustomerProfileNotFoundError";
  }
}

export class InMemoryCustomerProfileRepository implements CustomerProfileRepository {
  private readonly profilesById = new Map<string, CustomerProfileRow>();
  private readonly idsByBusinessPhone = new Map<string, string>();

  async findByBusinessAndPhone(businessId: string, phoneE164: string): Promise<CustomerProfileRow | null> {
    const id = this.idsByBusinessPhone.get(profileKey(businessId, phoneE164));
    return id ? this.profilesById.get(id) ?? null : null;
  }

  async create(input: CustomerProfileCreateInput): Promise<CustomerProfileRow> {
    if (input.phone_e164) {
      const key = profileKey(input.business_id, input.phone_e164);
      if (this.idsByBusinessPhone.has(key)) {
        throw new DuplicateCustomerProfileError(input.business_id, input.phone_e164);
      }
    }

    const timestamp = nowIso();
    const profile: CustomerProfileRow = {
      ...input,
      id: randomUUID(),
      created_at: timestamp,
      updated_at: timestamp
    };

    this.profilesById.set(profile.id, profile);
    if (profile.phone_e164) {
      this.idsByBusinessPhone.set(profileKey(profile.business_id, profile.phone_e164), profile.id);
    }

    return profile;
  }

  async update(id: string, input: CustomerProfileUpdateInput): Promise<CustomerProfileRow> {
    const existing = this.profilesById.get(id);
    if (!existing) {
      throw new CustomerProfileNotFoundError(id);
    }

    const updated: CustomerProfileRow = {
      ...existing,
      ...input,
      id: existing.id,
      business_id: existing.business_id,
      phone_e164: existing.phone_e164,
      created_at: existing.created_at,
      updated_at: nowIso()
    };

    this.profilesById.set(id, updated);
    return updated;
  }

  async list(): Promise<CustomerProfileRow[]> {
    return Array.from(this.profilesById.values());
  }
}
