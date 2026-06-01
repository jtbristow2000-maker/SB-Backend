import type { CustomerProfileRepository } from "@/server/customerProfiles/repository";
import type { AuditEventRepository } from "@/server/intake/auditEvents";
import type { CustomerProfileRow, JsonValue } from "@/server/db/schema";

export const PROFILE_UPDATE_FIELDS = [
  "display_name",
  "status",
  "notes",
  "email",
  "address_line1",
  "address_line2",
  "city",
  "state",
  "postal_code"
] as const;

export type ProfileUpdateField = (typeof PROFILE_UPDATE_FIELDS)[number];
export type ProfileUpdateInput = {
  display_name?: string | null;
  status?: string;
  notes?: string | null;
  email?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
};

export type ProfileUpdateValidation =
  | { ok: true; updates: ProfileUpdateInput }
  | { ok: false; status: number; error: string; fields?: string[] };

export type ProfileUpdateResult =
  | { status: "updated"; profile: CustomerProfileRow }
  | { status: "not_found" };

export type ProfileUpdateDependencies = {
  customerProfileRepository: CustomerProfileRepository;
  auditEventRepository: AuditEventRepository;
};

const allowedFields = new Set<string>(PROFILE_UPDATE_FIELDS);

export function validateProfileUpdatePayload(payload: unknown): ProfileUpdateValidation {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      status: 400,
      error: "invalid_profile_update_payload"
    };
  }

  const entries = Object.entries(payload as Record<string, unknown>);
  const unknownFields = entries
    .map(([field]) => field)
    .filter((field) => !allowedFields.has(field));

  if (unknownFields.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "unknown_profile_update_fields",
      fields: unknownFields.sort()
    };
  }

  const invalidFields = entries
    .filter(
      ([field, value]) =>
        (value !== null && typeof value !== "string") ||
        (field === "status" && value === null)
    )
    .map(([field]) => field);

  if (invalidFields.length > 0) {
    return {
      ok: false,
      status: 400,
      error: "invalid_profile_update_field_values",
      fields: invalidFields.sort()
    };
  }

  return { ok: true, updates: Object.fromEntries(entries) as ProfileUpdateInput };
}

export async function updateProfileForOwner(
  dependencies: ProfileUpdateDependencies,
  input: {
    businessId: string;
    profileId: string;
    updates: ProfileUpdateInput;
  }
): Promise<ProfileUpdateResult> {
  const profiles = await dependencies.customerProfileRepository.list();
  const existing =
    profiles.find(
      (profile) => profile.business_id === input.businessId && profile.id === input.profileId
    ) ?? null;

  if (!existing) {
    return { status: "not_found" };
  }

  const diff = buildDiff(existing, input.updates);
  const profile = await dependencies.customerProfileRepository.update(existing.id, input.updates);

  if (Object.keys(diff).length > 0) {
    await dependencies.auditEventRepository.create({
      business_id: existing.business_id,
      customer_profile_id: existing.id,
      actor: "owner",
      event_type: "profile.update",
      event_json: {
        profileId: existing.id,
        changes: diff
      }
    });
  }

  return { status: "updated", profile };
}

function buildDiff(
  existing: CustomerProfileRow,
  updates: ProfileUpdateInput
): Record<string, JsonValue> {
  return Object.fromEntries(
    Object.entries(updates)
      .filter(([field, nextValue]) => existing[field as ProfileUpdateField] !== nextValue)
      .map(([field, nextValue]) => [
        field,
        {
          from: existing[field as ProfileUpdateField],
          to: nextValue
        }
      ])
  );
}
