"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createBusinessAppointment,
  deleteBusinessAppointment,
  updateBusinessAppointment
} from "@/server/appointments/api";
import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings, type PrivateNumberEntry } from "@/server/business/settings";
import type { BusinessSettingsUpdate } from "@/server/business/settings";
import { normalizePhoneNumber } from "@/server/phone/normalize";
import { getAppConfig } from "@/server/config";
import type { AppointmentStatus } from "@/server/db/schema";
import type { AppointmentUpdateInput } from "@/server/intake/appointments";
import { hasConfiguredExtractionProvider } from "@/server/intake/runtime";
import { sendOwnerApprovedSms } from "@/server/messages/outbound";
import { containsSlotReference } from "@/app/owner/inboundParser";
import { updateProfileForOwner } from "@/server/profiles/update";
import { recommendServicesFromTranscript } from "@/server/providers";
import { updateTaskForOwner } from "@/server/tasks/api";
import { savePortRequest, submitPortRequest } from "@/server/telephony/porting";
import { activateBusinessNumber } from "@/server/telephony/provisioning";

function revalidateOwner(profileId?: string): void {
  revalidatePath("/owner/today");
  revalidatePath("/owner/leads");
  if (profileId) revalidatePath(`/owner/${profileId}`);
}

// Appointment changes also touch the calendar + a lead's booked status across views.
function revalidateSchedule(profileId?: string | null): void {
  revalidatePath("/owner/calendar");
  revalidatePath("/owner/today");
  revalidatePath("/owner/leads");
  if (profileId) revalidatePath(`/owner/${profileId}`);
}

async function getRuntimeAndBusiness() {
  const context = await getOwnerBusinessContext();
  return {
    rt: context?.rt ?? null,
    business: context?.business ?? null
  };
}

export async function markCallbackDone(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  if (!taskId) return;

  const { rt, business } = await getRuntimeAndBusiness();
  try {
    if (rt && business) {
      await updateTaskForOwner(
        {
          taskRepository: rt.taskRepository,
          auditEventRepository: rt.auditEventRepository
        },
        {
          businessId: business.id,
          taskId,
          updates: { status: "done" }
        }
      );
    }
  } catch {
    /* task may have been reset */
  }

  revalidateOwner(profileId);
}

export async function setProfileStatus(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!profileId || !status) return;

  const { rt, business } = await getRuntimeAndBusiness();
  try {
    if (rt && business) {
      await updateProfileForOwner(
        {
          customerProfileRepository: rt.customerProfileRepository,
          auditEventRepository: rt.auditEventRepository
        },
        {
          businessId: business.id,
          profileId,
          updates: { status }
        }
      );
    }
  } catch {
    /* profile may have been reset */
  }

  revalidateOwner(profileId);
}

export async function markLeadWon(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  try {
    await updateProfileForOwner(
      { customerProfileRepository: rt.customerProfileRepository, auditEventRepository: rt.auditEventRepository },
      { businessId: business.id, profileId, updates: { status: "won" } }
    );
    // Won = the job's done, so mark this lead's open appointments completed.
    const appts = await rt.appointmentRepository.list();
    const apptDeps = {
      appointmentRepository: rt.appointmentRepository,
      customerProfileRepository: rt.customerProfileRepository,
      auditEventRepository: rt.auditEventRepository
    };
    await Promise.all(
      appts
        .filter(
          (a) =>
            a.business_id === business.id &&
            a.customer_profile_id === profileId &&
            (a.status === "scheduled" || a.status === "confirmed")
        )
        .map((a) => updateBusinessAppointment(apptDeps, business, a.id, { status: "completed" as AppointmentStatus }))
    );
  } catch {
    /* best-effort: status is what matters */
  }

  revalidateOwner(profileId);
  revalidatePath("/owner/calendar");
}

