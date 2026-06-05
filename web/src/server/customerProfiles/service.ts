import type { CountryCode } from "libphonenumber-js";

import type { CustomerProfileRow } from "@/server/db/schema";
import { normalizePhoneNumber } from "@/server/phone/normalize";

import {
  DuplicateCustomerProfileError,
  type CustomerProfileRepository
} from "./repository";

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
      try {
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
      } catch (error) {
        if (!(error instanceof DuplicateCustomerProfileError)) {
          throw error;
        }
      }
    }

    const profileToUpdate =
      existing ?? (await this.repository.findByBusinessAndPhone(input.businessId, phoneE164));
    if (!profileToUpdate) {
      throw new Error(
        `Customer profile upsert lost duplicate profile for business ${input.businessId} and phone ${phoneE164}`
      );
    }

    const profile = await this.repository.update(profileToUpdate.id, {
      display_name: input.displayName ?? profileToUpdate.display_name,
      email: input.email ?? profileToUpdate.email,
      address_line1: input.addressLine1 ?? profileToUpdate.address_line1,
      address_line2: input.addressLine2 ?? profileToUpdate.address_line2,
      city: input.city ?? profileToUpdate.city,
      state: input.state ?? profileToUpdate.state,
      postal_code: input.postalCode ?? profileToUpdate.postal_code,
      source: input.source ?? profileToUpdate.source,
      status: input.status ?? profileToUpdate.status,
      summary: input.summary ?? profileToUpdate.summary,
      notes: profileToUpdate.notes ?? input.notes ?? null,
      last_contact_at: input.lastContactAt ?? profileToUpdate.last_contact_at
    });

    return { profile, created: false };
  }
}
