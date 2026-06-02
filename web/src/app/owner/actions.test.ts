import { afterEach, describe, expect, it, vi } from "vitest";

import { getIntakeRuntime, resetIntakeRuntimeForTests } from "@/server/intake/runtime";

import {
  createAppointment,
  deleteAppointment,
  markCallbackDone,
  markContacted,
  sendOwnerText,
  setAppointmentStatus,
  setProfileStatus,
  updateAppointment
} from "./actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn()
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn()
}));

const originalEnv = {
  BUSINESS_ID: process.env.BUSINESS_ID,
  BUSINESS_NAME: process.env.BUSINESS_NAME,
  OWNER_PHONE: process.env.OWNER_PHONE,
  BUSINESS_PHONE: process.env.BUSINESS_PHONE,
  TIMEZONE: process.env.TIMEZONE,
  SMS_SENDING_ENABLED: process.env.SMS_SENDING_ENABLED
};

function configureEnv(): void {
  process.env.BUSINESS_ID = "00000000-0000-4000-8000-000000000522";
  process.env.BUSINESS_NAME = "Owner Actions Co";
  process.env.OWNER_PHONE = "(213) 373-4253";
  process.env.BUSINESS_PHONE = "(310) 555-0199";
  process.env.TIMEZONE = "America/New_York";
  process.env.SMS_SENDING_ENABLED = "false";
}

function form(values: Record<string, string | null | undefined>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) {
      data.set(key, value);
    }
  }
  return data;
}

afterEach(() => {
  process.env.BUSINESS_ID = originalEnv.BUSINESS_ID;
  process.env.BUSINESS_NAME = originalEnv.BUSINESS_NAME;
  process.env.OWNER_PHONE = originalEnv.OWNER_PHONE;
  process.env.BUSINESS_PHONE = originalEnv.BUSINESS_PHONE;
  process.env.TIMEZONE = originalEnv.TIMEZONE;
  process.env.SMS_SENDING_ENABLED = originalEnv.SMS_SENDING_ENABLED;
  resetIntakeRuntimeForTests();
  vi.clearAllMocks();
});

describe("owner server actions audit alignment", () => {
  it("uses the owner-approved SMS helper and audits the text plus contacted status", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550140",
        displayName: "Text Action Customer",
        source: "manual",
        status: "new"
      })
    ).profile;

    await sendOwnerText(
      form({
        profileId: profile.id,
        body: "Thanks, I can call you shortly."
      })
    );

    const messages = await runtime.messageRepository.list();
    const profiles = await runtime.customerProfileRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      customer_profile_id: profile.id,
      provider: "sandbox",
      direction: "outbound",
      channel: "sms",
      status: "queued",
      body: "Thanks, I can call you shortly."
    });
    expect(profiles.find((candidate) => candidate.id === profile.id)?.status).toBe("contacted");
    expect(auditEvents.map((event) => event.event_type)).toEqual([
      "message.owner_sms.queued",
      "profile.update"
    ]);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      business_id: business.id,
      customer_profile_id: profile.id
    });
    expect(auditEvents[1].event_json).toMatchObject({
      profileId: profile.id,
      changes: {
        status: { from: "new", to: "contacted" }
      }
    });
  });

  it("audits owner profile and task actions through canonical helpers", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const statusProfile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550141",
        displayName: "Status Customer",
        source: "manual",
        status: "new"
      })
    ).profile;
    const contactedProfile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550142",
        displayName: "Contacted Customer",
        source: "manual",
        status: "new"
      })
    ).profile;
    const task = await runtime.taskRepository.create({
      business_id: business.id,
      customer_profile_id: statusProfile.id,
      task_type: "callback",
      title: "Call back missed caller",
      status: "open"
    });

    await setProfileStatus(form({ profileId: statusProfile.id, status: "booked" }));
    await markContacted(form({ profileId: contactedProfile.id }));
    await markCallbackDone(form({ taskId: task.id, profileId: statusProfile.id }));

    const tasks = await runtime.taskRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(tasks.find((candidate) => candidate.id === task.id)?.status).toBe("done");
    expect(auditEvents.map((event) => event.event_type)).toEqual([
      "profile.update",
      "profile.update",
      "task.update"
    ]);
    expect(auditEvents[0].event_json).toMatchObject({
      profileId: statusProfile.id,
      changes: { status: { from: "new", to: "booked" } }
    });
    expect(auditEvents[1].event_json).toMatchObject({
      profileId: contactedProfile.id,
      changes: { status: { from: "new", to: "contacted" } }
    });
    expect(auditEvents[2].event_json).toMatchObject({
      taskId: task.id,
      changes: { status: { from: "open", to: "done" } }
    });
  });

  it("audits appointment create, status update, edit, and delete actions", async () => {
    configureEnv();
    resetIntakeRuntimeForTests();
    const runtime = await getIntakeRuntime();
    const business = (await runtime.businessRepository.list())[0];
    const profile = (
      await runtime.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone: "+19495550143",
        displayName: "Appointment Action Customer",
        source: "manual"
      })
    ).profile;

    await createAppointment(
      form({
        profileId: profile.id,
        start: "2026-06-04T10:00",
        title: "Initial appointment",
        service: "Full detail",
        location: "123 Main St",
        notes: "Bring water",
        duration: "90"
      })
    );
    const created = (await runtime.appointmentRepository.list())[0];

    await setAppointmentStatus(form({ appointmentId: created.id, status: "confirmed" }));
    await updateAppointment(
      form({
        appointmentId: created.id,
        title: "Updated appointment",
        service: "Interior detail",
        location: "456 Oak St",
        notes: "Gate code 1234",
        start: "2026-06-05T11:00",
        duration: "60",
        status: "scheduled"
      })
    );
    await deleteAppointment(form({ appointmentId: created.id }));

    const appointments = await runtime.appointmentRepository.list();
    const auditEvents = await runtime.auditEventRepository.list();

    expect(appointments).toHaveLength(0);
    expect(auditEvents.map((event) => event.event_type)).toEqual([
      "appointment.created",
      "appointment.updated",
      "appointment.updated",
      "appointment.deleted"
    ]);
    expect(auditEvents[0]).toMatchObject({
      actor: "owner",
      business_id: business.id,
      customer_profile_id: profile.id
    });
    expect(auditEvents[1].event_json).toMatchObject({
      appointmentId: created.id,
      fields: ["status"]
    });
    expect(auditEvents[2].event_json).toMatchObject({
      appointmentId: created.id
    });
    expect(auditEvents[3].event_json).toMatchObject({
      appointmentId: created.id
    });
  });
});
