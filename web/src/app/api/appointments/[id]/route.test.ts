import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import { DELETE, PATCH } from "./route";

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
  id: string,
  options: { method: string; body?: Record<string, unknown>; apiKey?: string }
): NextRequest {
  return new NextRequest(`http://localhost:3000/api/appointments/${id}`, {
    method: options.method,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.apiKey ? { "x-api-key": options.apiKey } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
}

function appointmentContext(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
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

describe("BACKEND-20 PATCH /api/appointments/[id]", () => {
  it("requires the configured API key", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await PATCH(
      appointmentRequest("appointment-1", {
        method: "PATCH",
        body: { status: "confirmed" }
      }),
      appointmentContext("appointment-1")
    );

    expect(response.status).toBe(401);
  });

  it("updates appointment fields and audits the owner action", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const appointment = await runtime.appointmentRepository.create({
      business_id: business.id,
      title: "Original job",
      scheduled_start_at: "2026-06-04T14:00:00.000Z",
      notes: "Old notes"
    });

    const response = await PATCH(
      appointmentRequest(appointment.id, {
        method: "PATCH",
        apiKey: "appointments-test-key",
        body: {
          title: "Confirmed job",
          status: "confirmed",
          scheduled_start_at: "2026-06-05T15:00:00.000Z",
          notes: "Fresh notes"
        }
      }),
      appointmentContext(appointment.id)
    );
    const body = await response.json();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(body.appointment).toMatchObject({
      id: appointment.id,
      title: "Confirmed job",
      status: "confirmed",
      scheduled_start_at: "2026-06-05T15:00:00.000Z",
      notes: "Fresh notes"
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "appointment.updated",
      business_id: business.id
    });
    expect(auditEvents[0].event_json).toMatchObject({
      appointmentId: appointment.id,
      fields: ["title", "status", "scheduled_start_at", "notes"]
    });
  });

  it("returns 404 for an unknown appointment id", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();

    const response = await PATCH(
      appointmentRequest("missing-appointment", {
        method: "PATCH",
        apiKey: "appointments-test-key",
        body: { status: "confirmed" }
      }),
      appointmentContext("missing-appointment")
    );

    expect(response.status).toBe(404);
  });
});

describe("BACKEND-20 DELETE /api/appointments/[id]", () => {
  it("deletes an appointment and audits the owner action", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const appointment = await runtime.appointmentRepository.create({
      business_id: business.id,
      title: "Delete me",
      scheduled_start_at: "2026-06-04T14:00:00.000Z"
    });

    const response = await DELETE(
      appointmentRequest(appointment.id, {
        method: "DELETE",
        apiKey: "appointments-test-key"
      }),
      appointmentContext(appointment.id)
    );
    const body = await response.json();
    const appointments = await runtime.appointmentRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(response.status).toBe(200);
    expect(body).toEqual({ deleted: true, id: appointment.id });
    expect(appointments).toHaveLength(0);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      event_type: "appointment.deleted",
      business_id: business.id
    });
  });
});
