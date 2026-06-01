import Link from "next/link";
import type { CSSProperties } from "react";

import { getIntakeRuntime, hasConfiguredExtractionProvider } from "@/server/intake/runtime";
import { getAppConfig } from "@/server/config";
import { getBusinessSettings, type QuoteRangeSettings } from "@/server/business/settings";
import { buildProfileDetail } from "@/server/profiles/detail";
import { createAppointment, markCallbackDone, setProfileStatus } from "@/app/owner/actions";
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

function deliveryText(status: string): string {
  if (status === "sent") return "sent";
  if (status === "failed") return "failed to send";
  if (status === "queued") return "not sent yet";
  if (status === "received") return "received";
  return status;
}

// Label an outbound message: the missed-call auto-text vs. one the owner sent.
function messageLabel(m: { direction: string; status: string; provider_message_id?: string | null }): string {
  if (m.direction === "inbound") return "Customer";
  const isAuto = (m.provider_message_id ?? "").startsWith("missed-call-auto-text");
  return `${isAuto ? "Auto-reply" : "You"} · ${deliveryText(m.status)}`;
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

  const { profile, open_task, customer_replied } = detail;

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

  // Latest voicemail with a transcript — feeds the AI composer + booking notes.
  const heroCall =
    profileCalls.find((c) => c.transcript) ??
    profileCalls.find((c) => c.call_type === "voicemail" || c.recording_url) ??
    null;

  // One unified conversation: every voicemail + every text for this lead, oldest → newest.
  type ConvoItem =
    | { kind: "call"; at: string; call: (typeof calls)[number] }
    | { kind: "msg"; at: string; msg: (typeof messages)[number] };
  const convo: ConvoItem[] = [
    ...profileCalls.map((c) => ({ kind: "call" as const, at: c.started_at ?? c.created_at ?? "", call: c })),
    ...messages
      .filter((m) => (!business || m.business_id === business.id) && m.customer_profile_id === profile.id)
      .map((m) => ({ kind: "msg" as const, at: m.created_at ?? "", msg: m }))
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  // Context the reply composer uses to pre-pick services + detect a price question.
  const contextText = [aiX.service_requested, aiSummaryText, aiTranscript].filter(Boolean).join(" ");
  const pricingInquiry = /\b(price|pricing|cost|how much|quote|charge|rate|rates)\b/i.test(contextText);
  const cfg = getAppConfig();
  const aiEnabled = hasConfiguredExtractionProvider(cfg);
  const textingLive = cfg.smsSendingEnabled && cfg.realMessageSendingEnabled && cfg.twilioConfigured;
  const textingMissing = [
    cfg.twilioConfigured ? null : "Twilio keys",
    cfg.realMessageSendingEnabled ? null : "REAL_MESSAGE_SENDING_ENABLED",
    cfg.smsSendingEnabled ? null : "SMS_SENDING_ENABLED"
  ].filter((x): x is string => Boolean(x));
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

      <div style={S.paneTitle}>CONVERSATION</div>
      {convo.length === 0 ? (
        <div style={S.empty}>No messages yet.</div>
      ) : (
        <div style={{ marginTop: 2 }}>
          {convo.map((item) =>
            item.kind === "call" ? (
              <div key={item.call.id} style={bubbleWrap(false)}>
                <div style={S.vmBubble}>
                  <div style={S.vmHead}>
                    🎙️ {callLabel(item.call.call_type, Boolean(item.call.transcript), Boolean(item.call.recording_url))} ·{" "}
                    {fmtTime(item.at, tz)}{item.call.duration_seconds ? ` · ${item.call.duration_seconds}s` : ""}
                  </div>
                  {item.call.transcript ? (
                    <div style={S.vmBody}>
                      “{item.call.transcript}”
                      {item.call.needs_review && <span style={S.review}> · auto-transcribed</span>}
                    </div>
                  ) : item.call.call_type === "voicemail" || item.call.recording_url ? (
                    <div style={S.transcribing}>⏳ Transcribing voicemail…</div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key={item.msg.id} style={bubbleWrap(item.msg.direction === "outbound")}>
                <div style={bubble(item.msg.direction === "outbound")}>
                  <div>{item.msg.body}</div>
                  <div style={S.bubbleMeta}>{messageLabel(item.msg)} · {fmtTime(item.at, tz)}</div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <div style={textingLive ? S.textOk : S.textWarn}>
        {textingLive
          ? "✓ Texting is live — replies send from your business number."
          : `⚠ Texting is off — replies are saved here but not sent yet. Still needed: ${textingMissing.join(", ")} (set in Vercel), plus Twilio number verification.`}
      </div>

      {profile.phone_e164 && (
        <ReplyComposer
          customerName={profile.display_name || ""}
          businessName={business?.name || "us"}
          profileId={profile.id}
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

      <footer style={S.footer}>
        Texts send from your business number. You can also tap <strong>Call back</strong> or{" "}
        <strong>Text</strong> above to use your phone directly.
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
  vmBubble: { maxWidth: "88%", padding: "9px 12px", borderRadius: 12, background: "#f4f5f8", borderLeft: "3px solid var(--brand)", fontSize: 13, boxSizing: "border-box" },
  vmHead: { fontSize: 12, fontWeight: 700, color: "#3c414b", marginBottom: 3 },
  vmBody: { color: "#1e2026", lineHeight: 1.4 },
  textOk: { marginTop: 14, padding: "8px 12px", borderRadius: 10, background: "rgba(var(--positive-rgb),0.12)", color: "#1d6b4f", fontSize: 12, fontWeight: 600 },
  textWarn: { marginTop: 14, padding: "9px 12px", borderRadius: 10, background: "rgba(199,125,20,0.12)", color: "#8a5a0c", fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
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
