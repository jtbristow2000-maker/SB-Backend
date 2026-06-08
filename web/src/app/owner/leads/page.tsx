import type { CSSProperties } from "react";

import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings } from "@/server/business/settings";
import type { CallRecordRow } from "@/server/db/schema";

import { buildLeadRundown } from "../leadRundown";
import { fmtPhone } from "../format";
import { LeadDirectory, type DirectoryLead } from "../LeadDirectory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner screen — Leads: the full pipeline. Every lead (not just open callbacks),
// searchable and filterable by stage, rendered with the same info cards as Today's
// Needs Attention. Replaces the retired standalone Callbacks screen.

const FALLBACK_TZ = "America/New_York";

// A short raw quote from the lead's most recent voicemail (falls back to an outcome
// label) — the same flavor of snippet the triage cards show.
function leadSnippet(profileId: string, calls: CallRecordRow[]): string {
  const profileCalls = calls
    .filter((c) => c.customer_profile_id === profileId)
    .sort((a, b) => {
      const at = a.started_at ?? a.created_at ?? "";
      const bt = b.started_at ?? b.created_at ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0; // newest first
    });
  const c = profileCalls.find((x) => x.transcript) ?? profileCalls[0];
  if (!c) return "";
  if (c.transcript) {
    const t = c.transcript.length > 90 ? `${c.transcript.slice(0, 90)}…` : c.transcript;
    return `“${t}”`;
  }
  if (c.call_type === "voicemail" || c.recording_url) return "Voicemail";
  return "Missed · no voicemail";
}

export default async function LeadsPage() {
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const [profiles, calls, appointments] = rt
    ? await Promise.all([
        rt.customerProfileRepository.list(),
        rt.callRecordRepository.list(),
        rt.appointmentRepository.list()
      ])
    : [[], [], []];
  const tz = business?.timezone || FALLBACK_TZ;
  const settings = getBusinessSettings(business);

  // Pick the most relevant appointment per lead (soonest upcoming, else most recent
  // past) so a booked lead's card can show "Booked · <when>".
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

  const fmtApptWhen = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });

  const leads: DirectoryLead[] = profiles
    .filter((p) => !business || p.business_id === business.id)
    .map((p) => {
      const appt = apptByProfile.get(p.id) ?? null;
      return {
        id: p.id,
        name: p.display_name || fmtPhone(p.phone_e164),
        phone_e164: p.phone_e164,
        status: p.status,
        next_appointment: appt,
        lastActivity: p.last_contact_at,
        snippet: leadSnippet(p.id, calls),
        rundown: buildLeadRundown(p.id, calls, settings.quote_ranges),
        bookingLabel: appt ? `Booked · ${fmtApptWhen(appt)}` : null
      };
    })
    .sort((a, b) => {
      const at = a.lastActivity ?? "";
      const bt = b.lastActivity ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0; // most recently heard first
    });

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Leads</h1>
      <div style={S.sub}>Your pipeline — where every lead stands, from new to booked to won.</div>
      <div style={{ marginTop: 16 }}>
        <LeadDirectory leads={leads} />
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 880, margin: "0 auto", padding: "26px 20px 48px", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1e2026" },
  h1: { margin: "4px 0 2px", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" },
  sub: { color: "var(--muted)", fontSize: 13 }
};
