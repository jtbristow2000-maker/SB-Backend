import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { resolveAdminImpersonatedContext } from "./current";

const originalEnv = {
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function restoreEnvVar(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function setupRuntime() {
  process.env.ADMIN_EMAILS = "admin@snagly.test";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000801";
  process.env.BUSINESS_NAME = "Owner Business";
  process.env.OWNER_PHONE = "+12133734253";
  process.env.BUSINESS_PHONE = "+13105550199";
  process.env.TIMEZONE = "America/New_York";
  resetIntakeRuntimeForTests();

  const rt = await getIntakeRuntime();
  const target = await rt.businessRepository.create({
    id: "00000000-0000-4000-8000-000000000802",
    name: "Target Detail Co",
    ownerName: "Target Owner",
    ownerPhone: "+12133734254",
    businessPhone: "+13105550200",
    timezone: "America/New_York"
  });

  return { rt, target };
}

afterEach(() => {
  restoreEnvVar("ADMIN_EMAILS", originalEnv.ADMIN_EMAILS);
  restoreEnvVar("BUSINESS_ID", originalEnv.BUSINESS_ID);
  restoreEnvVar("BUSINESS_NAME", originalEnv.BUSINESS_NAME);
  restoreEnvVar("OWNER_PHONE", originalEnv.OWNER_PHONE);
  restoreEnvVar("BUSINESS_PHONE", originalEnv.BUSINESS_PHONE);
  restoreEnvVar("TIMEZONE", originalEnv.TIMEZONE);
  resetIntakeRuntimeForTests();
});

describe("admin owner-context impersonation", () => {
  it("returns the target business context for an admin user and audits the impersonation", async () => {
    const { rt, target } = await setupRuntime();

    const context = await resolveAdminImpersonatedContext({
      user: { email: "Admin@Snagly.test" },
      businessId: target.id,
      serviceRuntime: rt
    });
    const audits = await rt.auditEventRepository.list();

    expect(context?.business.id).toBe(target.id);
    expect(context?.impersonating).toEqual({
      businessId: target.id,
      businessName: "Target Detail Co"
    });
    expect(context?.rt).toBe(rt);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      business_id: target.id,
      actor: "system",
      event_type: "admin.impersonation_used",
      event_json: {
        adminEmail: "admin@snagly.test",
        businessId: target.id,
        businessName: "Target Detail Co"
      }
    });
  });

  it("ignores the impersonation cookie value for non-admin users", async () => {
    const { rt, target } = await setupRuntime();

    const context = await resolveAdminImpersonatedContext({
      user: { email: "owner@example.com" },
      businessId: target.id,
      serviceRuntime: rt
    });

    expect(context).toBeNull();
    expect(await rt.auditEventRepository.list()).toHaveLength(0);
  });

  it("falls through when the impersonation target does not exist", async () => {
    const { rt } = await setupRuntime();

    const context = await resolveAdminImpersonatedContext({
      user: { email: "admin@snagly.test" },
      businessId: "00000000-0000-4000-8000-000000009999",
      serviceRuntime: rt
    });

    expect(context).toBeNull();
    expect(await rt.auditEventRepository.list()).toHaveLength(0);
  });
});
