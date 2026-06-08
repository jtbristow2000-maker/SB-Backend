import Link from "next/link";
import type { CSSProperties } from "react";

import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings } from "@/server/business/settings";
import { buildCallbackProfileList } from "@/server/profiles/callbacks";
import { LeadList, type LeadListItem } from "@/app/owner/LeadList";
import { buildLeadRundown, callMetaLabels } from "@/app/owner/leadRundown";
import { fmtPhone } from "@/app/owner/format";

// Always read current in-memory state (the sandbox runtime), never statically cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Owner screen 1 — Callbacks (triage list), per web/OWNER_UX.md.
// Server component: reads the sandbox runtime and reuses Codex's read-API
// builder (buildCallbackProfileList) so this matches GET /api/profiles exactly.
// ---------------------------------------------------------------------------

// Owner has reached out (vs a brand-new, untouched lead) → show the "Responded" pill.
const RESPONDED_STATUSES = new Set(["contacted", "booked", "won"]);

function outcomeSnippet(it: { last_call_outcome: string; voicemail_snippet: string | null }): string {
  if (it.last_call_outcome === "voicemail" && it.voicemail_snippet) {
    return `“${it.voicemail_snippet}${it.voicemail_snippet.length >= 80 ? "…" : ""}”`;
  }
  if (it.last_call_outcome === "missed") return "Missed · no voicemail";
  if (it.last_call_outcome === "answered") return "You answered";
  return "Voicemail";
}

export default async function OwnerCallbacks() {
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const [profiles, calls, messages, tasks] = rt ? await Promise.all([
    rt.customerProfileRepository.list(),
    rt.callRecordRepository.list(),
    rt.messageRepository.list(),
    rt.taskRepository.list()
  ]) : [[], [], [], []];
  const settings = getBusinessSettings(business);
  const items = business
    ? buildCallbackProfileList({ businessId: business.id, profiles, calls, messages, tasks })
    : [];
  const tz = business?.timezone || "America/New_York";
  const leadItems: LeadListItem[] = items.map((it) => {
    const m = callMetaLabels(it.id, calls, tz);
    return {
      id: it.id,
      name: it.display_name || fmtPhone(it.phone_e164),
      snippet: outcomeSnippet(it),
      customerReplied: it.customer_replied,
      responded: RESPONDED_STATUSES.has(it.status),
      lastActivity: it.last_contact_at,
      rundown: buildLeadRundown(it.id, calls, settings.quote_ranges),
      callTimeLabel: m.timeLabel,
      voicemailLabel: m.vmLabel,
      status: it.status
    };
  });

  return (
    <main style={S.shell}>
      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>{business?.name ?? "Owner"}</div>
          <h1 style={S.h1}>Callbacks</h1>
          <div style={S.sub}>
            {items.length === 0 ? "No one waiting" : `${items.length} ${items.length === 1 ? "person" : "people"} to call back`}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/owner" style={S.linkBtn}>↻ Refresh</Link>
        </div>
      </header>

      {items.length === 0 && (
        <div style={S.empty}>
          You&apos;re all caught up — no callbacks waiting.
          <div style={{ marginTop: 8, fontSize: 13 }}>
            New leads from missed calls and texts will show up here automatically.
          </div>
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <LeadList items={leadItems} />
      </div>

      <footer style={S.footer}>
        Updates automatically as new calls and texts come in.
      </footer>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  shell: { maxWidth: 720, margin: "0 auto", padding: "26px 20px 48px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c" },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  sub: { color: "#8a909c", fontSize: 13 },
  empty: { marginTop: 28, padding: "28px 18px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", textAlign: "center", color: "#3c414b" },
  linkBtn: { padding: "8px 12px", borderRadius: 10, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" },
  footer: { marginTop: 26, color: "#8a909c", fontSize: 12 }
};
