import type { CountryCode } from "libphonenumber-js";

import type { CustomerProfileRow } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";

import type { CustomerProfileRepository } from "./repository";

export type CustomerProfileUpsertInput = {
  businessId: string;
  phone: string;
  defaultCountry?: CountryCode;
  displayName?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  source?: string | null;
  status?: string;
  summary?: string | null;
  notes?: string | null;
  lastContactAt?: string | null;
};

export type CustomerProfileUpsertResult = {
  profile: CustomerProfileRow;
  created: boolean;
};

export class CustomerProfileService {
  constructor(
    private readonly repository: CustomerProfileRepository,
    private readonly defaultCountry: CountryCode = "US"
  ) {}

  async upsertByBusinessAndPhone(input: CustomerProfileUpsertInput): Promise<CustomerProfileUpsertResult> {
    const phoneE164 = normalizePhoneNumber(input.phone, input.defaultCountry ?? this.defaultCountry);
    const existing = await this.repository.findByBusinessAndPhone(input.businessId, phoneE164);

    if (!existing) {
      const profile = await this.repository.create({
        business_id: input.businessId,
        display_name: input.displayName ?? null,
        phone_e164: phoneE164,
        email: input.email ?? null,
        address_line1: input.addressLine1 ?? null,
        address_line2: input.addressLine2 ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postal_code: input.postalCode ?? null,
        source: input.source ?? null,
        status: input.status ?? "new",
        summary: input.summary ?? null,
        notes: input.notes ?? null,
        last_contact_at: input.lastContactAt ?? null
      });

      return { profile, created: true };
    }

    const profile = await this.repository.update(existing.id, {
      display_name: input.displayName ?? existing.display_name,
      email: input.email ?? existing.email,
      address_line1: input.addressLine1 ?? existing.address_line1,
      address_line2: input.addressLine2 ?? existing.address_line2,
      city: input.city ?? existing.city,
      state: input.state ?? existing.state,
      postal_code: input.postalCode ?? existing.postal_code,
      source: input.source ?? existing.source,
      status: input.status ?? existing.status,
      summary: input.summary ?? existing.summary,
      notes: existing.notes ?? input.notes ?? null,
      last_contact_at: input.lastContactAt ?? existing.last_contact_at
    });

    return { profile, created: false };
  }
}
