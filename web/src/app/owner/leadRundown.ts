import { quotePriceLabel, type QuoteRangeSettings } from "@/server/business/settings";
import type { CallRecordRow } from "@/server/db/schema";

import { readExtracted } from "./format";

// Owner-facing one-glance summary of a lead — the same facts the suggested reply is
// built from, but framed for the owner (what they want, the quote, when). Pulled from
// the lead's most recent AI-extracted call. Shown on hover in the callback lists.

export type LeadRundown = {
  summary: string | null;
  wants: string | null;
  when: string | null;
  quote: string | null;
};

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

  return { summary, wants, when, quote: quotePriceLabel(wants, ranges) };
}

// Time of the most recent call + voicemail length, for the lead-card sub-line.
export function callMetaLabels(
  profileId: string,
  calls: CallRecordRow[],
  tz: string
): { timeLabel: string | null; vmLabel: string | null } {
  const profileCalls = calls
    .filter((c) => c.customer_profile_id === profileId)
    .sort((a, b) => {
      const at = a.started_at ?? a.created_at ?? "";
      const bt = b.started_at ?? b.created_at ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0;
    });
  const c = profileCalls.find((x) => x.call_type === "voicemail" || x.transcript) ?? profileCalls[0];
  if (!c) return { timeLabel: null, vmLabel: null };
  const at = c.started_at ?? c.created_at ?? null;
  const timeLabel = at
    ? new Date(at).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
    : null;
  const secs = typeof c.duration_seconds === "number" ? c.duration_seconds : null;
  const vmLabel =
    secs && secs > 0 && (c.call_type === "voicemail" || c.transcript)
      ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
      : null;
  return { timeLabel, vmLabel };
}
