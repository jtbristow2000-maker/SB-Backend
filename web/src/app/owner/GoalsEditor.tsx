"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import type { CSSProperties } from "react";
import { Pencil, X } from "lucide-react";

import { saveGoals } from "@/app/owner/actions";

// Inline editor for the weekly goals on the Stats screen. Collapsed to a small
// "Edit goals" pencil; expands to three number fields + Save. 0/blank = no goal.

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary" style={{ padding: "9px 16px", fontSize: 13 }}>
      {pending ? "Saving…" : "Save goals"}
    </button>
  );
}

export function GoalsEditor({
  weeklyCalls,
  weeklyLeads,
  weeklyBooked,
  startOpen
}: {
  weeklyCalls: number;
  weeklyLeads: number;
  weeklyBooked: number;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(startOpen));

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn" style={S.editBtn}>
        <Pencil size={12} aria-hidden /> Edit goals
      </button>
    );
  }

  return (
    <form action={saveGoals} style={S.form}>
      <div style={S.fields}>
        <label style={S.field}>
          Calls / week
          <input name="weekly_calls" type="number" min="0" max="999" defaultValue={weeklyCalls || ""} placeholder="—" className="input" style={S.num} />
        </label>
        <label style={S.field}>
          New leads / week
          <input name="weekly_leads" type="number" min="0" max="999" defaultValue={weeklyLeads || ""} placeholder="—" className="input" style={S.num} />
        </label>
        <label style={S.field}>
          Jobs booked / week
          <input name="weekly_booked" type="number" min="0" max="999" defaultValue={weeklyBooked || ""} placeholder="—" className="input" style={S.num} />
        </label>
      </div>
      <div style={S.row}>
        <SaveButton />
        <button type="button" onClick={() => setOpen(false)} className="btn" style={S.cancel} aria-label="Close goal editor">
          <X size={14} aria-hidden /> Cancel
        </button>
      </div>
      <div style={S.hint}>Leave a box empty to skip that goal.</div>
    </form>
  );
}

const S: Record<string, CSSProperties> = {
  editBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--muted)", fontWeight: 600, fontSize: 12, cursor: "pointer" },
  form: { marginTop: 12, padding: "13px 14px", borderRadius: 12, background: "#f6f7f9", border: "1px solid var(--border)" },
  fields: { display: "flex", gap: 12, flexWrap: "wrap" },
  field: { display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--text)" },
  num: { width: 110, padding: "9px 11px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, background: "#fff" },
  row: { display: "flex", gap: 8, alignItems: "center", marginTop: 12 },
  cancel: { display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 13px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--muted)", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  hint: { marginTop: 8, fontSize: 11.5, color: "var(--faint)" }
};
