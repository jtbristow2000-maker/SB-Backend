import { describe, expect, it } from "vitest";

import { shouldProtectOwnerRoutes } from "./ownerRouteGuard";

describe("owner route auth guard", () => {
  it("keeps the memory sandbox owner dashboard auth-free", () => {
    expect(shouldProtectOwnerRoutes({ NODE_ENV: "test", PERSISTENCE: "memory" })).toBe(false);
    expect(shouldProtectOwnerRoutes({ NODE_ENV: "test" })).toBe(false);
  });

  it("requires owner auth when Supabase persistence is enabled", () => {
    expect(shouldProtectOwnerRoutes({ NODE_ENV: "test", PERSISTENCE: "supabase" })).toBe(true);
  });
});
