import type { BusinessRow, NumberStatus } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";

import type { BusinessSettingsUpdate } from "./settings";
import { mergeBusinessSettingsJson } from "./settings";

const DEFAULT_BUSINESS_ID = "00000000-0000-4000-8000-000000000001";

export type BusinessSeedInput = {
  id?: string;
  name: string;
  ownerName?: string | null;
  ownerPhone?: string | null;
  businessPhone?: string | null;
  twilioNumber?: string | null;
  twilioNumberSid?: string | null;
  numberStatus?: NumberStatus;
  numberTrialEndsAt?: string | null;
  timezone: string;
};

export type BusinessTelephonyUpdateInput = {
  twilioNumber?: string | null;
  twilioNumberSid?: string | null;
  numberStatus?: NumberStatus;
  numberTrialEndsAt?: string | null;
};

export interface BusinessRepository {
  findById(id: string): Promise<BusinessRow | null>;
  findByBusinessPhone(phoneE164: string): Promise<BusinessRow | null>;
  findByTwilioNumber(phoneE164: string): Promise<BusinessRow | null>;
  create(input: BusinessSeedInput & { id: string }): Promise<BusinessRow>;
  update(id: string, input: BusinessSeedInput): Promise<BusinessRow>;
  updateTelephony(id: string, input: BusinessTelephonyUpdateInput): Promise<BusinessRow>;
  updateSettings(id: string, partial: BusinessSettingsUpdate): Promise<BusinessRow>;
  list(): Promise<BusinessRow[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeOptionalPhone(phone?: string | null): string | null {
  return phone ? normalizePhoneNumber(phone) : null;
}

export function getBusinessSeedFromEnv(env: NodeJS.ProcessEnv = process.env): BusinessSeedInput & { id: string } {
  return {
    id: env.BUSINESS_ID || DEFAULT_BUSINESS_ID,
    name: env.BUSINESS_NAME || "Local Service Business",
    ownerName: env.OWNER_NAME || null,
    ownerPhone: env.OWNER_PHONE || null,
    businessPhone: env.BUSINESS_PHONE || null,
    twilioNumber: null,
    twilioNumberSid: null,
    numberStatus: "none",
    numberTrialEndsAt: null,
    timezone: env.TIMEZONE || "America/New_York"
  };
}

export async function bootstrapSingleTenantBusiness(
  repository: BusinessRepository,
  seed: BusinessSeedInput & { id: string } = getBusinessSeedFromEnv()
): Promise<BusinessRow> {
  const existing = await repository.findById(seed.id);
  if (existing) {
    return repository.update(seed.id, seed);
  }

  return repository.create(seed);
}

export class InMemoryBusinessRepository implements BusinessRepository {
  private readonly businesses = new Map<string, BusinessRow>();

  async findById(id: string): Promise<BusinessRow | null> {
    return this.businesses.get(id) ?? null;
  }

  async findByBusinessPhone(phoneE164: string): Promise<BusinessRow | null> {
    return (
      Array.from(this.businesses.values())
        .filter((business) => business.business_phone_e164 === phoneE164)
        .sort(compareBusinessesByUpdatedAt)[0] ?? null
    );
  }

  async findByTwilioNumber(phoneE164: string): Promise<BusinessRow | null> {
    return (
      Array.from(this.businesses.values()).find(
        (business) => business.twilio_number_e164 === phoneE164
      ) ?? null
    );
  }

  async create(input: BusinessSeedInput & { id: string }): Promise<BusinessRow> {
    const timestamp = nowIso();
    const business: BusinessRow = {
      id: input.id,
      name: input.name,
      owner_name: input.ownerName ?? null,
      owner_phone_e164: normalizeOptionalPhone(input.ownerPhone),
      business_phone_e164: normalizeOptionalPhone(input.businessPhone),
      twilio_number_e164: normalizeOptionalPhone(input.twilioNumber),
      twilio_number_sid: input.twilioNumberSid ?? null,
      number_status: input.numberStatus ?? "none",
      number_trial_ends_at: input.numberTrialEndsAt ?? null,
      timezone: input.timezone,
      settings_json: {},
      created_at: timestamp,
      updated_at: timestamp
    };

    this.businesses.set(input.id, business);
    return business;
  }

  async update(id: string, input: BusinessSeedInput): Promise<BusinessRow> {
    const existing = this.businesses.get(id);
    if (!existing) {
      return this.create({ ...input, id });
    }

    const updated: BusinessRow = {
      ...existing,
      name: input.name,
      owner_name: input.ownerName ?? null,
      owner_phone_e164: normalizeOptionalPhone(input.ownerPhone),
      business_phone_e164: normalizeOptionalPhone(input.businessPhone),
      twilio_number_e164: normalizeOptionalPhone(input.twilioNumber) ?? existing.twilio_number_e164,
      twilio_number_sid: input.twilioNumberSid ?? existing.twilio_number_sid,
      number_status: input.numberStatus ?? existing.number_status,
      number_trial_ends_at: input.numberTrialEndsAt ?? existing.number_trial_ends_at,
      timezone: input.timezone,
      updated_at: nowIso()
    };

    this.businesses.set(id, updated);
    return updated;
  }

  async updateTelephony(id: string, input: BusinessTelephonyUpdateInput): Promise<BusinessRow> {
    const existing = this.businesses.get(id);
    if (!existing) {
      throw new Error(`Business ${id} was not found.`);
    }

    const updated: BusinessRow = {
      ...existing,
      twilio_number_e164:
        input.twilioNumber === undefined
          ? existing.twilio_number_e164
          : normalizeOptionalPhone(input.twilioNumber),
      twilio_number_sid:
        input.twilioNumberSid === undefined ? existing.twilio_number_sid : input.twilioNumberSid,
      number_status: input.numberStatus ?? existing.number_status,
      number_trial_ends_at:
        input.numberTrialEndsAt === undefined
          ? existing.number_trial_ends_at
          : input.numberTrialEndsAt,
      updated_at: nowIso()
    };

    this.businesses.set(id, updated);
    return updated;
  }

  async updateSettings(id: string, partial: BusinessSettingsUpdate): Promise<BusinessRow> {
    const existing = this.businesses.get(id);
    if (!existing) {
      throw new Error(`Business ${id} was not found.`);
    }

    const updated: BusinessRow = {
      ...existing,
      settings_json: mergeBusinessSettingsJson(existing.settings_json, partial),
      updated_at: nowIso()
    };

    this.businesses.set(id, updated);
    return updated;
  }

  async list(): Promise<BusinessRow[]> {
    return Array.from(this.businesses.values());
  }
}

function compareBusinessesByUpdatedAt(a: BusinessRow, b: BusinessRow): number {
  const byUpdated = Date.parse(b.updated_at) - Date.parse(a.updated_at);
  return byUpdated !== 0 ? byUpdated : b.id.localeCompare(a.id);
}
