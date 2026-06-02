import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { GET, POST } from "./route";

const originalEnv = {
  API_KEY: process.env.API_KEY,
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE
};

function configureEnv(): void {
  process.env.API_KEY = "appointments-test-key";
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000520";
  process.env.BUSINESS_NAME = "Appointment API Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
}

function appointmentRequest(
  path: string,
  options: { method?: string; body?: Record<string, unknown>; apiKey?: string } = {}
): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.apiKey ? { "x-api-key": options.apiKey } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
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

describe("BACKEND-20 GET /api/appointments", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await GET(appointmentRequest("/api/appointments"));

    expect(response.status).toBe(401);
  });

  it("returns appointments in range ordered by scheduled_start_at", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    await runtime.appointmentRepository.create({
      business_id: business.id,
      title: "Late job",
      scheduled_start_at: "2026-06-04T18:00:00.000Z"
    });
    await runtime.appointmentRepository.create({
      business_id: business.id,
      title: "Early job",
      scheduled_start_at: "2026-06-04T14:00:00.000Z"
    });
    await runtime.appointmentRepository.create({
      business_id: business.id,
      title: "Out of range job",
      scheduled_start_at: "2026-06-10T14:00:00.000Z"
    });

    const response = await GET(
      appointmentRequest(
        "/api/appointments?from=2026-06-04T00:00:00.000Z&to=2026-06-05T00:00:00.000Z",
        { apiKey: "appointments-test-key" }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.appointments.map((appointment: { title: string }) => appointment.title)).toEqual([
      "Early job",
      "Late job"
    ]);
  });
});

describe("BACKEND-20 POST /api/appointments", () => {
  it("creates an appointment linked to a profile and audits the owner action", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550122",
        displayName: "Appointment Customer",
        source: "manual"
      })
    ).profile;

    const response = await POST(
      appointmentRequest("/api/appointments", {
        method: "POST",
        apiKey: "appointments-test-key",
        body: {
          customer_profile_id: profile.id,
          title: "Full detail",
          service_requested: "Full detail SUV",
          scheduled_start_at: "2026-06-04T14:00:00.000Z",
          scheduled_end_at: "2026-06-04T16:00:00.000Z",
          location: "123 Main St",
          notes: "Bring water tank"
        }
      })
    );
    const body = await response.json();
    const appointments = await runtime.appointmentRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(201);
    expect(appointments).toHaveLength(1);
    expect(body.appointment).toMatchObject({
      id: appointments[0].id,
      business_id: business.id,
      customer_profile_id: profile.id,
      title: "Full detail",
      service_requested: "Full detail SUV",
      scheduled_start_at: "2026-06-04T14:00:00.000Z",
      scheduled_end_at: "2026-06-04T16:00:00.000Z",
      status: "scheduled",
      location: "123 Main St",
      notes: "Bring water tank"
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "appointment.created",
      business_id: business.id,
      customer_profile_id: profile.id
    });
  });

  it("returns 404 when the linked profile is outside the business", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    await runtime.customerProfileRepository.create({
      business_id: "00000000-0000-4000-8000-000000000999",
      phone_e164: "+19495550133",
      display_name: "Other Business Customer",
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
    const otherProfile = (await runtime.customerProfileRepository.list())[0];

    const response = await POST(
      appointmentRequest("/api/appointments", {
        method: "POST",
        apiKey: "appointments-test-key",
        body: {
          customer_profile_id: otherProfile.id,
          title: "Cross business appointment",
          scheduled_start_at: "2026-06-04T14:00:00.000Z"
        }
      })
    );

    expect(response.status).toBe(404);
  });
});
