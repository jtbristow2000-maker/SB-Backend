"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { CalendarDays, Clock, X } from "lucide-react";

// Editable list of service → price-range rows for the Settings screen. Inputs
// carry name="quote_service|quote_low|quote_high|quote_duration" so they submit
// as parallel arrays with the surrounding <form action={saveSettings}>.

export type QuoteRange = { service: string; low: number; high: number; color?: string; on_calendar?: boolean; duration_minutes?: number };

type Row = { service: string; low: string; high: string; color: string; onCalendar: boolean; duration: string };

const PALETTE = [
  "#5b5bd6", "#16a34a", "#ea580c", "#0ea5e9", "#db2777",
  "#ca8a04", "#0d9488", "#7c3aed", "#dc2626", "#2563eb"
];

// How long each job takes — drives how many appointment slots get offered.
const DURATIONS: { value: number; label: string }[] = [
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hr" },
  { value: 90, label: "1½ hr" },
  { value: 120, label: "2 hr" },
  { value: 180, label: "3 hr" },
  { value: 240, label: "4 hr" },
  { value: 360, label: "6 hr" }
];
const DEFAULT_DURATION = "120";

export function QuoteRangesEditor({ initial }: { initial: QuoteRange[] }) {
  const [rows, setRows] = useState<Row[]>(
    initial.length
      ? initial.map((r) => ({ service: r.service, low: String(r.low), high: String(r.high), color: r.color || "#5b5bd6", onCalendar: r.on_calendar !== false, duration: String(r.duration_minutes ?? DEFAULT_DURATION) }))
      : [{ service: "", low: "", high: "", color: PALETTE[0], onCalendar: true, duration: DEFAULT_DURATION }]
  );

  const update = (i: number, key: "service" | "low" | "high" | "color" | "duration", value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const toggleCal = (i: number) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, onCalendar: !r.onCalendar } : r)));
  const add = () => setRows((prev) => [...prev, { service: "", low: "", high: "", color: PALETTE[prev.length % PALETTE.length], onCalendar: true, duration: DEFAULT_DURATION }]);
  const remove = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) =>
    setRows((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <div>
      <div style={S.editorHint}>Each service: calendar color · duration (sets how many openings to offer) · the calendar button hides it from your schedule · one price = flat rate, both = a range, blank = quoted on site</div>
      {rows.map((r, i) => (
        <div key={i} style={S.row}>
          <div style={S.reorder}>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={S.moveBtn} aria-label="Move up">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} style={S.moveBtn} aria-label="Move down">↓</button>
          </div>
          <input
            type="color"
            name="quote_color"
            value={r.color}
            onChange={(e) => update(i, "color", e.target.value)}
            style={S.color}
            aria-label="Calendar color for this service"
            title="Calendar color for this service"
          />
          <input
            name="quote_service"
            value={r.service}
            onChange={(e) => update(i, "service", e.target.value)}
            placeholder="Service (e.g. full detail)"
            className="input"
            style={S.service}
          />
          <span style={S.dollar}>$</span>
          <input
            name="quote_low"
            type="number"
            min="0"
            value={r.low}
            onChange={(e) => update(i, "low", e.target.value)}
            placeholder="price"
            className="input"
            style={S.num}
          />
          <span style={S.dash}>–</span>
          <input
            name="quote_high"
            type="number"
            min="0"
            value={r.high}
            onChange={(e) => update(i, "high", e.target.value)}
            placeholder="(or range)"
            className="input"
            style={S.num}
          />
          <span style={S.clock} title="How long this job takes"><Clock size={13} aria-hidden /></span>
          <select
            name="quote_duration"
            value={r.duration}
            onChange={(e) => update(i, "duration", e.target.value)}
            className="input"
            style={S.duration}
            aria-label="How long this service takes"
            title="How long this job takes — sets how many appointment times get offered"
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          <input type="hidden" name="quote_on_calendar" value={r.onCalendar ? "1" : "0"} />
          <button
            type="button"
            onClick={() => toggleCal(i)}
            className="btn"
            style={calToggle(r.onCalendar)}
            title={r.onCalendar ? "Shows on your calendar — tap to keep it off" : "Kept off your calendar — tap to put it on"}
            aria-label="Toggle calendar visibility"
          ><CalendarDays size={15} aria-hidden /></button>
          <button type="button" onClick={() => remove(i)} className="btn" style={S.del} aria-label="Remove"><X size={13} aria-hidden /></button>
        </div>
      ))}
      <button type="button" onClick={add} className="btn" style={S.add}>+ Add service</button>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  editorHint: { fontSize: 11.5, color: "#8a909c", marginBottom: 10, lineHeight: 1.4 },
  row: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  reorder: { display: "flex", flexDirection: "column", gap: 2 },
  moveBtn: { width: 22, height: 18, padding: 0, lineHeight: 1, borderRadius: 6, border: "1px solid #d8dce3", background: "#fff", color: "#3c414b", fontSize: 11, cursor: "pointer" },
  color: { width: 30, height: 30, padding: 0, border: "1px solid #d8dce3", borderRadius: 7, background: "#fff", cursor: "pointer", flexShrink: 0 },
  service: { flex: 1, minWidth: 110, padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  dollar: { color: "#8a909c", fontSize: 13 },
  dash: { color: "#8a909c" },
  num: { width: 72, padding: "8px 8px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  clock: { display: "inline-flex", alignItems: "center", color: "var(--muted)", flexShrink: 0 },
  duration: { width: 78, padding: "8px 6px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13, background: "#fff", cursor: "pointer", flexShrink: 0 },
  del: { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, padding: 0, borderRadius: 9, border: "1px solid #d8dce3", background: "#fff", color: "#b23b3b", cursor: "pointer", flexShrink: 0 },
  add: { marginTop: 2, padding: "8px 12px", borderRadius: 9, border: "1px dashed #b9bfca", background: "#fff", color: "#3c414b", fontWeight: 600, fontSize: 13, cursor: "pointer" }
};

function calToggle(on: boolean): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 30, height: 30, padding: 0, borderRadius: 7, cursor: "pointer", flexShrink: 0,
    border: `1px solid ${on ? "var(--brand)" : "#d8dce3"}`,
    background: on ? "rgba(var(--brand-rgb),0.1)" : "#f1f2f5",
    color: on ? "var(--brand)" : "var(--muted)",
    opacity: on ? 1 : 0.5
  };
}
