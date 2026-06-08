import { describe, expect, it } from "vitest";

import { InMemoryCustomerProfileRepository } from "@/server/customerProfiles/repository";
import { InMemoryAuditEventRepository } from "@/server/intake/auditEvents";

import { updateProfileForOwner, validateProfileUpdatePayload } from "./update";

describe("customer profile owner updates", () => {
  it("persists richer customer profile fields and audits the changes", async () => {
    const customerProfileRepository = new InMemoryCustomerProfileRepository();
    const auditEventRepository = new InMemoryAuditEventRepository();
    const profile = await customerProfileRepository.create({
      business_id: "business_1",
      display_name: "Taylor",
      phone_e164: "+12133734253",
      email: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      source: "incoming_call",
      status: "new",
      summary: null,
      notes: null,
      last_contact_at: null
    });

    const result = await updateProfileForOwner(
      { customerProfileRepository, auditEventRepository },
      {
        businessId: "business_1",
        profileId: profile.id,
        updates: {
          vehicles: "2019 Tahoe; wife's Civic",
          address_line1: "123 Main St",
          address_line2: "Unit B",
          po_box: "PO Box 44",
          city: "Los Angeles",
          state: "CA",
          postal_code: "90001",
          preferred_contact: "text",
          referral_source: "Neighbor referral",
          notes: "$180-$240 range, prefers mornings"
        }
      }
    );

    const saved = (await customerProfileRepository.list())[0];
    const auditEvents = await auditEventRepository.list();

    expect(result.status).toBe("updated");
    expect(saved).toMatchObject({
      vehicles: "2019 Tahoe; wife's Civic",
      address_line1: "123 Main St",
      address_line2: "Unit B",
      po_box: "PO Box 44",
      city: "Los Angeles",
      state: "CA",
      postal_code: "90001",
      preferred_contact: "text",
      referral_source: "Neighbor referral",
      notes: "$180-$240 range, prefers mornings"
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "profile.update",
      business_id: "business_1",
      customer_profile_id: profile.id
    });
    expect(auditEvents[0].event_json).toMatchObject({
      profileId: profile.id,
      changes: {
        vehicles: { from: null, to: "2019 Tahoe; wife's Civic" },
        po_box: { from: null, to: "PO Box 44" },
        preferred_contact: { from: null, to: "text" },
        referral_source: { from: null, to: "Neighbor referral" },
        notes: { from: null, to: "$180-$240 range, prefers mornings" }
      }
    });
  });

  it("rejects unsupported preferred contact values", () => {
    const validation = validateProfileUpdatePayload({
      preferred_contact: "fax"
    });

    expect(validation).toEqual({
      ok: false,
      status: 400,
      error: "invalid_profile_update_field_values",
      fields: ["preferred_contact"]
    });
  });
});
