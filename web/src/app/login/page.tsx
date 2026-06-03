import type { CSSProperties } from "react";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main style={S.shell}>
      <section style={S.card}>
        <div style={S.eyebrow}>Owner login</div>
        <h1 style={S.h1}>Sign in to your dashboard</h1>
        {error && <div style={S.error}>Please check your email and password.</div>}

        <form action="/api/auth/sign-in" method="post" style={S.form}>
          <input type="hidden" name="redirectTo" value="/owner/today" />
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
          <button type="submit" style={S.primary}>Sign in</button>
          <div style={S.signup}>
            <div style={S.signupText}>First time here? Create the owner account with this email and password.</div>
            <button type="submit" formAction="/api/auth/sign-up" style={S.secondary}>Create account</button>
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
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #d8dce3",
    background: "#fff",
    color: "#1e2026",
    fontWeight: 800,
    cursor: "pointer"
  }
};