export async function saveCustomerDetails(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  if (!profileId) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  const pc = String(formData.get("preferred_contact") ?? "").trim();
  try {
    await updateProfileForOwner(
      { customerProfileRepository: rt.customerProfileRepository, auditEventRepository: rt.auditEventRepository },
      {
        businessId: business.id,
        profileId,
        updates: {
          vehicles: String(formData.get("vehicles") ?? "").trim() || null,
          po_box: String(formData.get("po_box") ?? "").trim() || null,
          preferred_contact: pc === "call" || pc === "text" || pc === "email" ? pc : null,
          referral_source: String(formData.get("referral_source") ?? "").trim() || null
        }
      }
    );
  } catch {
    /* best-effort */
  }

  revalidateOwner(profileId);
}

export async function sendOwnerText(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!profileId || !body) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;

  try {
    const result = await sendOwnerApprovedSms(
      {
        customerProfileRepository: rt.customerProfileRepository,
        messageRepository: rt.messageRepository,
        auditEventRepository: rt.auditEventRepository,
        smsProvider: rt.smsProvider,
        isSmsSendingEnabled: () => getAppConfig().smsSendingEnabled
      },
      {
        business,
        payload: {
          profile_id: profileId,
          body
        }
      }
    );

    if (result.status === "created" && (result.profile.status || "new") === "new") {
      await updateProfileForOwner(
        {
          customerProfileRepository: rt.customerProfileRepository,
          auditEventRepository: rt.auditEventRepository
        },
        {
          businessId: business.id,
          profileId,
          updates: { status: "contacted" }
        }
      );
    }
  } catch {
    /* ignore */
  }

  revalidateOwner(profileId);
}

export async function markContacted(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  if (!profileId) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt) return;
  const profile = (await rt.customerProfileRepository.list()).find((p) => p.id === profileId) ?? null;
  if (!profile) return;

  if (business && (profile.status || "new") === "new") {
    try {
      await updateProfileForOwner(
        {
          customerProfileRepository: rt.customerProfileRepository,
          auditEventRepository: rt.auditEventRepository
        },
        {
          businessId: business.id,
          profileId,
          updates: { status: "contacted" }
        }
      );
    } catch {
      /* profile may have been reset */
    }
  }

  revalidateOwner(profileId);
}

const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show"
];

function zonedWallTimeToUtcIso(wall: string, timeZone: string): string {
  const base = wall.length >= 19 ? wall.slice(0, 19) : `${wall}:00`;
  const guessUtc = new Date(`${base}Z`);
  if (Number.isNaN(guessUtc.getTime())) {
    return new Date().toISOString();
  }
  const tzShown = new Date(guessUtc.toLocaleString("en-US", { timeZone }));
  const utcShown = new Date(guessUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  const offsetMs = utcShown.getTime() - tzShown.getTime();
  return new Date(guessUtc.getTime() + offsetMs).toISOString();
}

export async function createAppointment(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "").trim() || null;
  const startLocal = String(formData.get("start") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim() || null;
  const location = String(formData.get("location") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const durationMinutes = Number(formData.get("duration") ?? "") || 60;
  if (!startLocal) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  const tz = business.timezone || "America/New_York";

  const startIso = zonedWallTimeToUtcIso(startLocal, tz);
  const endIso = new Date(new Date(startIso).getTime() + durationMinutes * 60_000).toISOString();

  await createBusinessAppointment(
    {
      appointmentRepository: rt.appointmentRepository,
      customerProfileRepository: rt.customerProfileRepository,
      auditEventRepository: rt.auditEventRepository
    },
    business,
    {
      business_id: business.id,
      customer_profile_id: profileId,
      title: title || service || "Appointment",
      service_requested: service,
      scheduled_start_at: startIso,
      scheduled_end_at: endIso,
      timezone: tz,
      status: "scheduled",
      location,
      notes
    }
  );

  // Booking an appointment moves the lead to "booked" so its status lines up
  // everywhere (Leads list, lead detail, filters).
  if (profileId) {
    try {
      await updateProfileForOwner(
        { customerProfileRepository: rt.customerProfileRepository, auditEventRepository: rt.auditEventRepository },
        { businessId: business.id, profileId, updates: { status: "booked" } }
      );
    } catch {
      /* status update is best-effort */
    }
  }

  // Auto-conflict resolution: find other open leads who were offered this same
  // slot in an outbound message, and send each an automatic apology text so they
  // know to pick a different time — without the owner having to do it manually.
  try {
    const bookedStart = new Date(startIso);
    const [allProfiles, allMessages] = await Promise.all([
      rt.customerProfileRepository.list(),
      rt.messageRepository.list()
    ]);

    const smsDeps = {
      customerProfileRepository: rt.customerProfileRepository,
      messageRepository: rt.messageRepository,
      auditEventRepository: rt.auditEventRepository,
      smsProvider: rt.smsProvider,
      isSmsSendingEnabled: () => getAppConfig().smsSendingEnabled
    };

    const openProfiles = allProfiles.filter(
      (p) =>
        p.id !== profileId &&
        p.business_id === business.id &&
        ["new", "contacted"].includes(p.status ?? "new") &&
        p.phone_e164
    );

    await Promise.all(
      openProfiles.map(async (profile) => {
        // Did the owner send this lead a message that mentions the booked slot?
        const wasOffered = allMessages
          .filter(
            (m) =>
              m.customer_profile_id === profile.id &&
              m.direction === "outbound" &&
              m.body
          )
          .some((m) => containsSlotReference(m.body ?? "", bookedStart));

        if (!wasOffered) return;

        const dayLabel = bookedStart.toLocaleString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
        });
        const firstName = profile.display_name?.split(" ")[0] || null;
        const greeting = firstName ? `Hi ${firstName}!` : "Hi there!";
        const apology = `${greeting} Sorry — ${dayLabel} just got booked by another customer. I still have other openings this week — just reply here and we'll find a time that works! — ${business.name}`;

        await sendOwnerApprovedSms(
          smsDeps,
          { business, payload: { profile_id: profile.id, body: apology } }
        );
      })
    );
  } catch {
    // Never let auto-apologies block or break the actual booking
  }

  revalidateSchedule(profileId);
}

