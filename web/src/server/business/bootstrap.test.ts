import { describe, expect, it } from "vitest";

import {
  bootstrapSingleTenantBusiness,
  getBusinessSeedFromEnv,
  InMemoryBusinessRepository
} from "./bootstrap";
import { getBusinessSettings } from "./settings";

describe("BACKEND-06 single-tenant business bootstrap", () => {
  it("creates one env-derived business idempotently", async () => {
    const repository = new InMemoryBusinessRepository();
    const seed = {
      id: "00000000-0000-4000-8000-000000000101",
      name: "Shine Mobile Detailing",
      ownerName: "Jamie Owner",
      ownerPhone: "(213) 373-4253",
      businessPhone: "+1 310 555 0199",
      timezone: "America/New_York"
    };

    const first = await bootstrapSingleTenantBusiness(repository, seed);
    const second = await bootstrapSingleTenantBusiness(repository, {
      ...seed,
      name: "Shine Mobile Detail"
    });

    expect(first.id).toBe(seed.id);
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Shine Mobile Detail");
    expect(second.owner_phone_e164).toBe("+12133734253");
    expect(second.business_phone_e164).toBe("+13105550199");
    expect(await repository.list()).toHaveLength(1);
  });

  it("uses safe defaults when optional env values are missing", () => {
    const seed = getBusinessSeedFromEnv({} as NodeJS.ProcessEnv);

    expect(seed.name).toBe("Local Service Business");
    expect(seed.timezone).toBe("America/New_York");
  });

  it("merges, reads, and preserves business settings through bootstrap updates", async () => {
    const repository = new InMemoryBusinessRepository();
    const seed = {
      id: "00000000-0000-4000-8000-000000000102",
      name: "Settings Detail Co",
      ownerName: "Jamie Owner",
      ownerPhone: "(213) 373-4253",
      businessPhone: "+1 310 555 0199",
      timezone: "America/New_York"
    };

    await bootstrapSingleTenantBusiness(repository, seed);
    await repository.updateSettings(seed.id, {
      brand_color: "#123abc",
      auto_text_message: "Thanks for calling {business_name}. We will reply soon.",
      business_hours: { open: "08:00", close: "18:00", days: [1, 2, 3, 4, 5, 6] },
      quote_ranges: [{ service: "Exterior detail", low: 125, high: 225 }]
    });
    const merged = await repository.updateSettings(seed.id, {
      brand_color: "#5b5bd6",
      business_hours: { close: "17:30" }
    });
    const rebooted = await bootstrapSingleTenantBusiness(repository, {
      ...seed,
      name: "Settings Detail Co Updated"
    });

    expect(merged.settings_json).toMatchObject({
      brand_color: "#5b5bd6",
      auto_text_message: "Thanks for calling {business_name}. We will reply soon.",
      business_hours: { open: "08:00", close: "17:30", days: [1, 2, 3, 4, 5, 6] },
      quote_ranges: [{ service: "Exterior detail", low: 125, high: 225 }]
    });
    expect(rebooted.settings_json).toEqual(merged.settings_json);
    expect(getBusinessSettings(rebooted)).toMatchObject({
      brand_color: "#5b5bd6",
      auto_text_message: "Thanks for calling {business_name}. We will reply soon.",
      business_hours: { open: "08:00", close: "17:30", days: [1, 2, 3, 4, 5, 6] },
      quote_ranges: [{ service: "Exterior detail", low: 125, high: 225 }]
    });
  });
});
