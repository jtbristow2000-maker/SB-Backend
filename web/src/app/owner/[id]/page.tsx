import Link from "next/link";
import type { CSSProperties } from "react";

import { getIntakeRuntime } from "@/server/intake/runtime";
import { buildProfileDetail } from "@/server/profiles/detail";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Owner screen 2 — Lead detail, per web/OWNER_UX.md.
// Server component reusing Codex's buildProfileDetail (GET /api/profiles/{id}).
// Shows the merged call + voicemail + SMS timeline and the open callback task.
// ---------------------------------------------------------------------------

function fmtPhone(p: string | null): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function callLabel(callType: string, hasTranscript: boolean): string {
  if (callType === "answered") return "You answered";
  if (callType === "voicemail" || hasTranscript) return "Voicemail";
  return "Missed · no voicemail";
}

function autoReplyText(status: string): string {
  if (status === "sent") return "sent";
  if (status === "failed") return "FAILED";
  if (status === "queued") return "not sent (sandbox)";
  return status;
}

export default async function OwnerLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rt = await getIntakeRuntime();
  const [businesses, profiles, calls, messages, tasks] = await Promise.all([
    rt.businessRepository.list(),
    rt.customerProfileRepository.list(),
    rt.callRecordRepository.list(),
    rt.messageRepository.list(),
    rt.taskRepository.list()
  ]);
  const business = businesses[0] ?? null;
  const detail = business
    ? buildProfileDetail({ businessId: business.id, profileId: id, profiles, calls, messages, tasks })
    : null;

  if (!detail) {
    return (
      <main style={S.shell}>
        <Link href="/owner" style={S.back}>← Callbacks</Link>
        <div style={S.empty}>Lead not found. It may have been reset.</div>
      </main>
    );
  }

  const { profile, timeline, open_task, customer_replied } = detail;

  return (
    <main style={S.shell}>
      <Link href="/owner" style={S.back}>← Callbacks</Link>

      <header style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h1 style={S.h1}>{profile.display_name || fmtPhone(profile.phone_e164)}</h1>
          {customer_replied && <span style={S.replied}>Replied</span>}
        </div>
        <div style={S.sub}>
          {fmtPhone(profile.phone_e164)} · status {profile.status}
          {profile.last_contact_at ? ` · last heard ${fmtTime(profile.last_contact_at)}` : ""}
        </div>
      </header>

      {open_task && (
        <div style={S.taskBar}>
          ☎ Callback task — <strong>{open_task.status}</strong>
        </div>
      )}

      <div style={S.paneTitle}>TIMELINE</div>
      {timeline.length === 0 && <div style={S.empty}>Nothing yet.</div>}

      {timeline.map((item) =>
        item.kind === "call" ? (
          <div key={item.call.id} style={S.callItem}>
            <div style={S.callHead}>
              📞 {callLabel(item.call.call_type, Boolean(item.call.transcript))} · {fmtTime(item.at)}
              {item.call.duration_seconds ? ` · ${item.call.duration_seconds}s` : ""}
            </div>
            {item.call.transcript && (
              <div style={S.transcript}>
                “{item.call.transcript}”
                {item.call.needs_review && <span style={S.review}> · auto-transcribed, may contain errors</span>}
              </div>
            )}
          </div>
        ) : (
          <div key={item.message.id} style={bubbleWrap(item.message.direction === "outbound")}>
            <div style={bubble(item.message.direction === "outbound")}>
              <div>{item.message.body}</div>
              <div style={S.bubbleMeta}>
                {item.message.direction === "outbound"
                  ? `Auto-reply · ${autoReplyText(item.message.status)}`
                  : "Customer"}{" "}
                · {fmtTime(item.at)}
              </div>
            </div>
          </div>
        )
      )}

      <footer style={S.footer}>
        Powered by the same logic as <code>GET /api/profiles/{"{id}"}</code> (sandbox, in-memory).
      </footer>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  shell: { maxWidth: 720, margin: "0 auto", padding: "22px 20px 48px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  back: { color: "#5b5bd6", fontWeight: 600, fontSize: 13, textDecoration: "none" },
  h1: { margin: "6px 0 2px", fontSize: 22 },
  sub: { color: "#8a909c", fontSize: 13 },
  replied: { fontSize: 11, fontWeight: 700, color: "#1f9d6b", background: "rgba(31,157,107,0.12)", padding: "3px 9px", borderRadius: 999 },
  taskBar: { padding: "9px 13px", borderRadius: 10, background: "rgba(91,91,214,0.08)", color: "#3a3a9a", fontSize: 13, margin: "12px 0 6px" },
  paneTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c", margin: "14px 0 8px" },
  empty: { marginTop: 16, padding: "22px 16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", textAlign: "center", color: "#8a909c" },
  callItem: { padding: "9px 0", borderBottom: "1px solid #f1f2f5" },
  callHead: { fontSize: 13, fontWeight: 600 },
  transcript: { marginTop: 4, fontSize: 13, color: "#3c414b" },
  review: { color: "#9a6210", fontSize: 11 },
  bubbleMeta: { marginTop: 3, fontSize: 11, color: "#8a909c" },
  footer: { marginTop: 26, color: "#8a909c", fontSize: 12 }
};

function bubbleWrap(out: boolean): CSSProperties {
  return { display: "flex", justifyContent: out ? "flex-end" : "flex-start", margin: "7px 0" };
}

function bubble(out: boolean): CSSProperties {
  return { maxWidth: "82%", padding: "9px 12px", borderRadius: 12, background: out ? "rgba(91,91,214,0.1)" : "#f1f2f5", fontSize: 13 };
}