export async function setAppointmentStatus(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!appointmentId || !APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    return;
  }

  const { rt, business } = await getRuntimeAndBusiness();
  try {
    if (rt && business) {
      await updateBusinessAppointment(
        {
          appointmentRepository: rt.appointmentRepository,
          customerProfileRepository: rt.customerProfileRepository,
          auditEventRepository: rt.auditEventRepository
        },
        business,
        appointmentId,
        { status: status as AppointmentStatus }
      );
    }
  } catch {
    /* appointment may have been reset */
  }

  revalidateSchedule();
}

export async function updateAppointment(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  if (!appointmentId) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt) return;
  const existing = await rt.appointmentRepository.findById(appointmentId);
  if (!existing) return;
  const tz = business?.timezone || existing.timezone || "America/New_York";

  const title = String(formData.get("title") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const startLocal = String(formData.get("start") ?? "").trim();
  const durationMinutes = Number(formData.get("duration") ?? "") || 60;
  const status = String(formData.get("status") ?? "").trim();

  const update: AppointmentUpdateInput = {
    title: title || existing.title,
    service_requested: service || null,
    location: location || null,
    notes: notes || null
  };
  if (APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    update.status = status as AppointmentStatus;
  }
  if (startLocal) {
    const startIso = zonedWallTimeToUtcIso(startLocal, tz);
    update.scheduled_start_at = startIso;
    update.scheduled_end_at = new Date(new Date(startIso).getTime() + durationMinutes * 60_000).toISOString();
  }

  try {
    if (business) {
      await updateBusinessAppointment(
        {
          appointmentRepository: rt.appointmentRepository,
          customerProfileRepository: rt.customerProfileRepository,
          auditEventRepository: rt.auditEventRepository
        },
        business,
        appointmentId,
        update
      );
    }
  } catch {
    /* appointment may have been reset */
  }

  revalidateSchedule(existing.customer_profile_id);
}

