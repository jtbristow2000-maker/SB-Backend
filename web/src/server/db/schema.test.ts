import { describe, expect, it } from "vitest";

import {
  BACKEND_02_TABLES,
  BACKEND_03_TABLES,
  type AppointmentRow,
  type AuditEventRow,
  type BusinessMemberRow,
  type BusinessRow,
  type CustomerProfileRow,
  type Database,
  type NumberPortRequestRow,
  type VoicemailGreetingRow
} from "./schema";

describe("BACKEND-02 database contract", () => {
  it("declares the required foundation tables", () => {
    expect(BACKEND_02_TABLES).toEqual([
      "businesses",
      "customer_profiles",
      "call_records",
      "messages",
      "tasks"
    ]);
  });

  it("keeps customer profiles business scoped and phone-normalization ready", () => {
    const profile = {
      id: "profile_1",
      business_id: "business_1",
      display_name: "Taylor Customer",
      phone_e164: "+15551234567",
      email: null,
      vehicles: "2019 Tahoe; wife's Civic",
      address_line1: null,
      address_line2: null,
      po_box: null,
      city: null,
      state: null,
      postal_code: null,
      preferred_contact: "text",
      referral_source: "neighbor",
      source: "missed_call",
      status: "new",
      summary: null,
      notes: null,
      last_contact_at: null,
      created_at: "2026-05-31T00:00:00.000Z",
      updated_at: "2026-05-31T00:00:00.000Z"
    } satisfies CustomerProfileRow;

    expect(profile.business_id).toBe("business_1");
    expect(profile.phone_e164).toBe("+15551234567");
  });

  it("exposes Supabase-style table types", () => {
    type Tables = keyof Database["public"]["Tables"];
    const table: Tables = "customer_profiles";

    expect(table).toBe("customer_profiles");
  });
});

describe("BACKEND-03 appointment contract", () => {
  it("adds appointments without removing foundation tables", () => {
    expect(BACKEND_03_TABLES).toEqual([...BACKEND_02_TABLES, "appointments"]);
  });

  it("keeps appointments business scoped and schedule-first", () => {
    const appointment = {
      id: "appointment_1",
      business_id: "business_1",
      customer_profile_id: "profile_1",
      source_call_record_id: null,
      title: "Pressure washing estimate",
      service_requested: "Driveway pressure washing",
      scheduled_start_at: "2026-06-01T15:00:00.000Z",
      scheduled_end_at: null,
      timezone: "America/New_York",
      status: "scheduled",
      location: "123 Main St",
      notes: null,
      created_at: "2026-05-31T00:00:00.000Z",
      updated_at: "2026-05-31T00:00:00.000Z"
    } satisfies AppointmentRow;

    expect(appointment.business_id).toBe("business_1");
    expect(appointment.scheduled_start_at).toContain("2026-06-01");
  });
});

describe("BACKEND-08 audit event contract", () => {
  it("supports system audit events for missed-call workflow changes", () => {
    const auditEvent = {
      id: "audit_1",
      business_id: "business_1",
      customer_profile_id: "profile_1",
      actor: "system",
      event_type: "call.missed",
      event_json: { providerCallId: "CA_TEST" },
      created_at: "2026-05-31T00:00:00.000Z"
    } satisfies AuditEventRow;

    expect(auditEvent.actor).toBe("system");
    expect(auditEvent.event_type).toBe("call.missed");
  });
});

describe("owner auth tenancy contract", () => {
  it("declares business membership rows for per-user owner access", () => {
    const member = {
      id: "member_1",
      business_id: "business_1",
      user_id: "user_1",
      role: "owner",
      created_at: "2026-06-03T00:00:00.000Z"
    } satisfies BusinessMemberRow;

    type Tables = keyof Database["public"]["Tables"];
    const table: Tables = "business_members";

    expect(member.role).toBe("owner");
    expect(table).toBe("business_members");
  });
});

describe("business telephony contract", () => {
  it("tracks per-business Twilio numbers and port requests", () => {
    const business = {
      id: "business_1",
      name: "Detail Co",
      owner_name: "Owner",
      owner_phone_e164: "+12133734253",
      business_phone_e164: "+13105550199",
      twilio_number_e164: "+14155550100",
      twilio_number_sid: "PN_TEST",
      number_status: "trial",
      number_trial_ends_at: "2026-06-17T00:00:00.000Z",
      timezone: "America/New_York",
      settings_json: {},
      created_at: "2026-06-03T00:00:00.000Z",
      updated_at: "2026-06-03T00:00:00.000Z"
    } satisfies BusinessRow;
    const portRequest = {
      id: "port_1",
      business_id: business.id,
      current_number_e164: "+19495550100",
      current_carrier: "Carrier",
      account_number: "acct",
      account_pin: "pin",
      billing_name: "Owner",
      billing_address: "123 Main St",
      loa_signed_at: null,
      bill_uploaded: false,
      status: "collecting",
      created_at: "2026-06-03T00:00:00.000Z"
    } satisfies NumberPortRequestRow;

    type Tables = keyof Database["public"]["Tables"];
    const table: Tables = "number_port_requests";

    expect(business.number_status).toBe("trial");
    expect(portRequest.business_id).toBe(business.id);
    expect(table).toBe("number_port_requests");
  });
});

describe("voicemail greeting audio contract", () => {
  it("declares a business-keyed audio row for recorded greetings", () => {
    const greeting = {
      business_id: "business_1",
      audio_bytes: "\\x52494646",
      content_type: "audio/wav",
      created_at: "2026-06-08T00:00:00.000Z",
      updated_at: "2026-06-08T00:00:00.000Z"
    } satisfies VoicemailGreetingRow;

    type Tables = keyof Database["public"]["Tables"];
    const table: Tables = "voicemail_greetings";

    expect(greeting.business_id).toBe("business_1");
    expect(greeting.content_type).toBe("audio/wav");
    expect(table).toBe("voicemail_greetings");
  });
});
