import Link from "next/link";
import type { CSSProperties } from "react";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { buildCallbackProfileList } from "@/server/profiles/callbacks";
import { LeadList, type LeadListItem } from "@/app/owner/LeadList";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Today — the overview/home screen: greeting, metric cards, needs-attention.
// Server component; metrics derived from the sandbox runtime + read-API builder.
// Greeting, date, and "calls today" are computed in the business timezone so
// they're correct regardless of where the server runs (Vercel = UTC).
// ---------------------------------------------------------------------------

const FALLBACK_TZ = "America/New_York";

function fmtPhone(p: string | null): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

function greeting(tz: string): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date())) % 24;
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

// Owner has reached out (vs a brand-new, untouched lead) → show the "Responded" pill.
const RESPONDED_STATUSES = new Set(["contacted", "booked", "won"]);

function outcomeSnippet(c: { last_call_outcome: string; voicemail_snippet: string | null }): string {
  if (c.last_call_outcome === "voicemail" && c.voicemail_snippet) return `“${c.voicemail_snippet}…”`;
  if (c.last_call_outcome === "missed") return "Missed · no voicemail";
  if (c.last_call_outcome === "answered") return "You answered";
  return "Voicemail";
}

export default async function Today() {
  const rt = await getIntakeRuntime();
  const [businesses, profiles, calls, messages, tasks] = await Promise.all([
    rt.businessRepository.list(),
    rt.customerProfileRepository.list(),
    rt.callRecordRepository.list(),
    rt.messageRepository.list(),
    rt.taskRepository.list()
  ]);
  const business = businesses[0] ?? null;
  const tz = business?.timezone || FALLBACK_TZ;
  const callbacks = business
    ? buildCallbackProfileList({ businessId: business.id, profiles, calls, messages, tasks })
    : [];

  const replied = callbacks.filter((c) => c.customer_replied).length;
  const voicemails = calls.filter((c) => c.transcript || c.call_type === "voicemail").length;
  // Compare calendar days in the business timezone (en-CA → YYYY-MM-DD).
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const todayKey = dayKey(new Date());
  const callsToday = calls.filter((c) => c.started_at && dayKey(new Date(c.started_at)) === todayKey).length;

  const metrics = [
    { label: "Callbacks waiting", value: callbacks.length, accent: "var(--brand)", icon: "📞", href: "/owner" },
    { label: "Replied — waiting on you", value: replied, accent: "var(--positive)", icon: "💬", href: "/owner" },
    { label: "Voicemails", value: voicemails, accent: "#c77d14", icon: "🎙️", href: "/owner/leads" },
    { label: "Calls today", value: callsToday, accent: "#3a7bd0", icon: "📆", href: "/owner/leads" }
  ];

  const attentionItems: LeadListItem[] = callbacks.slice(0, 5).map((c) => ({
    id: c.id,
    name: c.display_name || fmtPhone(c.phone_e164),
    snippet: outcomeSnippet(c),
    customerReplied: c.customer_replied,
    responded: RESPONDED_STATUSES.has(c.status),
    lastActivity: c.last_contact_at
  }));

  return (
    <main style={S.page}>
      <div style={S.greeting}>{greeting(tz)}</div>
      <div style={S.date}>
        {new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" })}
      </div>

      <div style={S.metricRow}>
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} style={S.metricCard}>
            <div style={metricChip(m.accent)}>{m.icon}</div>
            <div style={S.metricValue}>{m.value}</div>
            <div style={S.metricLabel}>{m.label}</div>
          </Link>
        ))}
      </div>

      <div style={S.sectionLabel}>NEEDS ATTENTION</div>
      {callbacks.length === 0 ? (
        <div style={S.empty}>
          You&apos;re all caught up. New missed calls will show up here automatically.
        </div>
      ) : (
        <div>
          <LeadList items={attentionItems} />
          {callbacks.length > 5 && (
            <Link href="/owner" style={S.viewAll}>View all {callbacks.length} callbacks →</Link>
          )}
        </div>
      )}
    </main>
  );
}

const S = {
  page: { maxWidth: 860, margin: "0 auto", padding: "30px 28px 48px", color: "#1e2026", fontFamily: "Segoe UI, system-ui, sans-serif" } as CSSProperties,
  greeting: { fontSize: 26, fontWeight: 700, color: "#15171b" } as CSSProperties,
  date: { color: "#8a909c", fontSize: 13, marginTop: 2 } as CSSProperties,
  metricRow: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 20 } as CSSProperties,
  metricCard: { flex: "1 1 170px", minWidth: 160, background: "#fff", border: "1px solid #eceef2", borderRadius: 14, padding: "16px 16px 14px", boxShadow: "0 1px 3px rgba(17,21,28,0.05)", position: "relative", textDecoration: "none", color: "inherit" } as CSSProperties,
  metricValue: { fontSize: 30, fontWeight: 700, color: "#15171b", lineHeight: 1.1 } as CSSProperties,
  metricLabel: { fontSize: 12, color: "#8a909c", marginTop: 4 } as CSSProperties,
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c", margin: "26px 0 10px" } as CSSProperties,
  empty: { padding: "24px 18px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", color: "#3c414b", fontSize: 14 } as CSSProperties,
  rowMeta: { color: "#3c414b", fontSize: 13, marginTop: 3 } as CSSProperties,
  replied: { fontSize: 11, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.12)", padding: "2px 9px", borderRadius: 999 } as CSSProperties,
  link: { color: "var(--brand)", fontWeight: 600 } as CSSProperties,
  viewAll: { display: "inline-block", marginTop: 8, color: "var(--brand)", fontWeight: 600, fontSize: 13, textDecoration: "none" } as CSSProperties
};

function metricChip(accent: string): CSSProperties {
  return { position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 9, background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 };
}
