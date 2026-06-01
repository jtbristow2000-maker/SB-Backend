import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";
import type { ProfileDetailResponse } from "@/server/profiles/detail";

import { GET, PATCH } from "./route";

const originalEnv = {
  API_KEY: process.env.API_KEY,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureEnv(): void {
  process.env.API_KEY = "profile-detail-test-key";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000515";
  process.env.BUSINESS_NAME = "Detail Read API Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

function detailRequest(profileId: string, apiKey?: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/profiles/${profileId}`, {
    headers: apiKey ? { "x-api-key": apiKey } : undefined
  });
}

function patchRequest(
  profileId: string,
  body: Record<string, unknown>,
  apiKey?: string
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/profiles/${profileId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify(body)
  });
}

function routeContext(profileId: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: profileId }) };
}

afterEach(() => {
  process.env.API_KEY = originalEnv.API_KEY;
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  resetIntakeRuntimeForTests();
});

describe("BACKEND-15 GET /api/profiles/[id]", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await GET(detailRequest("profile-1"), routeContext("profile-1"));

    expect(response.status).toBe(401);
  });

  it("returns 404 for unknown or cross-business profile ids", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    await runtime.customerProfileRepository.create({
      business_id: "00000000-0000-4000-8000-999999999999",
      display_name: "Other Business",
      phone_e164: "+19495550199",
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
      last_contact_at: "2026-05-31T13:00:00.000Z"
    });
    const crossBusinessProfile = (await runtime.customerProfileRepository.list())[0];

    const unknown = await GET(
      detailRequest("missing-profile", "profile-detail-test-key"),
      routeContext("missing-profile")
    );
    const crossBusiness = await GET(
      detailRequest(crossBusinessProfile.id, "profile-detail-test-key"),
      routeContext(crossBusinessProfile.id)
    );

    expect(unknown.status).toBe(404);
    expect(crossBusiness.status).toBe(404);
  });

  it("returns profile detail with a merged timeline and structured reply status", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550100",
        displayName: "Sarah Reply",
        source: "incoming_call",
        lastContactAt: "2026-05-31T14:05:00.000Z"
      })
    ).profile;
    const call = await runtime.callRecordRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      provider: "twilio",
      provider_call_id: "CA_DETAIL",
      direction: "inbound",
      call_type: "voicemail",
      from_phone_e164: profile.phone_e164,
      to_phone_e164: business.business_phone_e164,
      started_at: "2026-05-31T14:00:00.000Z",
      duration_seconds: 42,
      recording_url: "https://api.twilio.test/recording.wav",
      transcript: "Hi, I need a full detail this Saturday.",
      needs_review: true
    });
    const openTask = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      task_type: "callback",
      title: "Call back missed caller",
      status: "open",
      due_at: "2026-05-31T18:00:00.000Z"
    });
    const autoText = await runtime.messageRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      provider: "sandbox",
      provider_message_id: "missed-call-auto-text:CA_DETAIL",
      direction: "outbound",
      channel: "sms",
      from_phone_e164: business.business_phone_e164,
      to_phone_e164: profile.phone_e164,
      body: "Sorry we missed your call.",
      status: "queued",
      sent_at: null,
      created_at: "2026-05-31T14:01:00.000Z"
    });
    const inbound = await runtime.messageRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      provider: "twilio",
      provider_message_id: "SM_DETAIL_REPLY",
      direction: "inbound",
      channel: "sms",
      from_phone_e164: profile.phone_e164,
      to_phone_e164: business.business_phone_e164,
      body: "Can you call me back?",
      status: "received",
      sent_at: "2026-05-31T14:05:00.000Z",
      created_at: "2026-05-31T14:05:00.000Z"
    });

    const response = await GET(
      detailRequest(profile.id, "profile-detail-test-key"),
      routeContext(profile.id)
    );
    const body = (await response.json()) as ProfileDetailResponse;

    expect(response.status).toBe(200);
    expect(body.profile.id).toBe(profile.id);
    expect(body.open_task).toEqual({
      id: openTask.id,
      task_type: "callback",
      title: "Call back missed caller",
      status: "open",
      due_at: "2026-05-31T18:00:00.000Z"
    });
    expect(body.customer_replied).toBe(true);
    expect(body.appointments).toEqual([]);
    expect(body.quote_drafts).toEqual([]);
    expect(body.timeline).toEqual([
      {
        kind: "message",
        at: "2026-05-31T14:05:00.000Z",
        message: {
          id: inbound.id,
          direction: "inbound",
          channel: "sms",
          body: "Can you call me back?",
          status: "received",
          sent_at: "2026-05-31T14:05:00.000Z"
        }
      },
      {
        kind: "message",
        at: "2026-05-31T14:01:00.000Z",
        message: {
          id: autoText.id,
          direction: "outbound",
          channel: "sms",
          body: "Sorry we missed your call.",
          status: "queued",
          sent_at: null
        }
      },
      {
        kind: "call",
        at: "2026-05-31T14:00:00.000Z",
        call: {
          id: call.id,
          call_type: "voicemail",
          started_at: "2026-05-31T14:00:00.000Z",
          duration_seconds: 42,
          transcript: "Hi, I need a full detail this Saturday.",
          recording_url: "https://api.twilio.test/recording.wav",
          needs_review: true
        }
      }
    ]);
  });
});

describe("BACKEND-16 PATCH /api/profiles/[id]", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await PATCH(
      patchRequest("profile-1", { status: "contacted" }),
      routeContext("profile-1")
    );

    expect(response.status).toBe(401);
  });

  it("returns 404 for an unknown profile id", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await PATCH(
      patchRequest("missing-profile", { status: "contacted" }, "profile-detail-test-key"),
      routeContext("missing-profile")
    );

    expect(response.status).toBe(404);
  });

  it("rejects unknown profile fields", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550100",
        source: "incoming_call"
      })
    ).profile;

    const response = await PATCH(
      patchRequest(
        profile.id,
        { status: "contacted", provider_call_id: "nope" },
        "profile-detail-test-key"
      ),
      routeContext(profile.id)
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: "unknown_profile_update_fields",
      fields: ["provider_call_id"]
    });
    expect(await runtime.auditEventRepository.list()).toHaveLength(0);
  });

  it("persists owner edits and writes a profile.update audit event", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550100",
        displayName: "Original Name",
        source: "incoming_call",
        status: "new",
        notes: "Initial note"
      })
    ).profile;

    const response = await PATCH(
      patchRequest(
        profile.id,
        {
          display_name: "Sarah Detail",
          status: "contacted",
          notes: "Owner called back.",
          email: "sarah@example.test",
          address_line1: "123 Main St",
          city: "Los Angeles",
          state: "CA",
          postal_code: "90001"
        },
        "profile-detail-test-key"
      ),
      routeContext(profile.id)
    );
    const body = await response.json();
    const profiles = await runtime.customerProfileRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(body.profile).toMatchObject({
      id: profile.id,
      display_name: "Sarah Detail",
      status: "contacted",
      notes: "Owner called back.",
      email: "sarah@example.test",
      address_line1: "123 Main St",
      city: "Los Angeles",
      state: "CA",
      postal_code: "90001"
    });
    expect(profiles[0]).toMatchObject(body.profile);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "profile.update",
      business_id: business.id,
      customer_profile_id: profile.id
    });
    expect(auditEvents[0].event_json).toMatchObject({
      profileId: profile.id,
      changes: {
        display_name: { from: "Original Name", to: "Sarah Detail" },
        status: { from: "new", to: "contacted" },
        notes: { from: "Initial note", to: "Owner called back." },
        email: { from: null, to: "sarah@example.test" },
        address_line1: { from: null, to: "123 Main St" }
      }
    });
  });
});
