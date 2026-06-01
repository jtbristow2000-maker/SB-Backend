"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
    await rt.customerProfileRepository.update(profileId, {
      last_contact_at: now,
      // Logging a reply counts as reaching out → show "Responded" (don't downgrade booked/won).
      ...((profile.status || "new") === "new" ? { status: "contacted" } : {})
    });
  } catch {
    /* ignore */
  }

  revalidateOwner(profileId);
}

// Tapping Call back / Text on a lead records that the owner reached out, so the
// lead shows "Responded" on the dashboards. Only promotes a brand-new lead to
// "contacted" — never overrides a later stage (booked/won/lost).
export async function markContacted(formData: FormData): Promise<void> {
  const profileId = String(formData.get("profileId") ?? "").trim();
  if (!profileId) return;
  const rt = await getIntakeRuntime();
  const profile = (await rt.customerProfileRepository.list()).find((p) => p.id === profileId) ?? null;
  if (!profile) return;
  if ((profile.status || "new") === "new") {
    try {
      await rt.customerProfileRepository.update(profileId, { status: "contacted" });
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

// ---------------------------------------------------------------------------
// Simulator — spawns a DISTINCT fake lead (unique phone) with pre-filled
// AI-extracted details, so the quote/suggested-reply tool can be tested across
// many scenarios without needing many real phone numbers. Gated by
// SIMULATOR_ENABLED (on by default; turn off for client deployments).
// ---------------------------------------------------------------------------

const SIM_VOICEMAIL_FALLBACK =
  "Hey, this is {name}. I'm looking to get {service} done — give me a call back when you can. Thanks!";

// A valid-looking US number (area code 415), avoiding the 555 exchange that the
// phone normalizer rejects. Used only to keep each test lead a separate customer.
function randomSimPhone(): string {
  let exchange = 200 + Math.floor(Math.random() * 700); // 200–899
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

  const rt = await getIntakeRuntime();
  const business = (await rt.businessRepository.list())[0] ?? null;
  if (!business) return;

  // Unique phone => every test lead is its own customer (not piled onto one).
  const existing = new Set(
    (await rt.customerProfileRepository.list())
      .map((p) => p.phone_e164)
      .filter((p): p is string => Boolean(p))
  );
  let phone = randomSimPhone();
  for (let i = 0; i < 25 && existing.has(phone); i++) phone = randomSimPhone();

  // Realistic mode: no manual service hint, so let the SAME AI pipeline that runs on
  // a real voicemail read the transcript (name / service / timing). Filling the
  // service field switches to manual mode (deterministic, skips the AI).
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
    // Create the voicemail WITHOUT a transcript, then run the real recording handler
    // so AI extraction parses the transcript exactly like a live missed call does.
    await rt.callRecordRepository.create(baseCall);
    await rt.voiceIntakeService.handleRecording({ callSid: providerCallId, transcript: voicemail });
  } else {
    // Manual mode: set the extracted fields directly so the scenario is deterministic.
    const summary = [
      name ? `${name} called` : "Caller left a voicemail",
      service ? `about ${service}` : null,
      requested ? `— wants ${requested}` : null
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
