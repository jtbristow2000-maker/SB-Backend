import Link from "next/link";
import type { CSSProperties } from "react";

import { getIntakeRuntime, hasConfiguredExtractionProvider } from "@/server/intake/runtime";
import { getAppConfig } from "@/server/config";
import { getBusinessSettings, type QuoteRangeSettings } from "@/server/business/settings";
import { buildProfileDetail } from "@/server/profiles/detail";
import { createAppointment, markCallbackDone, sendOwnerText, setProfileStatus } from "@/app/owner/actions";
import { ReplyComposer } from "@/app/owner/ReplyComposer";
import { ContactButtons } from "@/app/owner/ContactButtons";
import { MarkLeadRead } from "@/app/owner/MarkLeadRead";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Owner screen — Lead detail. The voicemail transcript is the centerpiece up top,
// then the interactive reply composer, one-tap Call/Text, status + booking, and
// any earlier activity (older calls + texts). Times render in the business timezone.
// ---------------------------------------------------------------------------

const FALLBACK_TZ = "America/New_York";

type Extracted = {
  caller_name?: string | null;
  requested_datetime?: string | null;
  service_requested?: string | null;
  summary?: string | null;
};

function readExtracted(value: unknown): Extracted {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Extracted;
  }
  return {};
}

function fmtPhone(p: string | null): string {
  if (!p) return "Unknown number";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

function fmtTime(iso: string | null, tz: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

// Best-effort quote for a service from the saved ranges (exact match, else substring).
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

function callLabel(callType: string, hasTranscript: boolean, hasRecording: boolean): string {
  if (callType === "answered") return "You answered";
  if (callType === "voicemail" || hasTranscript || hasRecording) return "Voicemail";
  return "Missed · no voicemail";
}

function autoReplyText(status: string): string {
  if (status === "sent") return "sent";
  if (status === "failed") return "FAILED";
  if (status === "queued") return "not sent yet";
  return status;
}

export default async function OwnerLead({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rt = await getIntakeRuntime();
  const [businesses, profiles, calls, messages, tasks, appointments] = await Promise.all([
    rt.businessRepository.list(),
    rt.customerProfileRepository.list(),
    rt.callRecordRepository.list(),
    rt.messageRepository.list(),
    rt.taskRepository.list(),
    rt.appointmentRepository.list()
  ]);
  const business = businesses[0] ?? null;
  const settings = getBusinessSettings(business);
  const tz = business?.timezone || FALLBACK_TZ;
  const detail = business
    ? buildProfileDetail({ businessId: business.id, profileId: id, profiles, calls, messages, tasks })
    : null;

  if (!detail) {
    return (
      <main style={S.shell}>
        <Link href="/owner" style={S.back}>← Callbacks</Link>
        <div style={S.empty}>Lead not found. It may have been reset.</div>
      </main>
    );
  }

  const { profile, timeline, open_task, customer_replied } = detail;
  // Oldest first, so the newest call/message sits at the bottom (text-thread style).
  const orderedTimeline = [...timeline].sort((a, b) => {
    const at = a.at ?? "";
    const bt = b.at ?? "";
    return at < bt ? -1 : at > bt ? 1 : 0;
  });

  // Most recent of THIS lead's calls that has AI-extracted details, for the quick-summary card.
  const profileCalls = calls
    .filter((c) => c.customer_profile_id === profile.id)
    .sort((a, b) => {
      const at = a.started_at ?? a.created_at ?? "";
      const bt = b.started_at ?? b.created_at ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0; // newest first
    });
  let aiX: Extracted = {};
  let aiSummaryText: string | null = null;
  let aiTranscript: string | null = null;
  for (const c of profileCalls) {
    const e = readExtracted(c.extracted_json);
    if (c.ai_summary || e.caller_name || e.requested_datetime || e.service_requested || e.summary) {
      aiX = e;
      aiSummaryText = c.ai_summary || e.summary || null;
      aiTranscript = c.transcript ?? null;
      break;
    }
  }
  const busy = appointments
    .filter((a) => !business || a.business_id === business.id)
    .map((a) => ({ start: a.scheduled_start_at, end: a.scheduled_end_at }));

  // The voicemail itself is the centerpiece — surface the latest one up top, and
  // keep the rest of the thread (older calls + texts) as "earlier activity" below.
  const heroCall =
    profileCalls.find((c) => c.transcript) ??
    profileCalls.find((c) => c.call_type === "voicemail" || c.recording_url) ??
    null;
  const restTimeline = orderedTimeline.filter(
    (item) => !(item.kind === "call" && heroCall !== null && item.call.id === heroCall.id)
  );

  // Context the reply composer uses to pre-pick services + detect a price question.
  const contextText = [aiX.service_requested, aiSummaryText, aiTranscript].filter(Boolean).join(" ");
  const pricingInquiry = /\b(price|pricing|cost|how much|quote|charge|rate|rates)\b/i.test(contextText);
  const aiEnabled = hasConfiguredExtractionProvider(getAppConfig());
  // Pre-fill booking notes from the voicemail (condition / vehicle / details) plus a
  // "Quote:" header from the saved price ranges, so the appointment carries the price
  // and context onto the calendar instead of starting blank.
  const bookingPrice = priceForService(aiX.service_requested ?? null, settings.quote_ranges);
  const bookingSummary = aiSummaryText ?? (aiTranscript ? aiTranscript.slice(0, 200) : "");
  const bookingNotes = [bookingPrice ? `Quote: ${bookingPrice}` : null, bookingSummary || null]
    .filter(Boolean)
    .join("\n");

  return (
    <main style={S.shell}>
      <MarkLeadRead id={profile.id} activity={profile.last_contact_at} />
      <Link href="/owner" style={S.back}>← Callbacks</Link>

      <header style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h1 style={S.h1}>{profile.display_name || fmtPhone(profile.phone_e164)}</h1>
          {customer_replied && <span style={S.replied}>Replied</span>}
        </div>
        <div style={S.sub}>
          {fmtPhone(profile.phone_e164)} · status {profile.status}
          {profile.last_contact_at ? ` · last heard ${fmtTime(profile.last_contact_at, tz)}` : ""}
        </div>
      </header>

      {heroCall && (
        <section style={S.hero}>
          <div style={S.heroHead}>
            <span>🎙️ Voicemail</span>
            <span style={S.heroMeta}>
              {fmtTime(heroCall.started_at, tz)}{heroCall.duration_seconds ? ` · ${heroCall.duration_seconds}s` : ""}
            </span>
          </div>
          {heroCall.transcript ? (
            <>
              <div style={S.heroQuote}>“{heroCall.transcript}”</div>
              <div style={S.heroFoot}>
                {heroCall.needs_review && <span style={S.heroNote}>auto-transcribed · double-check the details</span>}
                {aiX.requested_datetime && <span style={S.heroWhen}>📅 asked for {aiX.requested_datetime}</span>}
              </div>
            </>
          ) : (
            <div style={S.transcribing}>⏳ Transcribing voicemail…</div>
          )}
        </section>
      )}

      {profile.phone_e164 && (
        <ReplyComposer
          customerName={profile.display_name || ""}
          businessName={business?.name || "us"}
          phone={profile.phone_e164}
          quoteRanges={settings.quote_ranges}
          businessHours={settings.business_hours}
          busy={busy}
          requestedWhen={aiX.requested_datetime ?? ""}
          contextText={contextText}
          pricingInquiry={pricingInquiry}
          transcript={heroCall?.transcript ?? ""}
          aiEnabled={aiEnabled}
        />
      )}

      {profile.phone_e164 && <ContactButtons phone={profile.phone_e164} profileId={profile.id} />}

      <div style={S.actionsRow}>
        <form action={setProfileStatus} style={S.inlineForm}>
          <input type="hidden" name="profileId" value={profile.id} />
          <select name="status" defaultValue={profile.status} style={S.select}>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="booked">Booked</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </select>
          <button type="submit" style={S.btnGhost}>Save status</button>
        </form>

        {open_task && (
          <form action={markCallbackDone}>
            <input type="hidden" name="taskId" value={open_task.id} />
            <input type="hidden" name="profileId" value={profile.id} />
            <button type="submit" style={S.btnPrimary}>✓ Mark callback done</button>
          </form>
        )}
      </div>

      <form action={createAppointment} style={S.bookRow}>
        <input type="hidden" name="profileId" value={profile.id} />
        <input
          type="hidden"
          name="title"
          value={`${profile.display_name || fmtPhone(profile.phone_e164)}${aiX.service_requested ? ` — ${aiX.service_requested}` : ""}`}
        />
        <input type="hidden" name="service" value={aiX.service_requested ?? ""} />
        <input type="hidden" name="notes" value={bookingNotes} />
        <span style={S.bookLabel}>📅 Book:</span>
        <input name="start" type="datetime-local" required style={S.bookInput} aria-label="Appointment time" />
        <select name="duration" defaultValue="60" style={S.bookSelect} aria-label="Duration">
          <option value="30">30m</option>
          <option value="60">1h</option>
          <option value="90">1.5h</option>
          <option value="120">2h</option>
          <option value="180">3h</option>
          <option value="240">4h</option>
        </select>
        <button type="submit" style={S.btnGhost}>Add</button>
      </form>

      {restTimeline.length > 0 && (
        <>
          <div style={S.paneTitle}>EARLIER ACTIVITY</div>
          {restTimeline.map((item) =>
            item.kind === "call" ? (
              <div key={item.call.id} style={S.callItem}>
                <div style={S.callHead}>
                  📞 {callLabel(item.call.call_type, Boolean(item.call.transcript), Boolean(item.call.recording_url))} · {fmtTime(item.at, tz)}
                  {item.call.duration_seconds ? ` · ${item.call.duration_seconds}s` : ""}
                </div>
                {item.call.transcript ? (
                  <div style={S.transcript}>
                    “{item.call.transcript}”
                    {item.call.needs_review && <span style={S.review}> · auto-transcribed, may contain errors</span>}
                  </div>
                ) : item.call.call_type === "voicemail" || item.call.recording_url ? (
                  <div style={S.transcribing}>⏳ Transcribing voicemail…</div>
                ) : null}
              </div>
            ) : (
              <div key={item.message.id} style={bubbleWrap(item.message.direction === "outbound")}>
                <div style={bubble(item.message.direction === "outbound")}>
                  <div>{item.message.body}</div>
                  <div style={S.bubbleMeta}>
                    {item.message.direction === "outbound"
                      ? `Auto-reply · ${autoReplyText(item.message.status)}`
                      : "Customer"}{" "}
                    · {fmtTime(item.at, tz)}
                  </div>
                </div>
              </div>
            )
          )}
        </>
      )}

      <form action={sendOwnerText} style={S.compose}>
        <input type="hidden" name="profileId" value={profile.id} />
        <input name="body" placeholder="Log a reply…" style={S.textInput} autoComplete="off" />
        <button type="submit" style={S.btnPrimary}>Send</button>
      </form>

      <footer style={S.footer}>
        Replies sent here go out from your business number once texting is switched on. To reply right
        now, tap <strong>Call back</strong> or <strong>Text</strong> above (from your phone).
      </footer>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  shell: { maxWidth: 720, margin: "0 auto", padding: "22px 20px 48px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  back: { color: "var(--brand)", fontWeight: 600, fontSize: 13, textDecoration: "none" },
  h1: { margin: "6px 0 2px", fontSize: 22 },
  sub: { color: "#8a909c", fontSize: 13 },
  replied: { fontSize: 11, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.12)", padding: "3px 9px", borderRadius: 999 },
  hero: { marginTop: 14, padding: "16px 18px", borderRadius: 14, background: "#fff", border: "1px solid #e3e6ec", borderLeft: "4px solid var(--brand)", boxShadow: "0 1px 3px rgba(17,21,28,0.05)" },
  heroHead: { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: 0.4, color: "var(--brand)", textTransform: "uppercase" },
  heroMeta: { fontSize: 12, fontWeight: 600, color: "#8a909c", textTransform: "none", letterSpacing: 0 },
  heroQuote: { margin: "8px 0 0", fontSize: 17, lineHeight: 1.5, color: "#15171b", fontWeight: 500 },
  heroFoot: { display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 10, alignItems: "center" },
  heroNote: { fontSize: 11, color: "#9a6210" },
  heroWhen: { fontSize: 12, fontWeight: 700, color: "#2a2a8a", background: "rgba(var(--brand-rgb),0.1)", padding: "2px 9px", borderRadius: 999 },
  quickActions: { display: "flex", gap: 10, margin: "12px 0 4px" },
  callBtn: { flex: 1, textAlign: "center", padding: "12px", borderRadius: 11, background: "var(--positive)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" },
  textBtn: { flex: 1, textAlign: "center", padding: "12px", borderRadius: 11, background: "#fff", border: "1px solid #d8dce3", color: "#1e2026", fontWeight: 700, fontSize: 15, textDecoration: "none" },
  taskBar: { padding: "9px 13px", borderRadius: 10, background: "rgba(var(--brand-rgb),0.08)", color: "#3a3a9a", fontSize: 13, margin: "10px 0 6px" },
  paneTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c", margin: "14px 0 8px" },
  empty: { marginTop: 16, padding: "22px 16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", textAlign: "center", color: "#8a909c" },
  callItem: { padding: "9px 0", borderBottom: "1px solid #f1f2f5" },
  callHead: { fontSize: 13, fontWeight: 600 },
  transcript: { marginTop: 4, fontSize: 13, color: "#3c414b" },
  transcribing: { marginTop: 4, fontSize: 13, color: "#8a909c", fontStyle: "italic" },
  review: { color: "#9a6210", fontSize: 11 },
  bubbleMeta: { marginTop: 3, fontSize: 11, color: "#8a909c" },
  footer: { marginTop: 18, color: "#8a909c", fontSize: 12, lineHeight: 1.5 },
  actionsRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "8px 0 4px" },
  inlineForm: { display: "flex", gap: 6, alignItems: "center" },
  select: { padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13, background: "#fff" },
  btnPrimary: { padding: "9px 13px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnGhost: { padding: "9px 12px", borderRadius: 9, border: "1px solid #d8dce3", background: "#fff", color: "#1e2026", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  bookRow: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "2px 0 4px" },
  bookLabel: { fontSize: 13, fontWeight: 600, color: "#3c414b" },
  bookInput: { flex: 1, minWidth: 150, padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  bookSelect: { padding: "8px 8px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13, background: "#fff" },
  compose: { display: "flex", gap: 8, marginTop: 16 },
  textInput: { flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14 }
};

function bubbleWrap(out: boolean): CSSProperties {
  return { display: "flex", justifyContent: out ? "flex-end" : "flex-start", margin: "7px 0" };
}

function bubble(out: boolean): CSSProperties {
  return { maxWidth: "82%", padding: "9px 12px", borderRadius: 12, background: out ? "rgba(var(--brand-rgb),0.1)" : "#f1f2f5", fontSize: 13 };
}
