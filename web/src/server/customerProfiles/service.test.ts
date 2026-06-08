import { describe, expect, it } from "vitest";

import { InMemoryCustomerProfileRepository } from "./repository";
import { CustomerProfileService } from "./service";

describe("BACKEND-05 CustomerProfileService", () => {
  it("creates a profile with an E.164 phone number", async () => {
    const repository = new InMemoryCustomerProfileRepository();
    const service = new CustomerProfileService(repository);

    const result = await service.upsertByBusinessAndPhone({
      businessId: "business_1",
      phone: "(213) 373-4253",
      displayName: "Taylor Customer",
      source: "missed_call",
      vehicles: "2019 Tahoe",
      poBox: "PO Box 44",
      preferredContact: "text",
      referralSource: "Google"
    });

    expect(result.created).toBe(true);
    expect(result.profile.phone_e164).toBe("+12133734253");
    expect(result.profile.business_id).toBe("business_1");
    expect(result.profile).toMatchObject({
      vehicles: "2019 Tahoe",
      po_box: "PO Box 44",
      preferred_contact: "text",
      referral_source: "Google"
    });
  });

  it("upserts by business and normalized phone to prevent duplicates", async () => {
    const repository = new InMemoryCustomerProfileRepository();
    const service = new CustomerProfileService(repository);

    const first = await service.upsertByBusinessAndPhone({
      businessId: "business_1",
      phone: "(213) 373-4253",
      displayName: "Taylor"
    });
    const second = await service.upsertByBusinessAndPhone({
      businessId: "business_1",
      phone: "+1 213 373 4253",
      displayName: "Taylor Updated",
      email: "taylor@example.test"
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.profile.id).toBe(first.profile.id);
    expect(second.profile.display_name).toBe("Taylor Updated");
    expect(second.profile.email).toBe("taylor@example.test");
    expect(await repository.list()).toHaveLength(1);
  });

  it("allows the same phone under different businesses", async () => {
    const repository = new InMemoryCustomerProfileRepository();
    const service = new CustomerProfileService(repository);

    await service.upsertByBusinessAndPhone({
      businessId: "business_1",
      phone: "(213) 373-4253"
    });
    await service.upsertByBusinessAndPhone({
      businessId: "business_2",
      phone: "(213) 373-4253"
    });

    expect(await repository.list()).toHaveLength(2);
  });

  it("does not overwrite existing owner notes during profile updates", async () => {
    const repository = new InMemoryCustomerProfileRepository();
    const service = new CustomerProfileService(repository);

    const first = await service.upsertByBusinessAndPhone({
      businessId: "business_1",
      phone: "(213) 373-4253",
      notes: "Owner-entered note"
    });
    const second = await service.upsertByBusinessAndPhone({
      businessId: "business_1",
      phone: "+12133734253",
      notes: "Automated note should not replace owner note",
      summary: "Customer asked for a quote."
    });

    expect(second.created).toBe(false);
    expect(second.profile.id).toBe(first.profile.id);
    expect(second.profile.notes).toBe("Owner-entered note");
    expect(second.profile.summary).toBe("Customer asked for a quote.");
  });
});
