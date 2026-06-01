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

  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} style={S.row}>
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
  service: { flex: 1, minWidth: 120, padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  dollar: { color: "#8a909c", fontSize: 13 },
  dash: { color: "#8a909c" },
  num: { width: 72, padding: "8px 8px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  del: { padding: "6px 9px", borderRadius: 9, border: "1px solid #d8dce3", background: "#fff", color: "#b23b3b", fontWeight: 700, fontSize: 12, cursor: "pointer" },
  add: { marginTop: 2, padding: "8px 12px", borderRadius: 9, border: "1px dashed #b9bfca", background: "#fff", color: "#3c414b", fontWeight: 600, fontSize: 13, cursor: "pointer" }
};
