"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createBusinessAppointment,
  deleteBusinessAppointment,
  updateBusinessAppointment
} from "@/server/appointments/api";
import { getOwnerBusinessContext } from "@/server/business/current";
import type { BusinessSettingsUpdate } from "@/server/business/settings";
import { getAppConfig } from "@/server/config";
import type { AppointmentStatus } from "@/server/db/schema";
import type { AppointmentUpdateInput } from "@/server/intake/appointments";
import { hasConfiguredExtractionProvider } from "@/server/intake/runtime";
import { sendOwnerApprovedSms } from "@/server/messages/outbound";
import { updateProfileForOwner } from "@/server/profiles/update";
import { recommendServicesFromTranscript } from "@/server/providers";
import { updateTaskForOwner } from "@/server/tasks/api";
import { savePortRequest, submitPortRequest } from "@/server/telephony/porting";
import { activateBusinessNumber } from "@/server/telephony/provisioning";

function revalidateOwner(profileId?: string): void {
  revalidatePath("/owner");
  revalidatePath("/owner/today");
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

  revalidatePath("/owner/calendar");
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

  revalidatePath("/owner/calendar");
  revalidatePath("/owner/today");
  if (existing.customer_profile_id) revalidatePath(`/owner/${existing.customer_profile_id}`);
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

  revalidatePath("/owner/calendar");
  revalidatePath("/owner/today");
  if (existing?.customer_profile_id) revalidatePath(`/owner/${existing.customer_profile_id}`);
}

export async function saveSettings(formData: FormData): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;

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

export async function activateNumber(): Promise<void> {
  const { rt, business } = await getRuntimeAndBusiness();
  if (!rt || !business) return;
  try {
    await activateBusinessNumber(
      business.id,
      {},
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
