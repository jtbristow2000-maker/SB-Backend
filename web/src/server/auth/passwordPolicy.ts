// Shared password policy + strength scoring. Pure functions (no imports), so both
// the client auth forms and the server handlers use the exact same rules.

export const PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) }
];

export function meetsPasswordPolicy(pw: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(pw));
}

export type PasswordStrength = { score: 0 | 1 | 2 | 3 | 4; label: string; color: string };

// Heuristic strength relative to general-purpose account security: rewards length
// first (the biggest real-world factor), then character variety.
export function passwordStrength(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: "", color: "#d8dce3" };

  let points = 0;
  if (pw.length >= 8) points += 1;
  if (pw.length >= 12) points += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points += 1;
  if (/[0-9]/.test(pw)) points += 1;
  if (/[^A-Za-z0-9]/.test(pw)) points += 1;

  if (pw.length < 8 || points <= 1) return { score: 1, label: "Weak", color: "#dc2626" };
  if (points === 2) return { score: 2, label: "Fair", color: "#ea580c" };
  if (points === 3) return { score: 3, label: "Good", color: "#ca8a04" };
  return { score: 4, label: "Strong", color: "#16a34a" };
}
