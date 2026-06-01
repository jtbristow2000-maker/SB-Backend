"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import type { CallRecordRow, CustomerProfileRow, MessageRow, TaskRow } from "@/server/db/schema";

// ---------------------------------------------------------------------------
// Sandbox Console — a clickable tester for the missed-call → lead-intake pipeline.
//
// It drives the REAL Twilio webhook routes (form-encoded POSTs, exactly like Twilio)
// and renders the resulting in-memory state via the dev-only GET /api/dev/state.
// This is a developer/test surface, not the production owner UI (that is built from
// web/OWNER_UX.md against the BACKEND-14/15 read API). Sandbox-only.
// ---------------------------------------------------------------------------

type DevState = {
  business: { id: string; name: string; businessPhone: string | null; ownerPhone: string | null } | null;
  smsSendingEnabled: boolean;
  profiles: CustomerProfileRow[];
  calls: CallRecordRow[];
  messages: MessageRow[];
  tasks: TaskRow[];
};

type TimelineItem =
  | { kind: "call"; at: string; call: CallRecordRow }
  | { kind: "message"; at: string; message: MessageRow };

function fmtPhone(p: string | null): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

function fmtTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function postForm(path: string, fields: Record<string, string>): Promise<void> {
  await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString()
  });
}

export default function SandboxConsole() {
  const [state, setState] = useState<DevState | null>(null);
  const [caller, setCaller] = useState("+15551234567");
  const [body, setBody] = useState("Hi, it's Sarah — I want a full detail this Saturday, how much?");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/dev/state", { cache: "no-store" });
      if (!res.ok) throw new Error(`state ${res.status}`);
      setState((await res.json()) as DevState);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed to load state");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const bizPhone = state?.business?.businessPhone ?? "";

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "action failed");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const newCallSid = () => `CA${Date.now()}`;
  const newMsgSid = () => `SM${Date.now()}`;

  const missedNoVm = () =>
    run(async () => {
      const sid = newCallSid();
      await postForm("/api/webhooks/twilio/voice", { From: caller, To: bizPhone, CallSid: sid });
      await postForm("/api/webhooks/twilio/voice/status", { CallSid: sid, DialCallStatus: "no-answer" });
    });

  const missedWithVm = () =>
    run(async () => {
      const sid = newCallSid();
      await postForm("/api/webhooks/twilio/voice", { From: caller, To: bizPhone, CallSid: sid });
      await postForm("/api/webhooks/twilio/voice/status", { CallSid: sid, DialCallStatus: "no-answer" });
      await postForm("/api/webhooks/twilio/recording", {
        CallSid: sid,
        RecordingUrl: "https://example.test/voicemail.wav",
        TranscriptionText: body || "Voicemail left by caller."
      });
    });

  const answered = () =>
    run(async () => {
      const sid = newCallSid();
      await postForm("/api/webhooks/twilio/voice", { From: caller, To: bizPhone, CallSid: sid });
      await postForm("/api/webhooks/twilio/voice/status", { CallSid: sid, DialCallStatus: "completed" });
    });

  const inboundSms = () =>
    run(async () => {
      await postForm("/api/webhooks/twilio/sms", {
        From: caller,
        To: bizPhone,
        Body: body || "Following up on my detail.",
        MessageSid: newMsgSid()
      });
    });

  const reset = () =>
    run(async () => {
      await fetch("/api/dev/reset", { method: "POST" });
      setSelectedId(null);
    });

  const selected = useMemo(
    () => state?.profiles.find((p) => p.id === selectedId) ?? null,
    [state, selectedId]
  );

  return (
    <main style={S.shell}>
      <header style={S.header}>
        <div>
          <div style={S.eyebrow}>SANDBOX CONSOLE · missed-call pipeline</div>
          <h1 style={S.h1}>{state?.business?.name ?? "Loading…"}</h1>
          <div style={S.sub}>
            Business number {fmtPhone(bizPhone || null)} · owner {fmtPhone(state?.business?.ownerPhone ?? null)}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
          <a
            href="/owner"
            style={{ padding: "8px 12px", borderRadius: 10, background: "#5b5bd6", color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
          >
            Open owner view →
          </a>
          <div style={flagStyle(state?.smsSendingEnabled ?? false)}>
            {state?.smsSendingEnabled ? "SMS sending ON" : "SMS sending OFF — auto-texts are queued, not delivered"}
          </div>
        </div>
      </header>

      {error && <div style={S.error}>⚠ {error} — is the dev server running and SANDBOX_MODE=true?</div>}

      {/* Simulate controls */}
      <section style={S.controls}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={S.field}>
            <span style={S.label}>Caller number</span>
            <input style={S.input} value={caller} onChange={(e) => setCaller(e.target.value)} />
          </label>
          <label style={{ ...S.field, flex: 1, minWidth: 280 }}>
            <span style={S.label}>Voicemail / message text</span>
            <input style={S.input} value={body} onChange={(e) => setBody(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button style={S.btnPrimary} disabled={busy || !bizPhone} onClick={missedWithVm}>
            📞 Missed call + voicemail
          </button>
          <button style={S.btn} disabled={busy || !bizPhone} onClick={missedNoVm}>
            📞 Missed call (no voicemail)
          </button>
          <button style={S.btn} disabled={busy || !bizPhone} onClick={inboundSms}>
            💬 Customer texts back
          </button>
          <button style={S.btn} disabled={busy || !bizPhone} onClick={answered}>
            ✅ Answered call
          </button>
          <button style={S.btnGhost} disabled={busy} onClick={reset}>
            ↺ Reset sandbox
          </button>
        </div>
      </section>

      {/* Two-pane: leads + detail */}
      <section style={S.panes}>
        <div style={S.listPane}>
          <div style={S.paneTitle}>Callbacks ({state?.profiles.length ?? 0})</div>
          {(state?.profiles.length ?? 0) === 0 && <div style={S.empty}>No leads yet — simulate a missed call.</div>}
          {state?.profiles.map((p) => {
            const view = profileView(p, state);
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                style={leadRowStyle(p.id === selectedId, view.replied)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ color: "#15171b" }}>{p.display_name || fmtPhone(p.phone_e164)}</strong>
                  {view.replied && <span style={S.repliedBadge}>Replied</span>}
                </div>
                <div style={S.rowMeta}>{view.outcome}</div>
                <div style={autoReplyStyle(view.autoReply)}>{view.autoReplyLabel}</div>
              </button>
            );
          })}
        </div>

        <div style={S.detailPane}>
          {!selected && <div style={S.empty}>Select a lead to see the call history, voicemail, and texts.</div>}
          {selected && <LeadDetail profile={selected} state={state!} />}
        </div>
      </section>

      <footer style={S.footer}>
        Drives the real <code>/api/webhooks/twilio/*</code> routes; state via dev-only{" "}
        <code>/api/dev/state</code>. In-memory — resets on server restart or “Reset sandbox”.
      </footer>
    </main>
  );
}

function LeadDetail({ profile, state }: { profile: CustomerProfileRow; state: DevState }) {
  const calls = state.calls.filter((c) => c.customer_profile_id === profile.id);
  const messages = state.messages.filter((m) => m.customer_profile_id === profile.id);
  const task = state.tasks.find((t) => t.customer_profile_id === profile.id && t.task_type === "callback");

  const timeline: TimelineItem[] = [
    ...calls.map((c): TimelineItem => ({ kind: "call", at: c.started_at ?? c.created_at, call: c })),
    ...messages.map((m): TimelineItem => ({ kind: "message", at: m.created_at, message: m }))
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <h2 style={S.h2}>{profile.display_name || fmtPhone(profile.phone_e164)}</h2>
        <div style={S.sub}>
          {fmtPhone(profile.phone_e164)} · status {profile.status}
          {profile.last_contact_at ? ` · last heard ${fmtTime(profile.last_contact_at)}` : ""}
        </div>
      </div>

      {task && (
        <div style={S.taskBar}>
          Callback task: <strong>{task.status}</strong>
        </div>
      )}

      <div style={S.paneTitle}>Timeline</div>
      {timeline.length === 0 && <div style={S.empty}>Nothing yet.</div>}
      {timeline.map((item, i) =>
        item.kind === "call" ? (
          <div key={i} style={S.timelineItem}>
            <div style={S.timelineHead}>
              📞 {callOutcome(item.call)} · {fmtTime(item.at)}
            </div>
            {item.call.transcript && (
              <div style={S.transcript}>
                “{item.call.transcript}”
                {item.call.needs_review && <span style={S.review}> · auto-transcribed, may contain errors</span>}
              </div>
            )}
          </div>
        ) : (
          <div key={i} style={bubbleWrapStyle(item.message.direction === "outbound")}>
            <div style={bubbleStyle(item.message.direction === "outbound")}>
              <div>{item.message.body}</div>
              <div style={S.bubbleMeta}>
                {item.message.direction === "outbound"
                  ? `Auto-reply · ${autoReplyText(item.message.status)}`
                  : "Customer"}{" "}
                · {fmtTime(item.message.created_at)}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}

// ---- derived view helpers (mirror the future BACKEND-14/15 read API) ----

function callOutcome(c: CallRecordRow): string {
  if (c.call_type === "answered") return "You answered";
  if (c.call_type === "voicemail" || c.transcript) return "Voicemail";
  return "Missed · no voicemail";
}

function autoReplyText(status: string): string {
  if (status === "sent") return "sent";
  if (status === "failed") return "FAILED";
  return "not sent (sandbox)";
}

function profileView(p: CustomerProfileRow, state: DevState) {
  const calls = state.calls
    .filter((c) => c.customer_profile_id === p.id)
    .sort((a, b) => new Date(b.started_at ?? b.created_at).getTime() - new Date(a.started_at ?? a.created_at).getTime());
  const messages = state.messages.filter((m) => m.customer_profile_id === p.id);
  const latestCall = calls[0] ?? null;
  const outbound = messages
    .filter((m) => m.direction === "outbound")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

  const lastMissedAt = calls.find((c) => c.call_type === "missed" || c.call_type === "voicemail")?.started_at ?? null;
  const replied =
    !!lastMissedAt &&
    messages.some((m) => m.direction === "inbound" && new Date(m.created_at).getTime() >= new Date(lastMissedAt).getTime());

  const autoReply = outbound ? (outbound.status as "sent" | "queued" | "failed") : "none";
  const autoReplyLabel =
    autoReply === "sent"
      ? "✓ Auto-reply sent"
      : autoReply === "failed"
        ? "⚠ Auto-reply failed"
        : autoReply === "queued"
          ? "• Auto-reply not sent (sandbox)"
          : "no auto-reply";

  return {
    outcome: latestCall ? callOutcome(latestCall) : "—",
    replied,
    autoReply,
    autoReplyLabel
  };
}

// ---- styles ----
// Dynamic styles are standalone functions with an explicit CSSProperties return type
// (so string literals are checked against React's union types, not widened to string).
const flagStyle = (on: boolean): CSSProperties => ({
  padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 700,
  background: on ? "rgba(31,157,107,0.12)" : "rgba(199,125,20,0.14)", color: on ? "#1f9d6b" : "#9a6210"
});
const leadRowStyle = (sel: boolean, replied: boolean): CSSProperties => ({
  display: "block", width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8,
  borderRadius: 12, cursor: "pointer", background: "#fff",
  border: `1px solid ${sel ? "#5b5bd6" : "#eceef2"}`,
  borderLeft: `3px solid ${replied ? "#1f9d6b" : sel ? "#5b5bd6" : "#eceef2"}`
});
const autoReplyStyle = (s: string): CSSProperties => ({
  marginTop: 4, fontSize: 12, fontWeight: 600,
  color: s === "sent" ? "#1f9d6b" : s === "failed" ? "#b23b3b" : "#9a6210"
});
const bubbleWrapStyle = (out: boolean): CSSProperties => ({
  display: "flex", justifyContent: out ? "flex-end" : "flex-start", margin: "6px 0"
});
const bubbleStyle = (out: boolean): CSSProperties => ({
  maxWidth: "80%", padding: "8px 12px", borderRadius: 12,
  background: out ? "rgba(91,91,214,0.1)" : "#f1f2f5", fontSize: 13
});

const S: Record<string, CSSProperties> = {
  shell: { maxWidth: 1100, margin: "0 auto", padding: "28px 24px 48px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c" },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  h2: { margin: 0, fontSize: 18 },
  sub: { color: "#8a909c", fontSize: 13 },
  error: { marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "rgba(220,76,76,0.1)", color: "#b23b3b", fontSize: 13 },
  controls: { marginTop: 18, padding: 16, borderRadius: 14, background: "#fff", border: "1px solid #eceef2", boxShadow: "0 1px 3px rgba(17,21,28,0.05)" },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11, fontWeight: 700, color: "#8a909c" },
  input: { padding: "9px 11px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 14, minWidth: 200 },
  btnPrimary: { padding: "10px 14px", borderRadius: 10, border: "none", background: "#5b5bd6", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 13 },
  btn: { padding: "10px 14px", borderRadius: 10, border: "1px solid #d8dce3", background: "#fff", color: "#1e2026", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  btnGhost: { padding: "10px 14px", borderRadius: 10, border: "1px solid #e8c9c9", background: "transparent", color: "#b23b3b", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  panes: { display: "flex", gap: 16, marginTop: 18, alignItems: "flex-start", flexWrap: "wrap" },
  listPane: { flex: "1 1 340px", minWidth: 300 },
  detailPane: { flex: "1 1 460px", minWidth: 320, padding: 16, borderRadius: 14, background: "#fff", border: "1px solid #eceef2", minHeight: 220 },
  paneTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c", margin: "4px 0 10px" },
  empty: { color: "#8a909c", fontSize: 14, padding: "20px 4px" },
  rowMeta: { color: "#3c414b", fontSize: 13, marginTop: 2 },
  repliedBadge: { fontSize: 11, fontWeight: 700, color: "#1f9d6b", background: "rgba(31,157,107,0.12)", padding: "2px 8px", borderRadius: 999 },
  taskBar: { padding: "8px 12px", borderRadius: 10, background: "rgba(91,91,214,0.08)", color: "#3a3a9a", fontSize: 13, margin: "8px 0 14px" },
  timelineItem: { padding: "8px 0", borderBottom: "1px solid #f1f2f5" },
  timelineHead: { fontSize: 13, fontWeight: 600 },
  transcript: { marginTop: 4, fontSize: 13, color: "#3c414b" },
  review: { color: "#9a6210", fontSize: 11 },
  bubbleMeta: { marginTop: 3, fontSize: 11, color: "#8a909c" },
  footer: { marginTop: 26, color: "#8a909c", fontSize: 12 }
};
