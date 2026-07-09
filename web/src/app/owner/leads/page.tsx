import type { CSSProperties } from "react";

import { getOwnerBusinessContext } from "@/server/business/current";

import { LeadDirectory, type DirectoryLead } from "../LeadDirectory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner screen 3 — Leads: a searchable directory of EVERY lead (not just open
// callbacks). Filtering/search is client-side (LeadDirectory island).

const FALLBACK_TZ = "America/New_York";

export default async function LeadsPage() {
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const [profiles, appointments] = rt
    ? await Promise.all([rt.customerProfileRepository.list(), rt.appointmentRepository.list()])
    : [[], []];
  const tz = business?.timezone || FALLBACK_TZ;

  // Pick the most relevant appointment per lead (soonest upcoming, else most recent
  // past) so the directory can show "Booked · <when>" instead of a generic timestamp.
  const nowMs = Date.now();
  const apptByProfile = new Map<string, string>();
  for (const a of appointments) {
    if ((business && a.business_id !== business.id) || !a.customer_profile_id) continue;
    if (a.status === "cancelled" || a.status === "no_show") continue;
    const pid = a.customer_profile_id;
    const cur = apptByProfile.get(pid);
    if (!cur) {
      apptByProfile.set(pid, a.scheduled_start_at);
      continue;
    }
    const curMs = new Date(cur).getTime();
    const aMs = new Date(a.scheduled_start_at).getTime();
    const curUp = curMs >= nowMs;
    const aUp = aMs >= nowMs;
    if (aUp && (!curUp || aMs < curMs)) apptByProfile.set(pid, a.scheduled_start_at);
    else if (!aUp && !curUp && aMs > curMs) apptByProfile.set(pid, a.scheduled_start_at);
  }

  const leads: DirectoryLead[] = profiles
    .filter((p) => !business || p.business_id === business.id)
    .map((p) => ({
      id: p.id,
      display_name: p.display_name,
      phone_e164: p.phone_e164,
      status: p.status,
      last_contact_at: p.last_contact_at,
      next_appointment: apptByProfile.get(p.id) ?? null
    }))
    .sort((a, b) => {
      const at = a.last_contact_at ?? "";
      const bt = b.last_contact_at ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0; // most recently heard first
    });

  return (
    <main className="owner-page" style={S.page}>
      <h1 style={S.h1}>Leads</h1>
      <div style={S.sub}>Your pipeline — where every lead stands, from new to booked to won.</div>
      <div style={{ marginTop: 16 }}>
        <LeadDirectory leads={leads} tz={tz} />
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 920 },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  sub: { color: "var(--muted)", fontSize: 13 }
};