export async function deleteAppointment(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  if (!appointmentId) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt) return;
  const existing = await rt.appointmentRepository.findById(appointmentId);
  try {
    if (business) {
      await deleteBusinessAppointment(
        {
          appointmentRepository: rt.appointmentRepository,
          customerProfileRepository: rt.customerProfileRepository,
          auditEventRepository: rt.auditEventRepository
        },
        business,
        appointmentId
      );
    }
  } catch {
    /* appointment may have been reset */
  }

  revalidateSchedule(existing?.customer_profile_id);
}

// ------------------------- Private (personal) numbers -------------------------
// Personal contacts never get business handling. The list lives in settings_json.

async function writePrivateNumbers(entries: PrivateNumberEntry[]): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  try {
    await rt.businessRepository.updateSettings(business.id, { private_numbers: entries });
  } catch {
    /* business may have been reset */
  }
  revalidatePath("/owner/settings");
  revalidatePath("/owner/today");
  revalidatePath("/owner/leads");
}

// Add one or many: payload = JSON array of { name, phone } (raw phone formats ok).
export async function addPrivateNumbers(formData: FormData): Promise<void> {
  const { business } = await getRuntimeAndBusiness();
  if (!business) return;
  let incoming: { name?: unknown; phone?: unknown }[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("payload") ?? "[]"));
    if (Array.isArray(parsed)) incoming = parsed;
  } catch {
    return;
  }

  const existing = getBusinessSettings(business).private_numbers;
  const byPhone = new Map(existing.map((p) => [p.phone, p]));
  for (const item of incoming) {
    const rawPhone = typeof item.phone === "string" ? item.phone.trim() : "";
    if (!rawPhone) continue;
    let phone: string;
    try {
      phone = normalizePhoneNumber(rawPhone);
    } catch {
      continue; // skip unparseable entries
    }
    const name = typeof item.name === "string" ? item.name.trim().slice(0, 80) : "";
    if (!byPhone.has(phone) || (name && !byPhone.get(phone)?.name)) {
      byPhone.set(phone, { phone, name: name || byPhone.get(phone)?.name || "" });
    }
  }
  await writePrivateNumbers([...byPhone.values()].slice(0, 500));
}

export async function removePrivateNumber(formData: FormData): Promise<void> {
  const { business } = await getRuntimeAndBusiness();
  if (!business) return;
  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return;
  const existing = getBusinessSettings(business).private_numbers;
  await writePrivateNumbers(existing.filter((p) => p.phone !== phone));
}

// One-tap from a lead's contact card: toggle this person on/off the private list.
export async function setLeadPersonal(formData: FormData): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  const profileId = String(formData.get("profileId") ?? "");
  const makePersonal = String(formData.get("personal") ?? "") === "1";
  const profile = (await rt.customerProfileRepository.list()).find(
    (p) => p.id === profileId && p.business_id === business.id
  );
  if (!profile?.phone_e164) return;

  const existing = getBusinessSettings(business).private_numbers;
  const without = existing.filter((p) => p.phone !== profile.phone_e164);
  const next = makePersonal
    ? [...without, { phone: profile.phone_e164, name: (profile.display_name ?? "").slice(0, 80) }]
    : without;
  await writePrivateNumbers(next.slice(0, 500));
  revalidatePath(`/owner/${profileId}`);
}

// "Use my number" onboarding: saves the owner's real cell as both the shared-
// routing matcher (business_phone_e164 — what ForwardedFrom is matched against)
// and the owner's contact number.
export async function saveOwnerNumber(formData: FormData): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;

  const raw = String(formData.get("owner_cell") ?? "").trim();
  if (!raw) return;

  try {
    // The repository normalizes phones to E.164 (throws on garbage — caught below).
    await rt.businessRepository.update(business.id, {
      name: business.name,
      ownerName: business.owner_name,
      ownerPhone: raw,
      businessPhone: raw,
      timezone: business.timezone
    });
  } catch {
    /* unparseable number or business reset — leave things unchanged */
  }

  revalidatePath("/owner/settings");
  revalidatePath("/owner/today");
}

