"use client";

import type { CSSProperties } from "react";

import { PASSWORD_RULES, passwordStrength } from "@/server/auth/passwordPolicy";

// Live strength meter (4 segments) + the requirement checklist. Driven entirely by
// the current password string.
export function PasswordStrength({ password }: { password: string }) {
  const strength = passwordStrength(password);
  return (
    <div style={S.wrap}>
      <div style={S.bars}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ ...S.bar, background: i <= strength.score ? strength.color : "#e3e6ee" }} />
        ))}
      </div>
      {strength.label && (
        <div style={{ ...S.label, color: strength.color }}>Password strength: {strength.label}</div>
      )}
      <ul style={S.rules}>
        {PASSWORD_RULES.map((rule) => {
          const met = rule.test(password);
          return (
            <li key={rule.label} style={{ ...S.rule, color: met ? "#1d6b4f" : "#8a909c" }}>
              <span aria-hidden style={{ marginRight: 6 }}>{met ? "✓" : "○"}</span>
              {rule.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { marginTop: 2 },
  bars: { display: "flex", gap: 5 },
  bar: { flex: 1, height: 5, borderRadius: 999, transition: "background .2s ease" },
  label: { fontSize: 12, fontWeight: 700, marginTop: 6 },
  rules: { listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 3 },
  rule: { fontSize: 12, fontWeight: 600 }
};
