"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

// A password input with a show/hide eye toggle. Controlled (value + onChange) so the
// parent can run live strength + match checks.
export function PasswordField({
  name,
  value,
  onChange,
  placeholder,
  autoComplete = "new-password"
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div style={S.wrap}>
      <input
        name={name}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
        minLength={8}
        style={S.input}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={S.eye}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { position: "relative", display: "flex" },
  input: { width: "100%", padding: "11px 44px 11px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 15, boxSizing: "border-box" },
  eye: { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: "#8a909c", cursor: "pointer", padding: 6, display: "flex", alignItems: "center", lineHeight: 1 }
};
