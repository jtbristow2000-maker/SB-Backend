// Shared formatting + parsing helpers for the owner UI, deduped from per-page copies.
// (Price labels live with the quote settings — see quotePriceLabel in
// @/server/business/settings — so they're not duplicated here.)

export type Extracted = {
  caller_name?: string | null;
  requested_datetime?: string | null;
  service_requested?: string | null;
  summary?: string | null;
};

export function readExtracted(value: unknown): Extracted {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Extracted;
  }
  return {};
}

export function fmtPhone(p: string | null): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

export function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
