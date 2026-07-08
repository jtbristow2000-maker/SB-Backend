"use client";

import { useFormStatus } from "react-dom";
import type { CSSProperties } from "react";

import { activateNumber } from "@/app/owner/actions";

// Activate (provision) the business number. Lets the owner pick a preferred area
// code and shows a "Provisioning…" state while the real Twilio purchase happens.
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn" style={{ ...S.primary, ...(pending ? S.pending : null) }}>
      {pending ? "Provisioning your number…" : "Activate my number"}
    </button>
  );
}

export function ActivateNumberForm() {
  return (
    <form action={activateNumber} style={S.form}>
      <label style={S.label}>
        Preferred area code <span style={S.opt}>(optional)</span>
        <input
          className="input"
          name="area_code"
          inputMode="numeric"
          maxLength={3}
          placeholder="e.g. 404"
          style={S.input}
          autoComplete="off"
        />
      </label>
      <SubmitButton />
    </form>
  );
}

const S: Record<string, CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: 9, marginTop: 6 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 700, color: "var(--text)" },
  opt: { fontWeight: 400, color: "var(--muted)" },
  input: { width: 120, padding: "9px 11px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 14 },
  primary: { alignSelf: "flex-start", padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  pending: { background: "#b9bdd6", cursor: "wait" }
};
