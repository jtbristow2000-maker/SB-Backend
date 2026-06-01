"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import type { BusinessHoursSettings, QuoteRangeSettings } from "@/server/business/settings";

// Suggested reply for a missed-call lead: computes a few open time slots from the
// calendar (browser-local = the owner's/business timezone) while respecting the
// business's working days + hours, drafts a friendly reply offering those times,
// and — when the requested service matches a configured quote range — folds the
// price range in so the owner can land the job in one tap.

type Busy = { start: string; end: string | null };

const JOB_HOURS = 2; // assume a 2-hour job when checking conflicts / leaving room before close
const SLOT_LEN_MS = JOB_HOURS * 3_600_000;

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
function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// "09:00" -> 9 (hours, fractional for minutes). Falls back if unparseable.
function parseHour(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return Number.isFinite(h) ? h : fallback;
}

// Up to two candidate start times inside business hours: mid-morning + mid-afternoon,
// always leaving room for a job before close.
function candidateHours(hours: BusinessHoursSettings): number[] {
  const openH = parseHour(hours.open, 9);
  const closeH = parseHour(hours.close, 17);
  const latestStart = Math.max(openH, closeH - JOB_HOURS);
  const clamp = (h: number) => Math.min(Math.max(h, openH), latestStart);
  const picks = [clamp(openH + 1), clamp(14)];
  return picks.filter((h, i) => picks.indexOf(h) === i);
}

function computeOpenSlots(busy: Busy[], hours: BusinessHoursSettings, count = 3): string[] {
  const intervals = busy.map((b) => {
    const s = new Date(b.start).getTime();
    const e = b.end ? new Date(b.end).getTime() : s + 3_600_000;
    return [s, e] as const;
  });
  const slotHours = candidateHours(hours);
  const workDays = hours.days && hours.days.length ? hours.days : [0, 1, 2, 3, 4, 5, 6];
  const out: string[] = [];
  const base = startOfDay(new Date());
  for (let offset = 1; offset <= 21 && out.length < count; offset++) {
    const day = addDays(base, offset);
    if (!workDays.includes(day.getDay())) continue;
    for (const hour of slotHours) {
      if (out.length >= count) break;
      const start = new Date(day);
      start.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
      const startMs = start.getTime();
      const endMs = startMs + SLOT_LEN_MS;
      const conflict = intervals.some(([bs, be]) => bs < endMs && be > startMs);
      if (!conflict) out.push(fmtSlot(start));
    }
  }
  return out;
}

// Match the caller's requested service to a configured quote range (case-insensitive,
// either contains the other). Exact match wins.
function matchQuote(service: string, ranges: QuoteRangeSettings[]): QuoteRangeSettings | null {
  const s = service.trim().toLowerCase();
  if (!s || ranges.length === 0) return null;
  let best: QuoteRangeSettings | null = null;
  for (const r of ranges) {
    const rs = r.service.trim().toLowerCase();
    if (!rs) continue;
    if (s === rs) return r;
    if ((s.includes(rs) || rs.includes(s)) && !best) best = r;
  }
  return best;
}

export function SuggestedReply({
  customerName,
  service,
  phone,
  businessName,
  busy,
  businessHours,
  quoteRanges
}: {
  customerName: string;
  service: string;
  phone: string | null;
  businessName: string;
  busy: Busy[];
  businessHours: BusinessHoursSettings;
  quoteRanges: QuoteRangeSettings[];
}) {
  const draft = useMemo(() => {
    const slots = computeOpenSlots(busy, businessHours);
    const quote = matchQuote(service, quoteRanges);
    const hi = customerName ? `Hi ${customerName}!` : "Hi there!";
    const svc = service ? ` about your ${service}` : " — sorry we missed you";
    const times = slots.length ? ` I have a few openings: ${slots.join("; ")}.` : "";
    const quoteSentence = quote
      ? ` Most ${quote.service.toLowerCase()} jobs run ${fmtUsd(quote.low)}–${fmtUsd(quote.high)}.`
      : " Happy to share a quote once we pick a time.";
    return `${hi} Thanks for reaching out${svc}.${times}${quoteSentence} Which works best for you? — ${businessName}`;
  }, [busy, customerName, service, businessName, businessHours, quoteRanges]);

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
  badge: { fontSize: 10, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.12)", padding: "2px 8px", borderRadius: 999 },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  actions: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" },
  sendBtn: { padding: "10px 14px", borderRadius: 10, background: "var(--positive)", color: "#fff", fontWeight: 700, fontSize: 14, textDecoration: "none" },
  copyBtn: { padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #d8dce3", color: "#1e2026", fontWeight: 700, fontSize: 14, cursor: "pointer" }
};
