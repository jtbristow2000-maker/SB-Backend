"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";

import { sendOwnerText, suggestServicesWithAI } from "@/app/owner/actions";
import type { BusinessHoursSettings, QuoteRangeSettings } from "@/server/business/settings";

// Interactive reply builder for a missed-call lead. Shows the whole flow in one place:
// the services we think the caller wants (pre-ticked from the voicemail, owner adjusts) →
// a live quote from the saved price settings → open time slots to offer (respecting
// business hours + the caller's requested timeframe) → the assembled, editable text.
// Toggling any chip rebuilds the draft; the owner can still hand-edit before sending.

type Busy = { start: string; end: string | null };

const JOB_HOURS = 2;
const SLOT_LEN_MS = JOB_HOURS * 3_600_000;
const MAX_SLOTS = 8;
const PRESELECT_SLOTS = 3;

// ---------------------------------------------------------------- time helpers
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
function parseHour(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return Number.isFinite(h) ? h : fallback;
}
function candidateHours(hours: BusinessHoursSettings): number[] {
  const openH = parseHour(hours.open, 9);
  const closeH = parseHour(hours.close, 17);
  const latestStart = Math.max(openH, closeH - JOB_HOURS);
  const clamp = (h: number) => Math.min(Math.max(h, openH), latestStart);
  const picks = [clamp(openH + 1), clamp(14)];
  return picks.filter((h, i) => picks.indexOf(h) === i);
}
// Where to start looking, based on what the caller asked for.
function startOffsetFor(requested: string): number {
  const t = requested.toLowerCase();
  if (/next week/.test(t)) return 7;
  if (/tomorrow/.test(t)) return 1;
  return 1;
}
function computeSlots(busy: Busy[], hours: BusinessHoursSettings, requested: string): string[] {
  const intervals = busy.map((b) => {
    const s = new Date(b.start).getTime();
    const e = b.end ? new Date(b.end).getTime() : s + 3_600_000;
    return [s, e] as const;
  });
  const slotHours = candidateHours(hours);
  const workDays = hours.days && hours.days.length ? hours.days : [0, 1, 2, 3, 4, 5, 6];
  const out: string[] = [];
  const base = startOfDay(new Date());
  const startOffset = startOffsetFor(requested);
  for (let offset = startOffset; offset <= startOffset + 24 && out.length < MAX_SLOTS; offset++) {
    const day = addDays(base, offset);
    if (!workDays.includes(day.getDay())) continue;
    for (const hour of slotHours) {
      if (out.length >= MAX_SLOTS) break;
      const start = new Date(day);
      start.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
      const startMs = start.getTime();
      const endMs = startMs + SLOT_LEN_MS;
      if (!intervals.some(([bs, be]) => bs < endMs && be > startMs)) out.push(fmtSlot(start));
    }
  }
  return out;
}

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// If the caller asked for a day/time the business doesn't normally work, return a
// short human label ("Sundays", "evenings", "weekends", "Sundays or evenings") so the
// reply can acknowledge it instead of silently offering different times. null = no clash.
function describeOutsideHours(requested: string, hours: BusinessHoursSettings): string | null {
  const t = requested.toLowerCase();
  if (!t) return null;
  const workDays = hours.days && hours.days.length ? hours.days : [0, 1, 2, 3, 4, 5, 6];
  const labels: string[] = [];

  if (/\bweekend/.test(t) && !workDays.includes(0) && !workDays.includes(6)) {
    labels.push("weekends");
  } else {
    const outsideDays = DAY_NAMES.map((d, i) => ({ d, i })).filter(
      ({ d, i }) => new RegExp(`\\b${d}\\b`).test(t) && !workDays.includes(i)
    );
    if (outsideDays.length) {
      labels.push(outsideDays.map(({ d }) => `${d[0].toUpperCase()}${d.slice(1)}s`).join(" or "));
    }
  }

  const closeH = parseHour(hours.close, 17);
  let timeOutside = /\b(evening|night|after hours)\b/.test(t);
  const after = /\bafter\s+(noon|six|seven|eight|nine|ten|\d{1,2})\b/.exec(t);
  if (after) {
    const word = after[1];
    const numMap: Record<string, number> = { noon: 12, six: 18, seven: 19, eight: 20, nine: 21, ten: 22 };
    let hr = numMap[word] ?? Number(word);
    if (hr <= 12 && /\b(evening|night|pm)\b/.test(t)) hr += 12;
    if (Number.isFinite(hr) && hr >= closeH) timeOutside = true;
  }
  if (timeOutside) labels.push("evenings");

  return labels.length ? labels.join(" or ") : null;
}

