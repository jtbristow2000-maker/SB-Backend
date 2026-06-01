import type { QuoteRangeSettings } from "@/server/business/settings";
import type { CallRecordRow, JsonValue } from "@/server/db/schema";

// Owner-facing one-glance summary of a lead — the same facts the suggested reply is
// built from, but framed for the owner (what they want, the quote, when). Pulled from
// the lead's most recent AI-extracted call. Shown on hover in the callback lists.

export type LeadRundown = {
  summary: string | null;
  wants: string | null;
  when: string | null;
  quote: string | null;
};

type Extracted = {
  requested_datetime?: string | null;
  service_requested?: string | null;
  summary?: string | null;
};

function readExtracted(value: JsonValue | undefined): Extracted {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Extracted) : {};
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function priceForService(service: string | null, ranges: QuoteRangeSettings[]): string | null {
  const s = (service ?? "").trim().toLowerCase();
  if (!s || ranges.length === 0) return null;
  let best: QuoteRangeSettings | null = null;
  for (const r of ranges) {
    const rs = r.service.trim().toLowerCase();
    if (!rs) continue;
    if (s === rs) {
      best = r;
      break;
    }
    if ((s.includes(rs) || rs.includes(s)) && !best) best = r;
  }
  if (!best) return null;
  return best.low === best.high ? fmtUsd(best.low) : `${fmtUsd(best.low)}–${fmtUsd(best.high)}`;
}

export function buildLeadRundown(
  profileId: string,
  calls: CallRecordRow[],
  ranges: QuoteRangeSettings[]
): LeadRundown {
  const profileCalls = calls
    .filter((c) => c.customer_profile_id === profileId)
    .sort((a, b) => {
      const at = a.started_at ?? a.created_at ?? "";
      const bt = b.started_at ?? b.created_at ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0; // newest first
    });

  let summary: string | null = null;
  let wants: string | null = null;
  let when: string | null = null;
  for (const c of profileCalls) {
    const e = readExtracted(c.extracted_json);
    if (c.ai_summary || e.service_requested || e.requested_datetime || e.summary) {
      summary = c.ai_summary || e.summary || null;
      wants = e.service_requested ?? null;
      when = e.requested_datetime ?? null;
      break;
    }
  }

  return { summary, wants, when, quote: priceForService(wants, ranges) };
}
