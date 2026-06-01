import { describe, expect, it } from "vitest";

import {
  bootstrapSingleTenantBusiness,
  getBusinessSeedFromEnv,
  InMemoryBusinessRepository
} from "./bootstrap";

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
});