// ------------------------------------------------------- service auto-matching
const FILLER = new Set(["the", "a", "and", "removal", "service", "package", "detail", "cleaning", "car", "of"]);
const VEHICLE_PATTERNS: [string, RegExp][] = [
  ["suv", /\b(suv|crossover|rav4|cr-?v|explorer|tahoe|truck|pickup|jeep|minivan|van|4runner|highlander|wagon)\b/],
  ["midsize", /\bmid-?\s?size\b/],
  ["sedan", /\b(sedan|accord|camry|civic|corolla|altima|sonata|malibu|car)\b/]
];
function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
function detectVehicle(ctx: string): string | null {
  for (const [v, re] of VEHICLE_PATTERNS) if (re.test(ctx)) return v;
  return null;
}
function detectTier(ctx: string): "full" | "light" | null {
  // Severity words imply a full detail; "exterior" is NOT a light cue (e.g. "exterior damage").
  if (/\b(full|deep|complete|messy|filthy|trashed|nasty|disaster|gross|wreck|destroyed)\b/.test(ctx)) return "full";
  if (/\b(light|basic|quick|wash|wax|maintenance)\b/.test(ctx)) return "light";
  return null;
}
// Best guess at which configured services the voicemail is about.
function suggestServiceIdxs(contextText: string, ranges: QuoteRangeSettings[]): number[] {
  const c = norm(contextText);
  if (!c) return [];
  const vehicle = detectVehicle(c);
  const tier = detectTier(c);
  const picked: number[] = [];
  ranges.forEach((r, i) => {
    const name = norm(r.service);
    const rangeVehicle = /\bsuv\b/.test(name) ? "suv" : /\bmid-?\s?size\b/.test(name) ? "midsize" : /\bsedan\b/.test(name) ? "sedan" : null;
    const rangeTier = /\bfull\b/.test(name) ? "full" : /\blight\b/.test(name) ? "light" : null;
    if (rangeVehicle || rangeTier) {
      const tierOk = !rangeTier || rangeTier === tier;
      const vehOk = !rangeVehicle || rangeVehicle === vehicle;
      if (tierOk && vehOk && (rangeTier ? tier !== null : true) && (rangeVehicle ? vehicle !== null : true)) {
        picked.push(i);
      }
    } else {
      // Specialty / add-on service: match on its distinctive words (dog, hair, stain…),
      // plus common real-world synonyms for the mess being described.
      const tokens = name.split(" ").filter((t) => t && !FILLER.has(t));
      const extra: string[] = [];
      if (name.includes("stain")) extra.push("blood", "feather", "spill", "mud", "vomit", "sap", "mess");
      if (name.includes("hair")) extra.push("fur", "shedding", "pet");
      const hit = tokens.some((t) => c.includes(t.replace(/s$/, ""))) || extra.some((k) => c.includes(k));
      if (hit) picked.push(i);
    }
  });
  return picked;
}

// ------------------------------------------------------------- message builder
function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
function priceText(r: QuoteRangeSettings): string {
  return r.low === r.high ? fmtUsd(r.low) : `${fmtUsd(r.low)}–${fmtUsd(r.high)}`;
}
function buildDraft(args: {
  customerName: string;
  businessName: string;
  selected: QuoteRangeSettings[];
  slots: string[];
  includeMenu: boolean;
  allRanges: QuoteRangeSettings[];
  pricingInquiry: boolean;
  outsideLabel: string | null;
}): string {
  const { customerName, businessName, selected, slots, includeMenu, allRanges, pricingInquiry, outsideLabel } = args;
  const hi = customerName ? `Hi ${customerName}!` : "Hi there!";

  let intro: string;
  if (selected.length >= 1) intro = " Thanks for reaching out!";
  else if (pricingInquiry) intro = " Thanks for reaching out — happy to give you a quote.";
  else intro = " Thanks for reaching out — sorry we missed you.";

  let quote = "";
  if (selected.length === 1) {
    const r = selected[0];
    quote =
      r.low === r.high
        ? ` Your ${r.service.toLowerCase()} is ${fmtUsd(r.low)}.`
        : ` Your ${r.service.toLowerCase()} runs ${fmtUsd(r.low)}–${fmtUsd(r.high)}.`;
  } else if (selected.length > 1) {
    const low = selected.reduce((s, r) => s + r.low, 0);
    const high = selected.reduce((s, r) => s + r.high, 0);
    const names = listPhrase(selected.map((r) => r.service.toLowerCase()));
    quote =
      low === high
        ? ` For the ${names}, that's ${fmtUsd(low)}.`
        : ` For the ${names}, you're looking at about ${fmtUsd(low)}–${fmtUsd(high)} altogether.`;
  }

  let menu = "";
  if (includeMenu && allRanges.length) {
    menu = ` Here's a quick rundown: ${allRanges.map((r) => `${r.service} ${priceText(r)}`).join(", ")}.`;
  }

  let times: string;
  if (slots.length) {
    times = outsideLabel
      ? ` We don't usually do ${outsideLabel}, but I'd love to make it work — here's what I have open: ${slots.join("; ")}.`
      : ` I have a few openings: ${slots.join("; ")}.`;
  } else {
    times = outsideLabel
      ? ` We don't usually do ${outsideLabel} — let me know a weekday that works and I'll get you in.`
      : "";
  }
  const closing = slots.length ? " Which works best for you?" : outsideLabel ? "" : " When works best for you?";
  return `${hi}${intro}${quote}${menu}${times}${closing} — ${businessName}`;
}

