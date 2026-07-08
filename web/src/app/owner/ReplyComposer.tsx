"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Send, Sparkles, TriangleAlert } from "lucide-react";

import { sendOwnerText, suggestServicesWithAI } from "@/app/owner/actions";
import { fmtUsd } from "@/app/owner/format";
import { DEFAULT_SERVICE_MINUTES, DEFAULT_TRAVEL_BUFFER_MINUTES } from "@/server/business/settings";
import type { AiReplySettings, BusinessHoursSettings, QuoteRangeSettings } from "@/server/business/settings";

// Interactive reply builder for a missed-call lead, laid out draft-first: the
// assembled text is the hero (read it → hit Send), and the levers that build it
// (service picks with a live quote, open time slots) sit underneath as two
// collapsed "tap to change" rows — so the default path is a single decision.
// Toggling any chip rebuilds the draft; the owner can still hand-edit before
// sending. Rows start open only when there's nothing sensible pre-picked.

type Busy = { start: string; end: string | null };

const MAX_SLOTS = 8;          // total openings offered across all days
const MAX_SLOTS_PER_DAY = 4;  // spread options across days instead of stacking one day
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
function parseHour(hhmm: string, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return fallback;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return Number.isFinite(h) ? h : fallback;
}
// Start times to offer for a job of the given length: walk the work day from open
// to the latest start that still finishes by close, stepping by the job length. A
// short job yields more openings, a long one fewer — capped per day so options
// spread across days. Empty when the job can't fit inside a single work day.
function candidateStartHours(hours: BusinessHoursSettings, durationMin: number): number[] {
  const openH = parseHour(hours.open, 9);
  const closeH = parseHour(hours.close, 17);
  const durationH = Math.max(0.25, durationMin / 60);
  const latestStart = closeH - durationH;
  if (latestStart < openH - 1e-6) return [];
  const step = Math.max(0.5, durationH);
  const picks: number[] = [];
  for (let h = openH; h <= latestStart + 1e-6 && picks.length < MAX_SLOTS_PER_DAY; h += step) {
    picks.push(Math.round(h * 60) / 60);
  }
  return picks;
}
// Where to start looking, based on what the caller asked for — lands the first
// offered slots on the day they actually requested when they name one.
const REQ_DAY_RE: [number, RegExp][] = [
  [0, /\bsun(day)?\b/], [1, /\bmon(day)?\b/], [2, /\btue(s|sday)?\b/], [3, /\bwed(nesday)?\b/],
  [4, /\bthu(r|rs|rsday)?\b/], [5, /\bfri(day)?\b/], [6, /\bsat(urday)?\b/]
];
function startOffsetFor(requested: string): number {
  const t = requested.toLowerCase();
  for (const [dow, re] of REQ_DAY_RE) {
    if (re.test(t)) {
      const today = startOfDay(new Date()).getDay();
      let diff = (dow - today + 7) % 7;
      if (diff === 0) diff = 7; // named today's weekday → next week's occurrence
      if (/next week/.test(t) && diff < 7) diff += 7;
      return diff;
    }
  }
  if (/next week/.test(t)) return 7;
  if (/tomorrow/.test(t)) return 1;
  if (/\b(today|asap|as soon as|right away|now)\b/.test(t)) return 0;
  return 1;
}
// Put morning/afternoon slots first when the caller hinted at a time of day.
function orderHoursByRequest(slotHours: number[], requested: string): number[] {
  const t = requested.toLowerCase();
  if (/morning/.test(t)) return [...slotHours].sort((a, b) => a - b);
  if (/(afternoon|evening|night|after\s)/.test(t)) return [...slotHours].sort((a, b) => b - a);
  return slotHours;
}
function computeSlots(
  busy: Busy[],
  hours: BusinessHoursSettings,
  requested: string,
  durationMin: number,
  bufferMin: number
): string[] {
  const slotLenMs = Math.max(15, durationMin) * 60_000;
  const bufferMs = Math.max(0, bufferMin) * 60_000;
  // Pad each booked job by the travel buffer so we never offer a slot that lands
  // within drive time of an existing appointment.
  const intervals = busy.map((b) => {
    const s = new Date(b.start).getTime();
    const e = b.end ? new Date(b.end).getTime() : s + 3_600_000;
    return [s - bufferMs, e + bufferMs] as const;
  });
  const slotHours = orderHoursByRequest(candidateStartHours(hours, durationMin), requested);
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
      const endMs = startMs + slotLenMs;
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

// -------------------------------------------------------------- tone helpers
function greetingFor(name: string, formality: number): string {
  if (formality <= 1) return name ? `Hello ${name},` : "Hello,";
  if (formality <= 3) return name ? `Hi ${name}!` : "Hi there!";
  return name ? `Hey ${name}! 👋` : "Hey there! 👋";
}
function openingFor(warmth: number, hasSelected: boolean, pricingInquiry: boolean): string {
  if (warmth === 0) return "";
  if (hasSelected) return warmth >= 3 ? " Really glad you reached out!" : " Thanks for reaching out!";
  if (pricingInquiry) return warmth >= 3 ? " So glad you reached out — happy to help with a quote!" : " Thanks for reaching out — happy to give you a quote.";
  return warmth >= 3 ? " So glad you reached out — sorry we missed your call!" : " Thanks for reaching out — sorry we missed you.";
}
function closingFor(warmth: number, hasSlots: boolean, outsideLabel: string | null): string {
  if (!hasSlots && outsideLabel) return "";
  if (!hasSlots) return warmth >= 3 ? " Can't wait to connect — when works best for you?" : " When works best for you?";
  if (warmth === 0) return " Let me know which works.";
  if (warmth <= 2) return " Which works best for you?";
  return " Which works best? Looking forward to it!";
}

// ------------------------------------------------------------- message builder
function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
// Resolve a service's price to bounds, inferred from what's filled in:
// both boxes = a range, one box = a flat rate, neither = quote on site (null).
function bounds(r: QuoteRangeSettings): { lo: number; hi: number } | null {
  const low = r.low > 0 ? r.low : 0;
  const high = r.high > 0 ? r.high : 0;
  if (low <= 0 && high <= 0) return null;
  if (low > 0 && high > 0) return { lo: low, hi: high > low ? high : low };
  const single = low > 0 ? low : high;
  return { lo: single, hi: single };
}
function priceText(r: QuoteRangeSettings): string {
  const b = bounds(r);
  if (!b) return "Varies";
  return b.lo === b.hi ? fmtUsd(b.lo) : `${fmtUsd(b.lo)}–${fmtUsd(b.hi)}`;
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
  formality: number;
  warmth: number;
  signOff: string;
  customNote: string;
  quoteStyle: string;
  slotConflict?: boolean;
  confirmedSlot?: string | null;
}): string {
  const { customerName, businessName, selected, slots, includeMenu, allRanges, pricingInquiry, outsideLabel, formality, warmth, signOff, customNote, quoteStyle, slotConflict, confirmedSlot } = args;
  const hi = greetingFor(customerName, formality);
  const signer = signOff || businessName;
  const noteStr = customNote ? ` ${customNote}` : "";

  // Slot conflict: the time the customer wanted is now taken — apologise + offer alternatives
  if (slotConflict) {
    const altTimes = slots.length
      ? ` I do have these open: ${slots.slice(0, 3).join("; ")}.`
      : " Let me know a time that works and I'll do my best to fit you in.";
    return `${hi} So sorry — that time just got booked by someone else!${altTimes} Which works for you?${noteStr} — ${signer}`;
  }

  // Customer confirmed a specific slot and it's still free — send a quick confirmation
  if (confirmedSlot) {
    return `${hi} Perfect — ${confirmedSlot} is all set!${noteStr} See you then! — ${signer}`;
  }

  const intro = openingFor(warmth, selected.length >= 1, pricingInquiry);

  const priceLabel = (b: { lo: number; hi: number }) => (b.lo === b.hi ? fmtUsd(b.lo) : `${fmtUsd(b.lo)}–${fmtUsd(b.hi)}`);

  let quote = "";
  if (selected.length === 1) {
    const r = selected[0];
    const b = bounds(r);
    if (!b) {
      quote = ` We'll give you an exact price on the ${r.service.toLowerCase()} once we see it.`;
    } else {
      quote =
        b.lo === b.hi
          ? ` Your ${r.service.toLowerCase()} is ${fmtUsd(b.lo)}.`
          : ` Your ${r.service.toLowerCase()} runs ${priceLabel(b)}.`;
    }
  } else if (selected.length > 1) {
    const withBounds = selected.map((r) => ({ r, b: bounds(r) }));
    const priced = withBounds.filter((x) => x.b !== null);
    const varies = withBounds.filter((x) => x.b === null);
    const lowSum = priced.reduce((s, x) => s + (x.b?.lo ?? 0), 0);
    const highSum = priced.reduce((s, x) => s + (x.b?.hi ?? 0), 0);
    const totalStr = lowSum === highSum ? fmtUsd(lowSum) : `${fmtUsd(lowSum)}–${fmtUsd(highSum)}`;
    const variesNote = varies.length ? ` plus ${listPhrase(varies.map((x) => x.r.service.toLowerCase()))} (quoted on site)` : "";

    if (quoteStyle === "itemized") {
      const items = withBounds.map(({ r, b }) =>
        b ? `${r.service.toLowerCase()} ${priceLabel(b)}` : `${r.service.toLowerCase()} (quoted on site)`
      );
      quote = ` Here's the breakdown: ${listPhrase(items)}.`;
      if (priced.length) quote += ` That's about ${totalStr} altogether.`;
    } else if (priced.length === 0) {
      quote = ` We'll give you an exact price on the ${listPhrase(selected.map((r) => r.service.toLowerCase()))} once we see it.`;
    } else {
      const names = listPhrase(selected.map((r) => r.service.toLowerCase()));
      quote = ` For the ${names}, you're looking at about ${totalStr} altogether${variesNote}.`;
    }
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
  const closing = closingFor(warmth, slots.length > 0, outsideLabel);
  return `${hi}${intro}${quote}${menu}${times}${closing}${noteStr} — ${signer}`;
}

// ---------------------------------------------------------------- component
export function ReplyComposer({
  customerName,
  businessName,
  profileId,
  quoteRanges,
  businessHours,
  travelBufferMinutes = DEFAULT_TRAVEL_BUFFER_MINUTES,
  busy,
  requestedWhen,
  contextText,
  pricingInquiry,
  transcript,
  aiEnabled,
  aiSettings,
  slotConflict,
  confirmedSlot,
  textingLive,
  textingMissing
}: {
  customerName: string;
  businessName: string;
  profileId: string;
  quoteRanges: QuoteRangeSettings[];
  businessHours: BusinessHoursSettings;
  travelBufferMinutes?: number;
  busy: Busy[];
  requestedWhen: string;
  contextText: string;
  pricingInquiry: boolean;
  transcript: string;
  aiEnabled: boolean;
  aiSettings: AiReplySettings;
  slotConflict?: boolean;
  confirmedSlot?: string | null;
  textingLive?: boolean;
  textingMissing?: string[];
}) {
  const initialPicks = useMemo(
    () => aiSettings.ai_pick_enabled ? suggestServiceIdxs(contextText, quoteRanges) : [],
    [aiSettings.ai_pick_enabled, contextText, quoteRanges]
  );
  const outsideLabel = useMemo(() => describeOutsideHours(requestedWhen, businessHours), [requestedWhen, businessHours]);

  const [selectedIdxs, setSelectedIdxs] = useState<Set<number>>(() => new Set(initialPicks));

  // The chosen services drive the appointment length: their durations add up, so the
  // open slots below get tighter or more spread out as the owner toggles services.
  const selected = useMemo(
    () => [...selectedIdxs].sort((a, b) => a - b).map((i) => quoteRanges[i]).filter(Boolean),
    [selectedIdxs, quoteRanges]
  );
  const durationMin = useMemo(() => {
    const sum = selected.reduce((s, r) => s + (r.duration_minutes ?? DEFAULT_SERVICE_MINUTES), 0);
    return sum > 0 ? sum : DEFAULT_SERVICE_MINUTES;
  }, [selected]);
  const allSlots = useMemo(
    () => computeSlots(busy, businessHours, requestedWhen, durationMin, travelBufferMinutes),
    [busy, businessHours, requestedWhen, durationMin, travelBufferMinutes]
  );

  const [selectedSlots, setSelectedSlots] = useState<string[]>(() => allSlots.slice(0, PRESELECT_SLOTS));
  const [includeMenu, setIncludeMenu] = useState<boolean>(() => pricingInquiry && initialPicks.length === 0);
  const [edited, setEdited] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiState, setAiState] = useState<"idle" | "loading" | "done" | "skip">("idle");
  // The two "tap to change" rows start open only when nothing useful is pre-picked.
  const [svcOpen, setSvcOpen] = useState<boolean>(() => initialPicks.length === 0);
  const [timesOpen, setTimesOpen] = useState(false);

  // Let the AI read the transcript against the actual menu (judges severity/damage),
  // overriding the keyword guess. Runs once per open; survives the 10s soft refresh.
  const ranAi = useRef(false);
  useEffect(() => {
    if (ranAi.current) return;
    ranAi.current = true;
    if (!aiSettings.ai_pick_enabled || !aiEnabled || !transcript.trim() || quoteRanges.length === 0) {
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

  // When the offered slots change (e.g. the owner picks a longer service), drop any
  // selected times that no longer fit; if none survive, pre-pick the first few.
  useEffect(() => {
    setSelectedSlots((prev) => {
      const keep = prev.filter((s) => allSlots.includes(s));
      if (keep.length === prev.length) return prev;
      return keep.length ? keep : allSlots.slice(0, PRESELECT_SLOTS);
    });
  }, [allSlots]);

  const pricedSelected = selected.filter((r) => bounds(r) !== null);
  const hasVaries = selected.some((r) => bounds(r) === null);
  const totalLow = pricedSelected.reduce((s, r) => s + (bounds(r)?.lo ?? 0), 0);
  const totalHigh = pricedSelected.reduce((s, r) => s + (bounds(r)?.hi ?? 0), 0);

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
        outsideLabel,
        formality: aiSettings.formality,
        warmth: aiSettings.warmth,
        signOff: aiSettings.sign_off,
        customNote: aiSettings.custom_note,
        quoteStyle: aiSettings.quote_style,
        slotConflict,
        confirmedSlot
      }),
    [customerName, businessName, selected, selectedSlots, includeMenu, quoteRanges, pricingInquiry, outsideLabel, aiSettings, slotConflict, confirmedSlot]
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

  // Plain-word summaries for the two collapsed rows, so the owner can see at a
  // glance what the draft includes without opening anything.
  const svcSummary =
    selected.length === 0
      ? "Nothing picked yet"
      : `${selected.map((r) => r.service).join(", ")}${
          pricedSelected.length > 0
            ? ` — ${totalLow === totalHigh ? fmtUsd(totalLow) : `${fmtUsd(totalLow)}–${fmtUsd(totalHigh)}`}`
            : " — quoted on site"
        }`;
  const timesSummary =
    selectedSlots.length === 0
      ? "No times offered"
      : selectedSlots.length <= 2
        ? selectedSlots.join(" · ")
        : `${selectedSlots.slice(0, 2).join(" · ")} +${selectedSlots.length - 2} more`;

  return (
    <div style={S.card}>
      <div style={S.head}>
        <span style={S.headTitle}><Sparkles size={15} aria-hidden /> Text them back</span>
        {textingLive !== undefined && (
          <span style={textingLive ? S.liveChip : S.draftChip}>
            <span style={{ ...S.liveDot, background: textingLive ? "var(--positive)" : "#c77d14" }} />
            {textingLive ? "Sends for real" : "Practice mode"}
          </span>
        )}
      </div>

      {aiState === "loading" ? (
        <div style={S.aiLine}><Sparkles size={12} className="ico-inline" aria-hidden /> Reading their voicemail and writing a reply…</div>
      ) : (
        <div style={S.aiLine}>Here&apos;s a reply ready to go — check it, then hit Send. Tap the rows below to change anything.</div>
      )}

      {/* The draft is the hero: read it, send it. */}
      <textarea value={text} onChange={(e) => setEdited(e.target.value)} rows={5} className="input" style={S.textarea} />
      <div style={S.actions}>
        <button type="button" onClick={send} disabled={sendState === "sending"} className="btn" style={S.sendBtn}>
          {sendState === "sending" ? "Sending…" : sendState === "sent" ? <><Check size={17} aria-hidden /> Sent!</> : <><Send size={17} aria-hidden /> Send text</>}
        </button>
        <button type="button" onClick={copy} className="btn" style={S.copyBtn} title="Copy the message so you can paste it anywhere">
          {copied ? <><Check size={15} aria-hidden /> Copied</> : <><Copy size={15} aria-hidden /> Copy</>}
        </button>
      </div>
      {textingLive === false && (
        <div style={S.practiceNote}>
          Practice mode: this saves the reply here instead of texting the customer.
          {textingMissing && textingMissing.length > 0 ? ` Turns on once set up (${textingMissing.join(", ")}).` : ""}
        </div>
      )}

      {/* What the draft is built from — collapsed unless something needs picking. */}
      {quoteRanges.length > 0 ? (
        <div style={S.rows}>
          <button type="button" onClick={() => setSvcOpen((v) => !v)} className="btn" style={S.rowToggle} aria-expanded={svcOpen}>
            {svcOpen ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
            <span style={S.rowLabel}>The job</span>
            <span className="clamp-1" style={S.rowValue}>{svcSummary}</span>
            {aiState === "done" && !svcOpen && <span style={S.auto}><Sparkles size={11} className="ico-inline" aria-hidden /> AI</span>}
          </button>
          {svcOpen && (
            <div style={S.rowBody}>
              <div style={S.rowHint}>Tap what they asked for — the price and reply update on their own.</div>
              <div style={S.chips}>
                {quoteRanges.map((r, i) => {
                  const on = selectedIdxs.has(i);
                  return (
                    <button key={`${r.service}-${i}`} type="button" onClick={() => toggleService(i)} className="btn" style={chip(on)}>
                      {on ? <Check size={12} aria-hidden /> : null}{r.service} <span style={S.chipPrice}>{priceText(r)}</span>
                    </button>
                  );
                })}
              </div>
              <button type="button" onClick={toggleMenu} className="btn" style={menuToggle(includeMenu)}>
                {includeMenu ? <><Check size={12} aria-hidden /> Full price list included</> : "+ Include your full price list"}
              </button>
            </div>
          )}

          {allSlots.length > 0 && (
            <>
              <button type="button" onClick={() => setTimesOpen((v) => !v)} className="btn" style={S.rowToggle} aria-expanded={timesOpen}>
                {timesOpen ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
                <span style={S.rowLabel}>Times offered</span>
                <span className="clamp-1" style={S.rowValue}>{timesSummary}</span>
              </button>
              {timesOpen && (
                <div style={S.rowBody}>
                  {outsideLabel && (
                    <div style={S.outsideNote}>
                      <TriangleAlert size={12} className="ico-inline" aria-hidden /> They asked for {outsideLabel.toLowerCase()} — outside your hours. These are your next open times instead.
                    </div>
                  )}
                  <div style={S.rowHint}>Tap the times you want to offer.</div>
                  <div style={S.chips}>
                    {allSlots.map((slot) => {
                      const on = selectedSlots.includes(slot);
                      return (
                        <button key={slot} type="button" onClick={() => toggleSlot(slot)} className="btn" style={chip(on)}>
                          {on ? <Check size={12} aria-hidden /> : null}{slot}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={S.noRanges}>Add your services + prices in Settings and replies will quote automatically.</div>
      )}
    </div>
  );
}

function chip(on: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
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
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
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
  card: { marginTop: 14, padding: "16px 16px 14px", borderRadius: "var(--radius-lg)", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 6 },
  headTitle: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 15, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.2px" },
  liveChip: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "#1d6b4f", background: "rgba(var(--positive-rgb),0.12)", padding: "3px 10px", borderRadius: 999 },
  draftChip: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "#8a5a0c", background: "rgba(199,125,20,0.12)", padding: "3px 10px", borderRadius: 999 },
  liveDot: { width: 7, height: 7, borderRadius: 999, flexShrink: 0 },
  aiLine: { fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginBottom: 10 },
  auto: { fontWeight: 600, color: "var(--positive)", whiteSpace: "nowrap", fontSize: 11.5 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6 },
  chipPrice: { fontWeight: 700, opacity: 0.85 },
  outsideNote: { marginBottom: 8, fontSize: 12.5, lineHeight: 1.45, color: "#8a5a0c", background: "rgba(199,125,20,0.1)", padding: "7px 10px", borderRadius: 9 },
  noRanges: { fontSize: 13, color: "var(--muted)", padding: "10px 0 2px" },
  textarea: { width: "100%", padding: "12px 13px", borderRadius: "var(--radius)", border: "1px solid #d8dce3", fontSize: 15, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  actions: { display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" },
  sendBtn: { flex: "1 1 200px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px 18px", borderRadius: "var(--radius)", border: "none", background: "var(--positive)", color: "#fff", fontWeight: 800, fontSize: 15.5, cursor: "pointer", boxShadow: "0 2px 8px rgba(var(--positive-rgb),0.3)" },
  copyBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "12px 16px", borderRadius: "var(--radius)", background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--ink)", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  practiceNote: { marginTop: 8, fontSize: 12, color: "#8a5a0c", lineHeight: 1.45 },
  rows: { marginTop: 14, borderTop: "1px solid var(--border)" },
  rowToggle: { width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "12px 2px", background: "none", border: "none", borderBottom: "1px solid var(--border)", cursor: "pointer", textAlign: "left", font: "inherit", color: "var(--muted)" },
  rowLabel: { fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", flexShrink: 0 },
  rowValue: { flex: 1, minWidth: 0, fontSize: 13, color: "var(--muted)" },
  rowBody: { padding: "10px 2px 14px", borderBottom: "1px solid var(--border)" },
  rowHint: { fontSize: 12.5, color: "var(--muted)", margin: "0 0 8px", lineHeight: 1.45 }
};
