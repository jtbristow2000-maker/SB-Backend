"use server";

import { revalidatePath } from "next/cache";

import { getAppConfig } from "@/server/config";
import type { BusinessSettingsUpdate } from "@/server/business/settings";
import type { AppointmentStatus } from "@/server/db/schema";
import { getIntakeRuntime } from "@/server/intake/runtime";

// ---------------------------------------------------------------------------
// Owner screen server actions (sandbox). These mutate the same in-memory runtime
// the owner screens read, then revalidate so the UI refreshes. No API key needed
// in the browser. The real app will call the guarded /api/* endpoints once auth
// + persistence (Supabase) land.
// ---------------------------------------------------------------------------

function revalidateOwner(profileId?: string): void {
  revalidatePath("/owner");
  revalidatePath("/owner/today");
  if (profileId) revalidatePath(`/owner/${profileId}`);
}

export async function markCallbackDone(formData: FormData): Promise<void> {
  const taskId = String(formData.get("taskId") ?? "");
  const profileId = String(formData.get("profileId") ?? "");
  if (!taskId) return;
  const rt = await getIntakeRuntime();
  try {
    await rt.taskRepository.update(taskId, { status: "done" });
  } catch {
    /* task may have been reset */
  }
  revalidateOwner(profileId);
}

export async function setProfileStatus(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const status = String(formData.get("status") ?? "").trim();
  if (!profileId || !status) return;
  const rt = await getIntakeRuntime();
  try {
    await rt.customerProfileRepository.update(profileId, { status });
  } catch {
    /* profile may have been reset */
  }
  revalidateOwner(profileId);
}

export async function sendOwnerText(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!profileId || !body) return;

  const rt = await getIntakeRuntime();
  const businesses = await rt.businessRepository.list();
  const business = businesses[0] ?? null;
  const profile = (await rt.customerProfileRepository.list()).find((p) => p.id === profileId) ?? null;
  if (!business || !profile) return;

  const sending = getAppConfig().smsSendingEnabled;
  const now = new Date().toISOString();

  await rt.messageRepository.create({
    business_id: business.id,
    customer_profile_id: profile.id,
    direction: "outbound",
    channel: "sms",
    from_phone_e164: business.business_phone_e164,
    to_phone_e164: profile.phone_e164,
    body,
    status: sending ? "sent" : "queued",
    sent_at: sending ? now : null
  });
  try {
    await rt.customerProfileRepository.update(profileId, { last_contact_at: now });
  } catch {
    /* ignore */
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

// Convert a datetime-local wall-clock string ("YYYY-MM-DDTHH:mm", entered in the
// business timezone) into a UTC ISO instant — DST-aware, no date library.
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
  const durationMinutes = Number(formData.get("duration") ?? "") || 60;
  if (!startLocal) return;

  const rt = await getIntakeRuntime();
  const business = (await rt.businessRepository.list())[0] ?? null;
  if (!business) return;
  const tz = business.timezone || "America/New_York";

  const startIso = zonedWallTimeToUtcIso(startLocal, tz);
  const endIso = new Date(new Date(startIso).getTime() + durationMinutes * 60_000).toISOString();

  await rt.appointmentRepository.create({
    business_id: business.id,
    customer_profile_id: profileId,
    title: title || service || "Appointment",
    service_requested: service,
    scheduled_start_at: startIso,
    scheduled_end_at: endIso,
    timezone: tz,
    status: "scheduled"
  });

  revalidatePath("/owner/calendar");
  revalidatePath("/owner/today");
  if (profileId) {
    revalidatePath(`/owner/${profileId}`);
  }
}

export async function setAppointmentStatus(formData: FormData): Promise<void> {
  const appointmentId = String(formData.get("appointmentId") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();
  if (!appointmentId || !APPOINTMENT_STATUSES.includes(status as AppointmentStatus)) {
    return;
  }
  const rt = await getIntakeRuntime();
  try {
    await rt.appointmentRepository.update(appointmentId, { status: status as AppointmentStatus });
  } catch {
    /* appointment may have been reset */
  }
  revalidatePath("/owner/calendar");
}

export async function saveSettings(formData: FormData): Promise<void> {
  const rt = await getIntakeRuntime();
  const business = (await rt.businessRepository.list())[0] ?? null;
  if (!business) return;

  const partial: BusinessSettingsUpdate = {};

  const brandColor = String(formData.get("brand_color") ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(brandColor)) {
    partial.brand_color = brandColor.toLowerCase();
  }

  const autoText = String(formData.get("auto_text_message") ?? "").trim();
  if (autoText) {
    partial.auto_text_message = autoText;
  }

  const open = String(formData.get("hours_open") ?? "").trim();
  const close = String(formData.get("hours_close") ?? "").trim();
  const days = formData
    .getAll("days")
    .map((d) => Number(d))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  partial.business_hours = { open: open || "09:00", close: close || "17:00", days };

  const services = formData.getAll("quote_service").map((v) => String(v).trim());
  const lows = formData.getAll("quote_low").map((v) => Number(v));
  const highs = formData.getAll("quote_high").map((v) => Number(v));
  partial.quote_ranges = services
    .map((service, i) => ({ service, low: lows[i], high: highs[i] }))
    .filter((range) => range.service && Number.isFinite(range.low) && Number.isFinite(range.high));

  try {
    await rt.businessRepository.updateSettings(business.id, partial);
  } catch {
    /* business may have been reset */
  }

  revalidatePath("/owner/settings");
  revalidatePath("/owner");
  revalidatePath("/owner/today");
  revalidatePath("/owner/calendar");
}