// ---------------------------------------------------------------- component
export function ReplyComposer({
  customerName,
  businessName,
  profileId,
  quoteRanges,
  businessHours,
  busy,
  requestedWhen,
  contextText,
  pricingInquiry,
  transcript,
  aiEnabled
}: {
  customerName: string;
  businessName: string;
  profileId: string;
  quoteRanges: QuoteRangeSettings[];
  businessHours: BusinessHoursSettings;
  busy: Busy[];
  requestedWhen: string;
  contextText: string;
  pricingInquiry: boolean;
  transcript: string;
  aiEnabled: boolean;
}) {
  const allSlots = useMemo(() => computeSlots(busy, businessHours, requestedWhen), [busy, businessHours, requestedWhen]);
  const initialPicks = useMemo(() => suggestServiceIdxs(contextText, quoteRanges), [contextText, quoteRanges]);
  const outsideLabel = useMemo(() => describeOutsideHours(requestedWhen, businessHours), [requestedWhen, businessHours]);

  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(() => new Set(initialPicks));
  const [selectedSlots, setSelectedSlots] = useState<string[]>(() => allSlots.slice(0, PRESELECT_SLOTS));
  const [includeMenu, setIncludeMenu] = useState<boolean>(() => pricingInquiry && initialPicks.length === 0);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "skip">("idle");
  const [showControls, setShowControls] = useState(false);

  // Let the AI read the transcript against the actual menu (judges severity/damage),
  // overriding the keyword guess. Runs once per open; survives the 10s soft refresh.
  const ranAi = useRef(false);
  useEffect(() => {
    if (ranAi.current) return;
    ranAi.current = true;
    if (!aiEnabled || !transcript.trim() || quoteRanges.length === 0) {
      setAiState("skip");
      return;
    }
    setAiState("loading");
    suggestServicesWithAI({ transcript, serviceNames: quoteRanges.map((r) => r.service) })
      .then((names) => {
        if (names.length > 0) {
          const byLower = new Map(quoteRanges.map((r, i) => [r.service.toLowerCase(), i]));
          const idxs = names
            .map((n) => byLower.get(n.toLowerCase()))
            .filter((i): i is number => typeof i === "number");
          if (idxs.length > 0) {
            setSelectedIdxs(new Set(idxs));
            setEdited(null);
          }
        }
        setAiState("done");
      })
      .catch(() => setAiState("done"));
  }, [aiEnabled, transcript, quoteRanges]);

  const selected = useMemo(
    () => [...selectedIdxs].sort((a, b) => a - b).map((i) => quoteRanges[i]).filter(Boolean),
    [selectedIdxs, quoteRanges]
  );
  const totalLow = selected.reduce((s, r) => s + r.low, 0);
  const totalHigh = selected.reduce((s, r) => s + r.high, 0);

  const draft = useMemo(
    () =>
      buildDraft({
        customerName,
        businessName,
        selected,
        slots: selectedSlots,
        includeMenu,
        allRanges: quoteRanges,
        pricingInquiry,
        outsideLabel
      }),
    [customerName, businessName, selected, selectedSlots, includeMenu, quoteRanges, pricingInquiry, outsideLabel]
  );

  const text = edited ?? draft;
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent">("idle");
  const [, startSendTransition] = useTransition();
  const send = () => {
    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("body", text);
    setSendState("sending");
    startSendTransition(async () => {
      await sendOwnerText(fd);
      setEdited(""); // clear the box after sending so it's ready for a fresh reply
      setSendState("sent");
      setTimeout(() => setSendState("idle"), 2500);
    });
  };

  const toggleService = (i: number) => {
    setSelectedIdxs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
    setEdited(null);
  };
  const toggleSlot = (slot: string) => {
    setSelectedSlots((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
    setEdited(null);
  };
  const toggleMenu = () => {
    setIncludeMenu((v) => !v);
    setEdited(null);
  };
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
        <span>✨ Reply to {customerName || "this lead"}</span>
        <span style={S.badge}>{aiState === "loading" ? "✨ reading the voicemail…" : "suggested · editable"}</span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setEdited(e.target.value)}
        rows={5}
        placeholder="Type a reply, or tweak the suggestion…"
        style={S.textarea}
      />
      <div style={S.actions}>
        <button type="button" onClick={send} disabled={sendState === "sending"} style={S.sendBtn}>
          {sendState === "sending" ? "Sending…" : sendState === "sent" ? "✓ Sent" : "💬 Send"}
        </button>
        <button type="button" onClick={copy} style={S.copyBtn}>{copied ? "✓ Copied" : "📋 Copy"}</button>
        {(quoteRanges.length > 0 || allSlots.length > 0) && (
          <button type="button" onClick={() => setShowControls((v) => !v)} style={S.tuneBtn}>
            {showControls ? "Hide options" : "⚙ Quote & times"}
          </button>
        )}
      </div>

      {showControls && (
        <div style={S.controls}>
          {quoteRanges.length > 0 ? (
            <>
              <div style={S.sectionLabel}>
                What they want{" "}
                {aiState === "done" ? (
                  <span style={S.auto}>· ✨ picked by AI</span>
                ) : initialPicks.length > 0 ? (
                  <span style={S.auto}>· auto-picked</span>
                ) : null}
              </div>
              <div style={S.chips}>
                {quoteRanges.map((r, i) => {
                  const on = selectedIdxs.has(i);
                  return (
                    <button key={`${r.service}-${i}`} type="button" onClick={() => toggleService(i)} style={chip(on)}>
                      {on ? "✓ " : ""}{r.service} <span style={S.chipPrice}>{priceText(r)}</span>
                    </button>
                  );
                })}
              </div>
              <div style={S.quoteLine}>
                {selected.length === 0
                  ? "No service selected — tap the ones they asked about."
                  : `Quote: ${totalLow === totalHigh ? fmtUsd(totalLow) : `${fmtUsd(totalLow)}–${fmtUsd(totalHigh)}`}${selected.length > 1 ? " total" : ""}`}
              </div>
              <button type="button" onClick={toggleMenu} style={menuToggle(includeMenu)}>
                {includeMenu ? "✓ Including full price list" : "+ Add full price list"}
              </button>
            </>
          ) : (
            <div style={S.noRanges}>Add your services + prices in Settings to quote automatically.</div>
          )}

          {allSlots.length > 0 && (
            <>
              <div style={S.sectionLabel}>Offer these times</div>
              {outsideLabel && (
                <div style={S.outsideNote}>
                  ⚠ They asked for {outsideLabel.toLowerCase()} — outside your hours. The reply offers your next open times instead.
                </div>
              )}
              <div style={S.chips}>
                {allSlots.map((slot) => {
                  const on = selectedSlots.includes(slot);
                  return (
                    <button key={slot} type="button" onClick={() => toggleSlot(slot)} style={chip(on)}>
                      {on ? "✓ " : ""}{slot}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function chip(on: boolean): CSSProperties {
  return {
    padding: "7px 11px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${on ? "var(--brand)" : "#d8dce3"}`,
    background: on ? "rgba(var(--brand-rgb),0.12)" : "#fff",
    color: on ? "#2a2a8a" : "#3c414b"
  };
}
function menuToggle(on: boolean): CSSProperties {
  return {
    marginTop: 8,
    padding: "5px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px dashed ${on ? "var(--brand)" : "#c7ccd6"}`,
    background: on ? "rgba(var(--brand-rgb),0.08)" : "#fff",
    color: on ? "#2a2a8a" : "#6b7280"
  };
}

const S: Record<string, CSSProperties> = {
  card: { marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "#fff", border: "1px solid #d8dce3" },
  head: { fontSize: 13, fontWeight: 700, color: "#3a3a9a", marginBottom: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badge: { fontSize: 10, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.12)", padding: "2px 8px", borderRadius: 999 },
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#8a909c", textTransform: "uppercase", margin: "10px 0 6px" },
  auto: { fontWeight: 600, color: "var(--positive)", textTransform: "none", letterSpacing: 0 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chipPrice: { fontWeight: 700, opacity: 0.85 },
  quoteLine: { marginTop: 8, fontSize: 13, fontWeight: 700, color: "#15171b" },
  outsideNote: { marginBottom: 8, fontSize: 12, lineHeight: 1.45, color: "#8a5a0c", background: "rgba(199,125,20,0.1)", padding: "7px 10px", borderRadius: 9 },
  noRanges: { fontSize: 13, color: "#8a909c", padding: "6px 0" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  actions: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" },
  sendBtn: { padding: "10px 14px", borderRadius: 10, border: "none", background: "var(--positive)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  copyBtn: { padding: "10px 14px", borderRadius: 10, background: "#fff", border: "1px solid #d8dce3", color: "#1e2026", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  tuneBtn: { padding: "10px 12px", borderRadius: 10, background: "#fff", border: "1px solid #d8dce3", color: "#3c414b", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  controls: { marginTop: 12, paddingTop: 12, borderTop: "1px solid #eceef2" }
};
