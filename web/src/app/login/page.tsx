import Link from "next/link";
import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_login: "That email or password didn't match. Please try again.",
  email_and_password_required: "Please enter your email and password.",
  supabase_auth_not_configured: "Login isn't fully configured yet — check your environment settings.",
  link_expired: "That link expired or was already used. Request a new reset link.",
  setup: "We're finishing your account setup. Give it a moment and try again."
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string; reset?: string }>;
}) {
  const { error, redirectTo: rawRedirectTo, reset } = await searchParams;
  const redirectTo = rawRedirectTo?.startsWith("/") ? rawRedirectTo : "/owner/today";
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Please check your email and password." : null;

  return (
    <main style={S.shell}>
      <section style={S.card}>
        <div style={S.eyebrow}>Owner login</div>
        <h1 style={S.h1}>Sign in to your dashboard</h1>
        {reset && <div style={S.ok}>Password updated — sign in with your new password.</div>}
        {errorMessage && <div style={S.error}>{errorMessage}</div>}

        <form action="/api/auth/sign-in" method="post" style={S.form}>
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <label style={S.label}>
            Email
            <input name="email" type="email" required autoComplete="email" style={S.input} />
          </label>
          <label style={S.label}>
            Password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              style={S.input}
            />
          </label>
          <Link href="/forgot" style={S.forgot}>Forgot password?</Link>
          <button type="submit" style={S.primary}>Sign in</button>
          <div style={S.signup}>
            <div style={S.signupText}>First time here? Set up your business in a minute.</div>
            <Link href="/signup" style={S.secondary}>Create an account</Link>
          </div>
        </form>
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
    maxWidth: 390,
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
  ok: { marginBottom: 12, padding: "9px 11px", borderRadius: 10, background: "rgba(31,157,107,0.1)", color: "#1d6b4f", fontSize: 13, fontWeight: 600 },
  forgot: { alignSelf: "flex-end", color: "#5b5bd6", fontSize: 12.5, textDecoration: "none", fontWeight: 600, marginTop: -4 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 700 },
  input: { padding: "11px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 15 },
  primary: {
    marginTop: 2,
    padding: "11px 14px",
    borderRadius: 10,
    border: "none",
    background: "#5b5bd6",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer"
  },
  signup: { marginTop: 16, paddingTop: 16, borderTop: "1px solid #eceef2" },
  signupText: { color: "#6f7787", fontSize: 12, lineHeight: 1.45, marginBottom: 9 },
  secondary: {
    display: "block",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d8dce3",
    background: "#fff",
    color: "#1e2026",
    fontWeight: 800,
    cursor: "pointer",
    textAlign: "center",
    textDecoration: "none"
  }
};
