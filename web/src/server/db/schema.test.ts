import { describe, expect, it } from "vitest";

import { BACKEND_02_TABLES, type CustomerProfileRow, type Database } from "./schema";

describe("BACKEND-02 database contract", () => {
  it("declares the required foundation tables", () => {
    expect(BACKEND_02_TABLES).toEqual([
      "businesses",
      "customer_profiles",
      "call_records",
      "messages",
      "tasks"
    ]);
  });

  it("keeps customer profiles business scoped and phone-normalization ready", () => {
    const profile = {
      id: "profile_1",
      business_id: "business_1",
      display_name: "Taylor Customer",
      phone_e164: "+15551234567",
      email: null,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      source: "missed_call",
      status: "new",
      summary: null,
      notes: null,
      last_contact_at: null,
      created_at: "2026-05-31T00:00:00.000Z",
      updated_at: "2026-05-31T00:00:00.000Z"
    } satisfies CustomerProfileRow;

    expect(profile.business_id).toBe("business_1");
    expect(profile.phone_e164).toBe("+15551234567");
  });

  it("exposes Supabase-style table types", () => {
    type Tables = keyof Database["public"]["Tables"];
    const table: Tables = "customer_profiles";

    expect(table).toBe("customer_profiles");
  });
});
