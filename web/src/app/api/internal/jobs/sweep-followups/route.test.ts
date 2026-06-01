import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { POST } from "./route";

const originalEnv = {
  PERSISTENCE: process.env.PERSISTENCE,
  INTERNAL_JOB_TOKEN: process.env.INTERNAL_JOB_TOKEN,
  FOLLOW_UP_STALE_HOURS: process.env.FOLLOW_UP_STALE_HOURS,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureEnv(): void {
  process.env.PERSISTENCE = "memory";
  process.env.INTERNAL_JOB_TOKEN = "follow-up-job-test-token";
  process.env.FOLLOW_UP_STALE_HOURS = "24";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000521";
  process.env.BUSINESS_NAME = "Follow Up Sweep Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

function sweepRequest(token?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/internal/jobs/sweep-followups", {
    method: "POST",
    headers: token ? { "x-internal-job-token": token } : undefined
  });
}

afterEach(() => {
  process.env.PERSISTENCE = originalEnv.PERSISTENCE;
  process.env.INTERNAL_JOB_TOKEN = originalEnv.INTERNAL_JOB_TOKEN;
  process.env.FOLLOW_UP_STALE_HOURS = originalEnv.FOLLOW_UP_STALE_HOURS;
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-21 POST /api/internal/jobs/sweep-followups", () => {
  it("requires the configured internal job token", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await POST(sweepRequest());

    expect(response.status).toBe(401);
  });

  it("creates one daily follow-up task for a stale profile and skips fresh or owner-touched profiles", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const oldContactAt = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    const recentContactAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const staleProfile = await createProfile({
      displayName: "Stale Lead",
      businessId: business.id,
      status: "new",
      lastContactAt: oldContactAt
    });
    await createProfile({
      displayName: "Fresh Lead",
      businessId: business.id,
      status: "new",
      lastContactAt: recentContactAt
    });
    const ownerSmsProfile = await createProfile({
      displayName: "Owner Texted Lead",
      businessId: business.id,
      status: "contacted",
      lastContactAt: oldContactAt
    });
    const statusChangedProfile = await createProfile({
      displayName: "Status Changed Lead",
      businessId: business.id,
      status: "contacted",
      lastContactAt: oldContactAt
    });
    const completedTaskProfile = await createProfile({
      displayName: "Completed Task Lead",
      businessId: business.id,
      status: "new",
      lastContactAt: oldContactAt
    });

    await runtime.messageRepository.create({
      business_id: business.id,
      customer_profile_id: ownerSmsProfile.id,
      provider: "sandbox",
      provider_message_id: null,
      direction: "outbound",
      channel: "sms",
      body: "Following up now.",
      status: "queued"
    });
    await runtime.auditEventRepository.create({
      business_id: business.id,
      customer_profile_id: statusChangedProfile.id,
      actor: "owner",
      event_type: "profile.update",
      event_json: {
        changes: {
          status: { from: "new", to: "contacted" }
        }
      }
    });
    await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: completedTaskProfile.id,
      task_type: "callback",
      title: "Already handled",
      status: "done"
    });

    const firstResponse = await POST(sweepRequest("follow-up-job-test-token"));
    const firstBody = await firstResponse.json();
    const secondResponse = await POST(sweepRequest("follow-up-job-test-token"));
    const secondBody = await secondResponse.json();
    const tasks = await runtime.taskRepository.list();
    const followUpTasks = tasks.filter((task) => task.task_type === "follow_up");
    const auditEvents = await runtime.auditEventRepository.list();
    const followUpAuditEvents = auditEvents.filter(
      (event) => event.event_type === "task.follow_up.created"
    );

    expect(firstResponse.status).toBe(200);
    expect(firstBody).toMatchObject({
      scanned: 5,
      stale: 1,
      created: 1,
      skipped_existing_today: 0
    });
    expect(secondResponse.status).toBe(200);
    expect(secondBody).toMatchObject({
      scanned: 5,
      stale: 1,
      created: 0,
      skipped_existing_today: 1
    });
    expect(followUpTasks).toHaveLength(1);
    expect(followUpTasks[0]).toMatchObject({
      business_id: business.id,
      customer_profile_id: staleProfile.id,
      task_type: "follow_up",
      status: "open"
    });
    expect(followUpAuditEvents).toHaveLength(1);
    expect(followUpAuditEvents[0]).toMatchObject({
      actor: "system",
      business_id: business.id,
      customer_profile_id: staleProfile.id
    });

    async function createProfile(input: {
      businessId: string;
      displayName: string;
      status: "new" | "contacted";
      lastContactAt: string;
    }) {
      return runtime.customerProfileRepository.create({
        business_id: input.businessId,
        display_name: input.displayName,
        phone_e164: null,
        email: null,
        address_line1: null,
        address_line2: null,
        city: null,
        state: null,
        postal_code: null,
        source: "test",
        status: input.status,
        summary: null,
        notes: null,
        last_contact_at: input.lastContactAt
      });
    }
  });
});
