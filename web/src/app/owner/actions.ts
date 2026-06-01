"use server";

import { revalidatePath } from "next/cache";

import { getAppConfig } from "@/server/config";
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