// Weekly goal targets from the Stats screen. 0 (or blank) clears a goal.
export async function saveGoals(formData: FormData): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;

  const read = (name: string): number => {
    const n = Number(formData.get(name) ?? 0);
    return Number.isFinite(n) && n > 0 ? Math.min(999, Math.round(n)) : 0;
  };

  try {
    await rt.businessRepository.updateSettings(business.id, {
      goals: {
        weekly_calls: read("weekly_calls"),
        weekly_leads: read("weekly_leads"),
        weekly_booked: read("weekly_booked")
      }
    });
  } catch {
    /* business may have been reset */
  }

  revalidatePath("/owner/stats");
}

export async function saveSettings(formData: FormData): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;

  const partial: BusinessSettingsUpdate = {};

  const brandColor = String(formData.get("brand_color") ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    partial.brand_color = brandColor.toLowerCase();
  }
  partial.logo_url = String(formData.get("logo_url") ?? "").trim();

  const autoText = String(formData.get("auto_text_message") ?? "").trim();
  if (autoText) {
    partial.auto_text_message = autoText;
  }

  const delayRaw = Number(formData.get("auto_text_delay_seconds") ?? 10);
  partial.auto_text_delay_seconds = Number.isFinite(delayRaw) ? Math.min(300, Math.max(0, Math.round(delayRaw))) : 10;

  // Always set (blank clears it → the server uses the default voicemail greeting).
  partial.voicemail_greeting = String(formData.get("voicemail_greeting") ?? "").trim();

  // Unchecked checkbox submits nothing → callers go straight to voicemail.
  partial.forward_calls = formData.get("forward_calls") === "on";

  const open = String(formData.get("hours_open") ?? "").trim();
  const close = String(formData.get("hours_close") ?? "").trim();
  const days = formData
    .getAll("days")
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  partial.business_hours = { open: open || "09:00", close: close || "17:00", days };

  const bufferRaw = Number(formData.get("travel_buffer_minutes") ?? 30);
  partial.travel_buffer_minutes = Number.isFinite(bufferRaw) ? Math.min(240, Math.max(0, Math.round(bufferRaw))) : 30;

  // Weather-smart booking: zip must be 5 digits (anything else turns weather off).
  const zipRaw = String(formData.get("weather_zip") ?? "").trim();
  const clampNum = (name: string, fallback: number, lo: number, hi: number): number => {
    const n = Number(formData.get(name) ?? fallback);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
  };
  partial.weather = {
    zip: /^\d{5}$/.test(zipRaw) ? zipRaw : "",
    min_temp_f: clampNum("weather_min_temp", 40, -30, 110),
    max_temp_f: clampNum("weather_max_temp", 95, 0, 130),
    max_rain_chance: clampNum("weather_max_rain", 50, 0, 100)
  };

  const services = formData.getAll("quote_service").map((v) => String(v).trim());
  const lows = formData.getAll("quote_low").map((v) => Number(v));
  const highs = formData.getAll("quote_high").map((v) => Number(v));
  const colors = formData.getAll("quote_color").map((v) => String(v).trim());
  const onCals = formData.getAll("quote_on_calendar").map((v) => String(v) !== "0");
  const durations = formData.getAll("quote_duration").map((v) => Number(v));
  partial.quote_ranges = services
    .map((service, i) => ({
      service,
      low: lows[i],
      high: highs[i],
      color: /^#[0-9a-fA-F]{6}$/.test(colors[i] ?? "") ? colors[i].toLowerCase() : "#5b5bd6",
      on_calendar: onCals[i] ?? true,
      duration_minutes: Number.isFinite(durations[i]) && durations[i] > 0 ? Math.round(durations[i]) : undefined
    }))
    .filter((range) => range.service && Number.isFinite(range.low) && Number.isFinite(range.high));

  const formalityRaw = Number(formData.get("ai_formality") ?? 2);
  const warmthRaw = Number(formData.get("ai_warmth") ?? 2);
  const levelRaw = Math.round(Number(formData.get("ai_auto_reply_level") ?? 0));
  partial.ai_reply = {
    ai_pick_enabled: formData.get("ai_pick_enabled") === "on",
    sign_off: String(formData.get("ai_sign_off") ?? "").trim(),
    custom_note: String(formData.get("ai_custom_note") ?? "").trim(),
    formality: Number.isFinite(formalityRaw) ? Math.min(4, Math.max(0, Math.round(formalityRaw))) : 2,
    warmth: Number.isFinite(warmthRaw) ? Math.min(4, Math.max(0, Math.round(warmthRaw))) : 2,
    quote_style: formData.get("ai_quote_style") === "itemized" ? "itemized" : "total",
    auto_reply_level: Number.isFinite(levelRaw) ? Math.min(3, Math.max(0, levelRaw)) : 0
  };

  try {
    await rt.businessRepository.updateSettings(business.id, partial);
  } catch {
    /* business may have been reset */
  }

  // Business name lives on the row (not settings_json); update it via the full
  // update, carrying existing values forward so nothing else is wiped.
  const businessName = String(formData.get("business_name") ?? "").trim();
  if (businessName && businessName !== business.name) {
    try {
      await rt.businessRepository.update(business.id, {
        name: businessName,
        ownerName: business.owner_name,
        ownerPhone: business.owner_phone_e164,
        businessPhone: business.business_phone_e164,
        timezone: business.timezone
      });
    } catch {
      /* business may have been reset */
    }
  }

  revalidatePath("/owner/settings");
  revalidatePath("/owner/leads");
  revalidatePath("/owner");
  revalidatePath("/owner/today");
  revalidatePath("/owner/calendar");
}

