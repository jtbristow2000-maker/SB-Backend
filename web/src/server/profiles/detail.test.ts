import { describe, expect, it } from "vitest";

import type { AppointmentRow, CustomerProfileRow } from "@/server/db/schema";

import { buildProfileDetail } from "./detail";

const timestamp = "2026-06-07T12:00:00.000Z";

function profile(overrides: Partial<CustomerProfileRow> = {}): CustomerProfileRow {
  return {
    id: "profile_1",
    business_id: "business_1",
    display_name: "Taylor",
    phone_e164: "+12133734253",
    email: "taylor@example.test",
    vehicles: "2019 Tahoe; wife's Civic",
    address_line1: "123 Main St",
    address_line2: null,
    po_box: "PO Box 44",
    city: "Los Angeles",
    state: "CA",
    postal_code: "90001",
    preferred_contact: "text",
    referral_source: "Neighbor referral",
    source: "incoming_call",
    status: "new",
    summary: null,
    notes: "$180-$240 range",
    last_contact_at: timestamp,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  };
}

function appointment(overrides: Partial<AppointmentRow> = {}): AppointmentRow {
  return {
    id: "appointment_1",
    business_id: "business_1",
    customer_profile_id: "profile_1",
    source_call_record_id: null,
    title: "Full detail",
    service_requested: "Full detail SUV",
    scheduled_start_at: "2026-06-08T14:00:00.000Z",
    scheduled_end_at: "2026-06-08T16:00:00.000Z",
    timezone: "America/New_York",
    status: "scheduled",
    location: "123 Main St",
    notes: null,
    created_at: timestamp,
    updated_at: timestamp,
    ...overrides
  };
}

describe("profile detail read model", () => {
  it("surfaces richer profile fields and derives first-time customer status", () => {
    const baseProfile = profile();
    const firstTime = buildProfileDetail({
      businessId: "business_1",
      profileId: baseProfile.id,
      profiles: [baseProfile],
      calls: [],
      messages: [],
      tasks: [],
      appointments: [appointment()],
      quoteDrafts: []
    });
    const returning = buildProfileDetail({
      businessId: "business_1",
      profileId: baseProfile.id,
      profiles: [baseProfile],
      calls: [],
      messages: [],
      tasks: [],
      appointments: [appointment({ id: "appointment_done", status: "completed" })],
      quoteDrafts: []
    });

    expect(firstTime).toMatchObject({
      profile: {
        vehicles: "2019 Tahoe; wife's Civic",
        address_line1: "123 Main St",
        po_box: "PO Box 44",
        preferred_contact: "text",
        referral_source: "Neighbor referral",
        notes: "$180-$240 range"
      },
      first_time_customer: true
    });
    expect(returning?.first_time_customer).toBe(false);
  });
});
