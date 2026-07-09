import { afterEach, describe, expect, it } from "vitest";

import { getAppConfig, isAdminEmail } from "./config";

const originalAdminEmails = process.env.ADMIN_EMAILS;

afterEach(() => {
  if (originalAdminEmails === undefined) {
    delete process.env.ADMIN_EMAILS;
  } else {
    process.env.ADMIN_EMAILS = originalAdminEmails;
  }
});

describe("app config admin emails", () => {
  it("parses ADMIN_EMAILS as lowercase trimmed comma-separated emails", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.com, support@snagly.test ,,OWNER@EXAMPLE.COM ";

    expect(getAppConfig().adminEmails).toEqual([
      "admin@example.com",
      "support@snagly.test",
      "owner@example.com"
    ]);
    expect(isAdminEmail("ADMIN@example.com")).toBe(true);
    expect(isAdminEmail(" support@snagly.test ")).toBe(true);
    expect(isAdminEmail("other@example.com")).toBe(false);
  });

  it("keeps admin checks disabled when ADMIN_EMAILS is unset", () => {
    delete process.env.ADMIN_EMAILS;

    expect(getAppConfig().adminEmails).toEqual([]);
    expect(isAdminEmail("admin@example.com")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
  });
});
