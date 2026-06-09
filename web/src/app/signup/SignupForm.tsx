"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";

import { PasswordField } from "@/app/PasswordField";
import { PasswordStrength } from "@/app/PasswordStrength";
import { meetsPasswordPolicy } from "@/server/auth/passwordPolicy";

// Client form for the dedicated sign-up screen. Does inline validation BEFORE
// posting (min password length + confirm match) so owners get a specific
// message instead of a vague "check your email and password". Posts to the
// same /api/auth/sign-up handler the login page uses; the extra profile fields
// (business_name / owner_name / phone) are consumed once the server handler is
// wired to seed the business from them.

export function SignupForm({
  errorMessage,
  redirectTo,
  inviteRequired
}: {
  errorMessage: string | null;
  redirectTo: string;
  inviteRequired: boolean;
}) {
  const [clientError, setClientError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (!meetsPasswordPolicy(password)) {
      e.preventDefault();
      setClientError("Your password needs at least 8 characters, one uppercase letter, and one number.");
      return;
    }
    if (password !== confirm) {
      e.preventDefault();
      setClientError("Those two passwords don't match.");
      return;
    }
    setClientError(null);
  }

  const message = clientError ?? errorMessage;

  return (
    <main style={S.shell}>
      <section style={S.card}>
        <div style={S.eyebrow}>Create your account</div>
        <h1 style={S.h1}>Set up your dashboard</h1>
        {message && <div style={S.error}>{message}</div>}

        <form action="/api/auth/sign-up" method="post" style={S.form} onSubmit={handleSubmit}>
          <input type="hidden" name="redirectTo" value={redirectTo} />

          {inviteRequired && (
            <label style={S.label}>
              Invite code
              <input name="invite_code" type="text" required autoComplete="off" placeholder="Enter your invite code" style={S.input} />
            </label>
          )}

          <label style={S.label}>
            Business name
            <input
              name="business_name"
              type="text"
              required
              autoComplete="organization"
              placeholder="e.g. Riverside Auto Detailing"
              style={S.input}
            />
          </label>

          <label style={S.label}>
            Your name
            <input
              name="owner_name"
              type="text"
              required
              autoComplete="name"
              placeholder="e.g. Alex Carter"
              style={S.input}
            />
          </label>

          <label style={S.label}>
            Email
            <input name="email" type="email" required autoComplete="email" style={S.input} />
          </label>

          <label style={S.label}>
            Phone <span style={S.optional}>(optional)</span>
            <input name="phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" style={S.input} />
          </label>

          <label style={S.label}>
            Password
            <PasswordField name="password" value={password} onChange={setPassword} placeholder="Create a password" />
          </label>

          <PasswordStrength password={password} />

          <label style={S.label}>
            Confirm password
            <PasswordField name="confirm_password" value={confirm} onChange={setConfirm} placeholder="Re-type password" />
          </label>
          {confirm.length > 0 && password !== confirm && <div style={S.mismatch}>Passwords don&apos;t match yet.</div>}

          <button type="submit" style={S.primary}>Create account</button>
        </form>

        <div style={S.footer}>
          Already have an account? <Link href="/login" style={S.link}>Sign in</Link>
        </div>
      </section>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  shell: {
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    background: "#f4f5f8",
    fontFamily: "Segoe UI, system-ui, sans-serif",
    color: "#1e2026"
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderRadius: 18,
    background: "#fff",
    border: "1px solid #e3e6ee",
    boxShadow: "0 18px 40px rgba(17,21,28,0.10)"
  },
  eyebrow: { fontSize: 12, fontWeight: 700, letterSpacing: 1, color: "#8a909c" },
  h1: { margin: "6px 0 16px", fontSize: 25, lineHeight: 1.15 },
  error: {
    marginBottom: 12,
    padding: "9px 11px",
    borderRadius: 10,
    background: "#fff2f2",
    color: "#a13b3b",
    fontSize: 13,
    fontWeight: 700
  },
  mismatch: { fontSize: 12, color: "#a13b3b", fontWeight: 600, marginTop: -4 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 700 },
  optional: { fontWeight: 400, color: "#8a909c", fontSize: 12 },
  hint: { fontSize: 11, color: "#8a909c", fontWeight: 400 },
  input: { padding: "11px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 15 },
  primary: {
    marginTop: 4,
    padding: "11px 14px",
    borderRadius: 10,
    border: "none",
    background: "#5b5bd6",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer"
  },
  footer: { marginTop: 16, paddingTop: 16, borderTop: "1px solid #eceef2", fontSize: 13, color: "#6f7787" },
  link: { color: "#5b5bd6", fontWeight: 700, textDecoration: "none" }
};
