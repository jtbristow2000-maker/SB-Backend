import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { getSupabaseServerClient } from "./supabaseClient";
import { createSupabaseRepositories } from "./supabaseRepositories";

const originalEnv = {
  PERSISTENCE: process.env.PERSISTENCE,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

afterEach(() => {
  process.env.PERSISTENCE = originalEnv.PERSISTENCE;
  process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-19 persistence mode", () => {
  it("defaults to in-memory repositories and does not require Supabase env", async () => {
    delete process.env.PERSISTENCE;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000619";
    process.env.BUSINESS_NAME = "Memory Persistence Test";
    process.env.OWNER_PHONE = "(213) 373-4253";
    process.env.BUSINESS_PHONE = "(310) 555-0199";
    process.env.TIMEZONE = "America/New_York";
    resetIntakeRuntimeForTests();

    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: null,
      task_type: "callback",
      title: "Memory-only task",
      status: "open"
    });

    expect(await runtime.taskRepository.list()).toHaveLength(1);

    resetIntakeRuntimeForTests();
    const freshRuntime = await getIntakeRuntime();

    expect(await freshRuntime.taskRepository.list()).toHaveLength(0);
  });
});

const describeSupabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? describe : describe.skip;

describeSupabase("BACKEND-19 Supabase repository contract", () => {
  it("creates and reads a profile, call, and task through Supabase repos", async () => {
    const client = getSupabaseServerClient();
    const repos = createSupabaseRepositories(client);
    const businessId = randomUUID();

    await client.from("businesses").delete().eq("id", businessId);

    try {
      const business = await repos.businessRepository.create({
        id: businessId,
        name: "Supabase Contract Detail Co",
        ownerPhone: "+12133734253",
        businessPhone: "+13104567890",
        timezone: "America/New_York"
      });
      const profile = await repos.customerProfileRepository.create({
        business_id: business.id,
        display_name: "Persistent Caller",
        phone_e164: "+12128675309",
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
        last_contact_at: "2026-05-31T18:00:00.000Z"
      });
      const call = await repos.callRecordRepository.create({
        business_id: business.id,
        customer_profile_id: profile.id,
        provider: "twilio",
        provider_call_id: `CA_${businessId}`,
        direction: "inbound",
        call_type: "voicemail",
        from_phone_e164: profile.phone_e164,
        to_phone_e164: business.business_phone_e164,
        started_at: "2026-05-31T18:00:00.000Z",
        transcript: "I need a detail this week.",
        needs_review: true
      });
      const task = await repos.taskRepository.create({
        business_id: business.id,
        customer_profile_id: profile.id,
        task_type: "callback",
        title: "Call back persistent caller",
        status: "open"
      });

      expect(await repos.customerProfileRepository.findByBusinessAndPhone(
        business.id,
        "+12128675309"
      )).toMatchObject({
        id: profile.id,
        display_name: "Persistent Caller"
      });
      expect(await repos.callRecordRepository.findByProviderCallId(
        business.id,
        `CA_${businessId}`
      )).toMatchObject({
        id: call.id,
        transcript: "I need a detail this week.",
        needs_review: true
      });
      expect(await repos.taskRepository.findOpenCallbackTask(profile.id)).toMatchObject({
        id: task.id,
        status: "open"
      });
      expect((await repos.customerProfileRepository.list()).some((row) => row.id === profile.id))
        .toBe(true);
    } finally {
      await client.from("businesses").delete().eq("id", businessId);
    }
  });
});
