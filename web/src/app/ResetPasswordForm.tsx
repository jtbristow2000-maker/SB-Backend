"use client";

import { useState, type CSSProperties, type FormEvent } from "react";

import { PasswordField } from "@/app/PasswordField";
import { PasswordStrength } from "@/app/PasswordStrength";
import { meetsPasswordPolicy } from "@/server/auth/passwordPolicy";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const policyOk = meetsPasswordPolicy(password);
  const matches = password === confirm;
  const canSubmit = policyOk && matches && confirm.length > 0;

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (!policyOk) {
      e.preventDefault();
      setError("Your password needs to meet all the requirements below.");
      return;
    }
    if (!matches) {
      e.preventDefault();
      setError("Those two passwords don't match.");
      return;
    }
    setError(null);
  }

  return (
    <form action="/api/auth/update-password" method="post" style={S.form} onSubmit={handleSubmit}>
      {error && <div style={S.error}>{error}</div>}

      <label style={S.label}>
        New password
        <PasswordField name="password" value={password} onChange={setPassword} placeholder="New password" />
      </label>

      <PasswordStrength password={password} />

      <label style={S.label}>
        Confirm password
        <PasswordField name="confirm_password" value={confirm} onChange={setConfirm} placeholder="Re-type password" />
      </label>
      {confirm.length > 0 && !matches && <div style={S.mismatch}>Passwords don&apos;t match yet.</div>}

      <button type="submit" disabled={!canSubmit} style={{ ...S.primary, ...(canSubmit ? null : S.primaryOff) }}>
        Update password
      </button>
    </form>
  );
}

const S: Record<string, CSSProperties> = {
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 700 },
  error: { marginBottom: 2, padding: "9px 11px", borderRadius: 10, background: "#fff2f2", color: "#a13b3b", fontSize: 13, fontWeight: 700 },
  mismatch: { fontSize: 12, color: "#a13b3b", fontWeight: 600, marginTop: -4 },
  primary: { marginTop: 4, padding: "11px 14px", borderRadius: 10, border: "none", background: "#5b5bd6", color: "#fff", fontWeight: 800, cursor: "pointer" },
  primaryOff: { background: "#b9bdd6", cursor: "not-allowed" }
};
