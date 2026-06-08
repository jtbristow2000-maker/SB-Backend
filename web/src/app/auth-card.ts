import type { CSSProperties } from "react";

// Shared styling for the standalone auth screens (forgot / reset), matching the
// login + signup card aesthetic.
export const authCard: Record<string, CSSProperties> = {
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
  h1: { margin: "6px 0 14px", fontSize: 25, lineHeight: 1.15 },
  sub: { color: "#6f7787", fontSize: 13, lineHeight: 1.5, marginBottom: 4 },
  error: { marginBottom: 12, padding: "9px 11px", borderRadius: 10, background: "#fff2f2", color: "#a13b3b", fontSize: 13, fontWeight: 700 },
  ok: { marginBottom: 14, padding: "11px 12px", borderRadius: 10, background: "rgba(31,157,107,0.1)", color: "#1d6b4f", fontSize: 13, fontWeight: 600, lineHeight: 1.5 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 5, fontSize: 13, fontWeight: 700 },
  input: { padding: "11px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 15 },
  hint: { fontSize: 11, color: "#8a909c", fontWeight: 400 },
  primary: { marginTop: 2, padding: "11px 14px", borderRadius: 10, border: "none", background: "#5b5bd6", color: "#fff", fontWeight: 800, cursor: "pointer" },
  secondary: { display: "block", marginTop: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", background: "#fff", color: "#1e2026", fontWeight: 800, cursor: "pointer", textAlign: "center", textDecoration: "none" },
  linkBack: { display: "block", marginTop: 4, textAlign: "center", color: "#6f7787", fontSize: 13, textDecoration: "none", fontWeight: 600 }
};
