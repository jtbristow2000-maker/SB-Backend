"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

// Editable list of service → price-range rows for the Settings screen. Inputs
// carry name="quote_service|quote_low|quote_high" so they submit as parallel
// arrays with the surrounding <form action={saveSettings}>.

export type QuoteRange = { service: string; low: number; high: number };

type Row = { service: string; low: string; high: string };

export function QuoteRangesEditor({ initial }: { initial: QuoteRange[] }) {
  const [rows, setRows] = useState<Row[]>(
    initial.length
      ? initial.map((r) => ({ service: r.service, low: String(r.low), high: String(r.high) }))
      : [{ service: "", low: "", high: "" }]
  );

  const update = (i: number, key: keyof Row, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  const add = () => setRows((prev) => [...prev, { service: "", low: "", high: "" }]);
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
      {rows.map((r, i) => (
        <div key={i} style={S.row}>
          <div style={S.reorder}>
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={S.moveBtn} aria-label="Move up">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} style={S.moveBtn} aria-label="Move down">↓</button>
          </div>
          <input
            name="quote_service"
            value={r.service}
            onChange={(e) => update(i, "service", e.target.value)}
            placeholder="Service (e.g. full detail)"
            style={S.service}
          />
          <span style={S.dollar}>$</span>
          <input
            name="quote_low"
            type="number"
            min="0"
            value={r.low}
            onChange={(e) => update(i, "low", e.target.value)}
            placeholder="low"
            style={S.num}
          />
          <span style={S.dash}>–</span>
          <input
            name="quote_high"
            type="number"
            min="0"
            value={r.high}
            onChange={(e) => update(i, "high", e.target.value)}
            placeholder="high"
            style={S.num}
          />
          <button type="button" onClick={() => remove(i)} style={S.del} aria-label="Remove">✕</button>
        </div>
      ))}
      <button type="button" onClick={add} style={S.add}>+ Add service</button>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  row: { display: "flex", alignItems: "center", gap: 6, marginBottom: 8 },
  reorder: { display: "flex", flexDirection: "column", gap: 2 },
  moveBtn: { width: 22, height: 18, padding: 0, lineHeight: 1, borderRadius: 6, border: "1px solid #d8dce3", background: "#fff", color: "#3c414b", fontSize: 11, cursor: "pointer" },
  service: { flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  dollar: { color: "#8a909c", fontSize: 13 },
  dash: { color: "#8a909c" },
  num: { width: 72, padding: "8px 8px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  del: { padding: "6px 9px", borderRadius: 9, border: "1px solid #d8dce3", background: "#fff", color: "#b23b3b", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  add: { marginTop: 2, padding: "8px 12px", borderRadius: 9, border: "1px dashed #b9bfca", background: "#fff", color: "#3c414b", fontWeight: 600, fontSize: 13, cursor: "pointer" }
};
