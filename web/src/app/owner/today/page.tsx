import Link from "next/link";
import type { CSSProperties } from "react";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { buildCallbackProfileList } from "@/server/profiles/callbacks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Today — the overview/home screen: greeting, metric cards, needs-attention.
// Server component; metrics derived from the sandbox runtime + read-API builder.
// ---------------------------------------------------------------------------

function fmtPhone(p: string | null): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
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
  const callbacks = business
    ? buildCallbackProfileList({ businessId: business.id, profiles, calls, messages, tasks })
    : [];

  const replied = callbacks.filter((c) => c.customer_replied).length;
  const voicemails = calls.filter((c) => c.transcript || c.call_type === "voicemail").length;
  const todayStr = new Date().toDateString();
  const callsToday = calls.filter((c) => c.started_at && new Date(c.started_at).toDateString() === todayStr).length;

  const metrics = [
    { label: "Callbacks waiting", value: callbacks.length, accent: "#5b5bd6", icon: "📞" },
    { label: "Replied — waiting on you", value: replied, accent: "#1f9d6b", icon: "💬" },
    { label: "Voicemails", value: voicemails, accent: "#c77d14", icon: "🎙️" },
    { label: "Calls today", value: callsToday, accent: "#3a7bd0", icon: "📆" }
  ];

  return (
    <main style={S.page}>
      <div style={S.greeting}>{greeting()}</div>
      <div style={S.date}>{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>

      <div style={S.metricRow}>
        {metrics.map((m) => (
          <div key={m.label} style={S.metricCard}>
            <div style={metricChip(m.accent)}>{m.icon}</div>
            <div style={S.metricValue}>{m.value}</div>
            <div style={S.metricLabel}>{m.label}</div>
          </div>
        ))}
      </div>

      <div style={S.sectionLabel}>NEEDS ATTENTION</div>
      {callbacks.length === 0 ? (
        <div style={S.empty}>
          You&apos;re all caught up. <Link href="/" style={S.link}>Simulate a missed call</Link> to see leads here.
        </div>
      ) : (
        <div>
          {callbacks.slice(0, 5).map((c) => (
            <Link key={c.id} href={`/owner/${c.id}`} style={rowStyle(c.customer_replied)}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "#15171b" }}>{c.display_name || fmtPhone(c.phone_e164)}</strong>
                {c.customer_replied && <span style={S.replied}>Replied</span>}
              </div>
              <div style={S.rowMeta}>
                {c.last_call_outcome === "voicemail" && c.voicemail_snippet
                  ? `“${c.voicemail_snippet}…”`
                  : c.last_call_outcome === "missed"
                    ? "Missed · no voicemail"
                    : c.last_call_outcome === "answered"
                      ? "You answered"
                      : "Voicemail"}
              </div>
            </Link>
          ))}
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
  metricCard: { flex: "1 1 170px", minWidth: 160, background: "#fff", border: "1px solid #eceef2", borderRadius: 14, padding: "16px 16px 14px", boxShadow: "0 1px 3px rgba(17,21,28,0.05)", position: "relative" } as CSSProperties,
  metricValue: { fontSize: 30, fontWeight: 700, color: "#15171b", lineHeight: 1.1 } as CSSProperties,
  metricLabel: { fontSize: 12, color: "#8a909c", marginTop: 4 } as CSSProperties,
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c", margin: "26px 0 10px" } as CSSProperties,
  empty: { padding: "24px 18px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", color: "#3c414b", fontSize: 14 } as CSSProperties,
  rowMeta: { color: "#3c414b", fontSize: 13, marginTop: 3 } as CSSProperties,
  replied: { fontSize: 11, fontWeight: 700, color: "#1f9d6b", background: "rgba(31,157,107,0.12)", padding: "2px 9px", borderRadius: 999 } as CSSProperties,
  link: { color: "#5b5bd6", fontWeight: 600 } as CSSProperties,
  viewAll: { display: "inline-block", marginTop: 8, color: "#5b5bd6", fontWeight: 600, fontSize: 13, textDecoration: "none" } as CSSProperties
};

function metricChip(accent: string): CSSProperties {
  return { position: "absolute", top: 14, right: 14, width: 30, height: 30, borderRadius: 9, background: `${accent}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 };
}

function rowStyle(replied: boolean): CSSProperties {
  return { display: "block", textDecoration: "none", padding: "13px 15px", marginBottom: 9, borderRadius: 13, background: "#fff", border: "1px solid #eceef2", borderLeft: `3px solid ${replied ? "#1f9d6b" : "#d8dce3"}`, boxShadow: "0 1px 3px rgba(17,21,28,0.05)" };
}
