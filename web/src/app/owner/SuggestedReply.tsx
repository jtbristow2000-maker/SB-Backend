"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

// Suggested reply for a missed-call lead: computes a few open time slots from the
// calendar (browser-local = the owner's/business timezone), drafts a friendly
// reply offering those times, and lets the owner edit + send it in one tap.
// Quote ranges are intentionally left out until a pricing setting exists.

type Busy = { start: string; end: string | null };

const SLOT_HOURS = [10, 14]; // candidate start times: 10 AM, 2 PM
const SLOT_LEN_MS = 2 * 3_600_000; // assume a 2-hour job when checking conflicts

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtSlot(d: Date): string {
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function computeOpenSlots(busy: Busy[], count = 3): string[] {
  const intervals = busy.map((b) => {
    const s = new Date(b.start).getTime();
    const e = b.end ? new Date(b.end).getTime() : s + 3_600_000;
    return [s, e] as const;
  });
  const out: string[] = [];
  const base = startOfDay(new Date());
  for (let offset = 1; offset <= 10 && out.length < count; offset++) {
    const day = addDays(base, offset);
    for (const hour of SLOT_HOURS) {
      if (out.length >= count) break;
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const startMs = start.getTime();
      const endMs = startMs + SLOT_LEN_MS;
      const conflict = intervals.some(([bs, be]) => bs < endMs && be > startMs);
      if (!conflict) out.push(fmtSlot(start));
    }
  }
  return out;
}

export function SuggestedReply({
  customerName,
  service,
  phone,
  businessName,
  busy
}: {
  customerName: string;
  service: string;
  phone: string | null;
  businessName: string;
  busy: Busy[];
}) {
  const draft = useMemo(() => {
    const slots = computeOpenSlots(busy);
    const hi = customerName ? `Hi ${customerName}!` : "Hi there!";
    const svc = service ? ` about your ${service}` : " — sorry we missed you";
    const times = slots.length ? ` I have a few openings: ${slots.join("; ")}.` : "";
    return `${hi} Thanks for reaching out${svc}.${times} Which works best for you? Happy to share a quote once we pick a time. — ${businessName}`;
  }, [busy, customerName, service, businessName]);

  const [text, setText] = useState(draft);
  const [copied, setCopied] = useState(false);

  const smsHref = phone ? `sms:${phone}?&body=${encodeURIComponent(text)}` : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span>✨ Suggested reply</span>
        <span style={S.badge}>open times from your calendar</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} style={S.textarea} />
      <div style={S.actions}>
        {smsHref && <a href={smsHref} style={S.sendBtn}>💬 Send as text</a>}
        <button type="button" onClick={copy} style={S.copyBtn}>{copied ? "✓ Copied" : "📋 Copy"}</button>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  card: { marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid #d8dce3" },
  head: { fontSize: 13, fontWeight: 700, color: "#3a3a9a", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: { fontSize: 10, fontWeight: 700, color: "#1f9d6b", background: "rgba(31,157,107,0.12)", padding: "2px 8px", borderRadius: 999 },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  actions: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" },
  sendBtn: { padding: "10px 14px", borderRadius: 10, background: "#1f9d6b", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" },
  copyBtn: { padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #d8dce3", color: "#1e2026", fontWeight: 700, fontSize: 14, cursor: "pointer" }
};