const SIM_VOICEMAIL_FALLBACK =
  "Hey, this is {name}. I'm looking to get {service} done - give me a call back when you can. Thanks!";

function randomSimPhone(): string {
  let exchange = 200 + Math.floor(Math.random() * 700);
  if (exchange === 555) exchange = 556;
  const line = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `+1415${exchange}${line}`;
}

export async function simulateLead(formData: FormData): Promise<void> {
  if (!getAppConfig().simulatorEnabled) return;

  const name = String(formData.get("name") ?? "").trim();
  const service = String(formData.get("service") ?? "").trim();
  const requested = String(formData.get("requested_datetime") ?? "").trim();
  let voicemail = String(formData.get("voicemail") ?? "").trim();

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;

  const existing = new Set(
    (await rt.customerProfileRepository.list())
      .map((p) => p.phone_e164)
      .filter((p): p is string => Boolean(p))
  );
  let phone = randomSimPhone();
  for (let i = 0; i < 25 && existing.has(phone); i++) phone = randomSimPhone();

  const realistic = !service && Boolean(voicemail);

  if (!voicemail) {
    voicemail = SIM_VOICEMAIL_FALLBACK
      .replaceAll("{name}", name || "there")
      .replaceAll("{service}", service || "some work");
  }

  const now = new Date().toISOString();
  const { profile } = await rt.customerProfileService.upsertByBusinessAndPhone({
    businessId: business.id,
    phone,
    displayName: name || null,
    source: "simulator",
    status: "new",
    lastContactAt: now
  });

  const providerCallId = `SIM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const baseCall = {
    business_id: business.id,
    customer_profile_id: profile.id,
    provider: "sandbox",
    provider_call_id: providerCallId,
    direction: "inbound" as const,
    call_type: "voicemail" as const,
    from_phone_e164: phone,
    to_phone_e164: business.business_phone_e164,
    started_at: now,
    duration_seconds: 20 + Math.floor(Math.random() * 40),
    needs_review: true
  };

  if (realistic) {
    await rt.callRecordRepository.create(baseCall);
    await rt.voiceIntakeService.handleRecording({ callSid: providerCallId, transcript: voicemail });
  } else {
    const summary = [
      name ? `${name} called` : "Caller left a voicemail",
      service ? `about ${service}` : null,
      requested ? `- wants ${requested}` : null
    ]
      .filter(Boolean)
      .join(" ")
      .concat(".");
    await rt.callRecordRepository.create({
      ...baseCall,
      transcript: voicemail,
      ai_summary: summary,
      extracted_json: {
        caller_name: name || null,
        requested_datetime: requested || null,
        service_requested: service || null,
        summary
      }
    });
  }

  const existingTask = await rt.taskRepository.findOpenCallbackTask(profile.id);
  if (!existingTask) {
    await rt.taskRepository.create({
      business_id: business.id,
      customer_profile_id: profile.id,
      task_type: "callback",
      title: "Call back missed caller",
      notes: "Simulated test lead",
      status: "open"
    });
  }

  revalidatePath("/owner");
  revalidatePath("/owner/today");
  revalidatePath("/owner/leads");
  revalidatePath(`/owner/${profile.id}`);
  redirect(`/owner/${profile.id}`);
}

// --- Batch demo-lead seeding (Simulator "spawn a bunch") --------------------
// Creates many varied, fully-populated demo leads at once so the owner can see
// how the dashboard handles real volume. Each is tagged source:"simulator".
const SIM_NAMES = [
  "Marcus", "Jenna", "Tyler", "Priya", "Diego", "Ashley", "Kevin", "Brittany",
  "Luis", "Hannah", "Derek", "Nicole", "Omar", "Chloe", "Brandon", "Maria",
  "Jordan", "Kayla", "Andre", "Sofia", "Trevor", "Megan", "Carlos", "Erica"
];
const SIM_SERVICES = [
  "Full detail", "Interior detail", "Wash & wax", "Ceramic coating",
  "Headlight restoration", "Pet hair removal", "Engine bay cleaning",
  "Paint correction", "Odor removal", "Maintenance wash", "Clay bar treatment"
];
const SIM_VEHICLES = [
  "sedan", "SUV", "pickup truck", "minivan", "Jeep", "work van",
  "crossover", "lifted truck", "sports car", "hatchback", "Tesla"
];
const SIM_TIMINGS = [
  "this Thursday morning", "sometime this weekend", "next Tuesday",
  "as soon as possible", "Friday afternoon", "early next week",
  "before the weekend", "whenever you have an opening", "Monday if you can"
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function simulateLeadBatch(formData: FormData): Promise<void> {
  if (!getAppConfig().simulatorEnabled) return;

  const requested = Math.floor(Number(formData.get("count") ?? 25));
  const count = Math.min(50, Math.max(1, Number.isFinite(requested) && requested > 0 ? requested : 25));

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;

  const used = new Set(
    (await rt.customerProfileRepository.list())
      .map((p) => p.phone_e164)
      .filter((p): p is string => Boolean(p))
  );

  const specs = Array.from({ length: count }, () => {
    let phone = randomSimPhone();
    for (let i = 0; i < 25 && used.has(phone); i++) phone = randomSimPhone();
    used.add(phone);
    return {
      phone,
      name: pickRandom(SIM_NAMES),
      service: pickRandom(SIM_SERVICES),
      vehicle: pickRandom(SIM_VEHICLES),
      timing: pickRandom(SIM_TIMINGS)
    };
  });

  await Promise.all(
    specs.map(async ({ phone, name, service, vehicle, timing }, idx) => {
      const now = new Date().toISOString();
      const voicemail = `Hi, this is ${name} — I've got a ${vehicle} I'd like ${service.toLowerCase()} on. Hoping to get it done ${timing}. Give me a call back, thanks!`;
      const summary = `${name} called about ${service.toLowerCase()} for their ${vehicle} — wants it ${timing}.`;

      const { profile } = await rt.customerProfileService.upsertByBusinessAndPhone({
        businessId: business.id,
        phone,
        displayName: name,
        source: "simulator",
        status: "new",
        lastContactAt: now
      });

      await rt.callRecordRepository.create({
        business_id: business.id,
        customer_profile_id: profile.id,
        provider: "sandbox",
        provider_call_id: `SIM-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000000)}`,
        direction: "inbound" as const,
        call_type: "voicemail" as const,
        from_phone_e164: phone,
        to_phone_e164: business.business_phone_e164,
        started_at: now,
        duration_seconds: 20 + Math.floor(Math.random() * 40),
        needs_review: true,
        transcript: voicemail,
        ai_summary: summary,
        extracted_json: {
          caller_name: name,
          requested_datetime: timing,
          service_requested: service,
          summary
        }
      });

      const existingTask = await rt.taskRepository.findOpenCallbackTask(profile.id);
      if (!existingTask) {
        await rt.taskRepository.create({
          business_id: business.id,
          customer_profile_id: profile.id,
          task_type: "callback",
          title: "Call back missed caller",
          notes: "Simulated test lead",
          status: "open"
        });
      }
    })
  );

  revalidatePath("/owner");
  revalidatePath("/owner/today");
  revalidatePath("/owner/leads");
  redirect("/owner/today");
}

export async function suggestServicesWithAI(input: {
  transcript: string;
  serviceNames: string[];
}): Promise<string[]> {
  const transcript = (input?.transcript ?? "").trim();
  const serviceNames = Array.isArray(input?.serviceNames) ? input.serviceNames.filter(Boolean) : [];
  if (!transcript || serviceNames.length === 0) return [];

  const cfg = getAppConfig();
  if (!hasConfiguredExtractionProvider(cfg)) return [];

  const requested = (process.env.EXTRACTION_PROVIDER ?? "").trim().toLowerCase();
  const anthropicReady = cfg.anthropicConfigured && Boolean(process.env.ANTHROPIC_API_KEY);
  const openAiReady = cfg.openAiConfigured && Boolean(process.env.OPENAI_API_KEY);

  let provider: "anthropic" | "openai" | null = null;
  if (requested === "openai" && openAiReady) provider = "openai";
  else if (requested === "anthropic" && anthropicReady) provider = "anthropic";
  else if (anthropicReady) provider = "anthropic";
  else if (openAiReady) provider = "openai";
  if (!provider) return [];

  const apiKey = (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) ?? "";
  try {
    return await recommendServicesFromTranscript({ transcript, serviceNames, provider, apiKey });
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Phone number — provisioning + porting (thin wrappers over the telephony
// services). Sandbox-safe: activateBusinessNumber simulates a number unless
// real Twilio provisioning is configured (TWILIO_AUTO_PROVISION + supabase
// mode + credentials + PUBLIC_BASE_URL).
// ---------------------------------------------------------------------------

export async function activateNumber(formData?: FormData): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  const areaRaw = formData ? String(formData.get("area_code") ?? "").replace(/\D/g, "") : "";
  const areaCode = areaRaw.length === 3 ? areaRaw : null;
  try {
    await activateBusinessNumber(
      business.id,
      { areaCode },
      { businessRepository: rt.businessRepository, auditEventRepository: rt.auditEventRepository }
    );
  } catch {
    /* provisioning unavailable */
  }
  revalidatePath("/owner/settings");
  revalidatePath("/owner/today");
}

export async function savePortInfo(formData: FormData): Promise<void> {
  const currentNumber = String(formData.get("current_number_e164") ?? "").trim();
  if (!currentNumber) return;

  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  try {
    await savePortRequest(
      {
        businessId: business.id,
        current_number_e164: currentNumber,
        current_carrier: String(formData.get("current_carrier") ?? "").trim() || null,
        account_number: String(formData.get("account_number") ?? "").trim() || null,
        account_pin: String(formData.get("account_pin") ?? "").trim() || null,
        billing_name: String(formData.get("billing_name") ?? "").trim() || null,
        billing_address: String(formData.get("billing_address") ?? "").trim() || null
      },
      {
        businessRepository: rt.businessRepository,
        numberPortRequestRepository: rt.numberPortRequestRepository,
        auditEventRepository: rt.auditEventRepository
      }
    );
  } catch {
    /* ignore */
  }
  revalidatePath("/owner/settings");
}

export async function submitPort(): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  try {
    await submitPortRequest(business.id, {
      businessRepository: rt.businessRepository,
      numberPortRequestRepository: rt.numberPortRequestRepository,
      auditEventRepository: rt.auditEventRepository
    });
  } catch {
    /* ignore */
  }
  revalidatePath("/owner/settings");
}
