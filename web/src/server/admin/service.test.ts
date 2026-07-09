import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { listBusinessesForAdmin, requireAdminUser } from "./service";

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
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000811";
  process.env.BUSINESS_NAME = "First Admin List Co";
  process.env.OWNER_PHONE = "+12133734253";
  process.env.BUSINESS_PHONE = "+13105550199";
  process.env.TIMEZONE = "America/New_York";
  resetIntakeRuntimeForTests();

  const rt = await getIntakeRuntime();
  const first = (await rt.businessRepository.list())[0];
  const second = await rt.businessRepository.create({
    id: "00000000-0000-4000-8000-000000000812",
    name: "Second Admin List Co",
    ownerName: "Second Owner",
    ownerPhone: "+12133734254",
    businessPhone: "+13105550200",
    timezone: "America/New_York"
  });
  await rt.businessRepository.updateTelephony(second.id, {
    twilioNumber: "+14155550100",
    twilioNumberSid: "PN_ADMIN_LIST",
    numberStatus: "trial"
  });
  await rt.businessMemberRepository.create({
    business_id: first.id,
    user_id: "owner-user-1",
    role: "owner"
  });
  await rt.businessMemberRepository.create({
    business_id: second.id,
    user_id: "owner-user-2",
    role: "owner"
  });
  const firstProfile = await rt.customerProfileRepository.create({
    business_id: first.id,
    display_name: "First Lead",
    phone_e164: "+19495550100",
    email: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    source: "manual",
    status: "new",
    summary: null,
    notes: null,
    last_contact_at: null
  });
  await rt.customerProfileRepository.create({
    business_id: second.id,
    display_name: "Second Lead",
    phone_e164: "+19495550101",
    email: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    source: "manual",
    status: "new",
    summary: null,
    notes: null,
    last_contact_at: null
  });
  await rt.customerProfileRepository.create({
    business_id: second.id,
    display_name: "Third Lead",
    phone_e164: "+19495550102",
    email: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    source: "manual",
    status: "new",
    summary: null,
    notes: null,
    last_contact_at: null
  });
  await rt.callRecordRepository.create({
    business_id: first.id,
    customer_profile_id: firstProfile.id,
    provider: "twilio",
    provider_call_id: "CA_ADMIN_LIST",
    direction: "inbound",
    call_type: "missed",
    from_phone_e164: "+19495550100",
    to_phone_e164: first.business_phone_e164
  });

  return { rt, first, second };
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

describe("admin data service", () => {
  it("returns null for non-admin users", async () => {
    process.env.ADMIN_EMAILS = "admin@snagly.test";

    await expect(
      requireAdminUser({ currentUser: { id: "owner", email: "owner@example.com" } })
    ).resolves.toBeNull();
  });

  it("lists every business with counts for admin users in memory mode", async () => {
    const { rt, first, second } = await setupRuntime();

    const summaries = await listBusinessesForAdmin({
      runtime: rt,
      currentUser: { id: "admin-user", email: "admin@snagly.test" }
    });

    expect(summaries).toHaveLength(2);
    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.id,
          name: "First Admin List Co",
          business_phone_e164: "+13105550199",
          twilio_number_e164: null,
          number_status: "none",
          lead_count: 1,
          call_count: 1,
          member_email: null
        }),
        expect.objectContaining({
          id: second.id,
          name: "Second Admin List Co",
          business_phone_e164: "+13105550200",
          twilio_number_e164: "+14155550100",
          number_status: "trial",
          lead_count: 2,
          call_count: 0,
          member_email: null
        })
      ])
    );
  });

  it("no-ops safely when ADMIN_EMAILS is unset", async () => {
    delete process.env.ADMIN_EMAILS;
    const { rt } = await setupRuntime();
    delete process.env.ADMIN_EMAILS;

    const summaries = await listBusinessesForAdmin({
      runtime: rt,
      currentUser: { id: "admin-user", email: "admin@snagly.test" }
    });

    expect(summaries).toEqual([]);
  });
});
