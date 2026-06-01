import Link from "next/link";
import type { CSSProperties } from "react";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { buildCallbackProfileList, type AutoReplyStatus } from "@/server/profiles/callbacks";

// Always read current in-memory state (the sandbox runtime), never statically cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Owner screen 1 — Callbacks (triage list), per web/OWNER_UX.md.
// Server component: reads the sandbox runtime and reuses Codex's read-API
// builder (buildCallbackProfileList) so this matches GET /api/profiles exactly.
// ---------------------------------------------------------------------------

function fmtPhone(p: string | null): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

function autoReplyLabel(s: AutoReplyStatus): string {
  if (s === "sent") return "✓ Auto-reply sent";
  if (s === "failed") return "⚠ Auto-reply failed";
  if (s === "queued") return "• Auto-reply not sent (sandbox)";
  return "no auto-reply";
}

function autoReplyStyle(s: AutoReplyStatus): CSSProperties {
  return {
    marginTop: 4,
    fontSize: 12,
    fontWeight: 600,
    color: s === "sent" ? "var(--positive)" : s === "failed" ? "#b23b3b" : s === "queued" ? "#9a6210" : "#8a909c"
  };
}

export default async function OwnerCallbacks() {
  const rt = await getIntakeRuntime();
  const [businesses, profiles, calls, messages, tasks] = await Promise.all([
    rt.businessRepository.list(),
    rt.customerProfileRepository.list(),
    rt.callRecordRepository.list(),
    rt.messageRepository.list(),
    rt.taskRepository.list()
  ]);
  const business = businesses[0] ?? null;
  const items = business
    ? buildCallbackProfileList({ businessId: business.id, profiles, calls, messages, tasks })
    : [];

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
        {items.map((it) => (
          <Link key={it.id} href={`/owner/${it.id}`} style={rowStyle(it.customer_replied)}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <strong style={{ color: "#15171b", fontSize: 15 }}>
                {it.display_name || fmtPhone(it.phone_e164)}
              </strong>
              {it.customer_replied && <span style={S.replied}>Replied — waiting on you</span>}
            </div>
            <div style={S.meta}>
              {it.last_call_outcome === "voicemail" && it.voicemail_snippet
                ? `“${it.voicemail_snippet}${it.voicemail_snippet.length >= 80 ? "…" : ""}”`
                : it.last_call_outcome === "missed"
                  ? "Missed · no voicemail"
                  : it.last_call_outcome === "answered"
                    ? "You answered"
                    : "Voicemail"}
            </div>
            <div style={autoReplyStyle(it.auto_reply_status)}>{autoReplyLabel(it.auto_reply_status)}</div>
          </Link>
        ))}
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
  meta: { color: "#3c414b", fontSize: 13, marginTop: 3 },
  replied: { fontSize: 11, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.12)", padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  linkBtn: { padding: "8px 12px", borderRadius: 10, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" },
  linkBtnGhost: { padding: "8px 12px", borderRadius: 10, background: "#fff", border: "1px solid #d8dce3", color: "#1e2026", fontWeight: 600, fontSize: 13, textDecoration: "none" },
  inlineLink: { color: "var(--brand)", fontWeight: 600 },
  footer: { marginTop: 26, color: "#8a909c", fontSize: 12 }
};

function rowStyle(replied: boolean): CSSProperties {
  return {
    display: "block",
    textDecoration: "none",
    padding: "13px 15px",
    marginBottom: 9,
    borderRadius: 13,
    background: "#fff",
    border: "1px solid #eceef2",
    borderLeft: `3px solid ${replied ? "var(--positive)" : "#d8dce3"}`,
    boxShadow: "0 1px 3px rgba(17,21,28,0.05)"
  };
}
