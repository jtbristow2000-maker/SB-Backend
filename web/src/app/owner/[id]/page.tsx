import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft, Hourglass, Voicemail } from "lucide-react";

import { hasConfiguredExtractionProvider } from "@/server/intake/runtime";
import { getAppConfig } from "@/server/config";
import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings, quotePriceLabel } from "@/server/business/settings";
import { buildProfileDetail, type ProfileCallTimelineItem } from "@/server/profiles/detail";
import { ReplyComposer } from "@/app/owner/ReplyComposer";
import { ContactButtons } from "@/app/owner/ContactButtons";
import { LeadActionBar } from "@/app/owner/LeadActionBar";
import { LeadContactCard, type PastJob } from "@/app/owner/LeadContactCard";
import { MarkLeadRead } from "@/app/owner/MarkLeadRead";
import { fmtPhone, readExtracted, type Extracted } from "@/app/owner/format";
import { parseInboundConfirmation } from "@/app/owner/inboundParser";
import { detectVehicle, detectPreferredContact } from "@/app/owner/leadRundown";
import { getWeatherByZip } from "@/app/owner/weather";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Owner screen — Lead detail. The voicemail transcript is the centerpiece up top,
// then the interactive reply composer, one-tap Call/Text, status + booking, and
// any earlier activity (older calls + texts). Times render in the business timezone.
// ---------------------------------------------------------------------------

const FALLBACK_TZ = "America/New_York";

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
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const [profiles, calls, messages, tasks, appointments] = rt ? await Promise.all([
    rt.customerProfileRepository.list(),
    rt.callRecordRepository.list(),
    rt.messageRepository.list(),
    rt.taskRepository.list(),
    rt.appointmentRepository.list()
  ]) : [[], [], [], [], []];
  const settings = getBusinessSettings(business);
  const tz = business?.timezone || FALLBACK_TZ;
  const detail = business
    ? buildProfileDetail({ businessId: business.id, profileId: id, profiles, calls, messages, tasks })
    : null;

  if (!detail) {
    return (
      <main className="owner-page" style={S.shell}>
        <Link href="/owner/leads" style={S.back}><ArrowLeft size={14} className="ico-inline" aria-hidden /> Leads</Link>
        <div style={S.empty}>Lead not found. It may have been reset.</div>
      </main>
    );
  }

  const { profile, open_task, customer_replied, timeline, first_time_customer } = detail;

  // Calls come from the shared buildProfileDetail timeline (the same projection
  // /api/profiles/{id} returns) so the screen and the read API can't drift. The
  // timeline is newest-first, which is what the AI/hero lookups want.
  const detailCalls = timeline.filter(
    (item): item is ProfileCallTimelineItem => item.kind === "call"
  );
  let aiX: Extracted = {};
  let aiSummaryText: string | null = null;
  let aiTranscript: string | null = null;
  for (const { call } of detailCalls) {
    const e = readExtracted(call.extracted_json);
    if (call.ai_summary || e.caller_name || e.requested_datetime || e.service_requested || e.summary) {
      aiX = e;
      aiSummaryText = call.ai_summary || e.summary || null;
      aiTranscript = call.transcript ?? null;
      break;
    }
  }

  // Open-slot conflict detection needs EVERY appointment for the business, not just this
  // lead's — so this stays on the full list (not detail.appointments, which is lead-scoped).
  const busy = appointments
    .filter((a) => !business || a.business_id === business.id)
    .map((a) => ({ start: a.scheduled_start_at, end: a.scheduled_end_at }));

  // This lead's finished/past appointments — a quick job history on the contact.
  const nowMs = Date.now();
  const pastJobs = appointments
    .filter(
      (a) =>
        (!business || a.business_id === business.id) &&
        a.customer_profile_id === profile.id &&
        (a.status === "completed" || new Date(a.scheduled_start_at).getTime() < nowMs)
    )
    .sort((a, b) => (a.scheduled_start_at < b.scheduled_start_at ? 1 : -1));

  // Latest voicemail with a transcript — feeds the AI composer + booking notes.
  const heroCall =
    detailCalls.find((c) => c.call.transcript) ??
    detailCalls.find((c) => c.call.call_type === "voicemail" || c.call.recording_url) ??
    null;

  // One unified conversation: every voicemail + every text for this lead, oldest → newest.
  // Calls come from the shared timeline; messages stay on the raw rows for now because the
  // timeline message item doesn't carry provider_message_id, which messageLabel needs to tell
  // the auto-reply from an owner-sent text (see TASKS.md).
  type ConvoItem =
    | { kind: "call"; at: string; call: ProfileCallTimelineItem["call"] }
    | { kind: "msg"; at: string; msg: (typeof messages)[number] };
  const convo: ConvoItem[] = [
    ...detailCalls.map((c) => ({ kind: "call" as const, at: c.at ?? "", call: c.call })),
    ...messages
      .filter((m) => (!business || m.business_id === business.id) && m.customer_profile_id === profile.id)
      .map((m) => ({ kind: "msg" as const, at: m.created_at ?? "", msg: m }))
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  // Context the reply composer uses to pre-pick services + detect a price question.
  const contextText = [aiX.service_requested, aiSummaryText, aiTranscript].filter(Boolean).join(" ");
  const pricingInquiry = /\b(price|pricing|cost|how much|quote|charge|rate|rates)\b/i.test(contextText);
  // Check if the latest inbound customer message confirms a date/time.
  // If it does, we pre-fill the booking form and adjust the reply draft.
  const latestInbound = convo
    .filter((item) => item.kind === "msg" && item.msg.direction === "inbound")
    .at(-1);
  const latestInboundText = latestInbound?.kind === "msg" ? latestInbound.msg.body ?? "" : "";
  const inboundConfirmation = latestInboundText
    ? parseInboundConfirmation(latestInboundText, busy)
    : null;

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
  const bookingPrice = quotePriceLabel(aiX.service_requested ?? null, settings.quote_ranges);
  const bookingSummary = aiSummaryText ?? (aiTranscript ? aiTranscript.slice(0, 200) : "");
  const bookingNotes = [bookingPrice ? `Quote: ${bookingPrice}` : null, bookingSummary || null]
    .filter(Boolean)
    .join("\n");

  // Auto-fill the Customer-details panel from the voicemail + this lead's full history
  // (every transcript/summary + every inbound text). These are editable suggestions —
  // the field shows the detected value until the owner reviews and Saves it. We only
  // pre-fill the high-confidence signals (the vehicle, an explicit contact preference);
  // address / referral are almost never spoken on a voicemail, so they stay blank.
  const historyText = [
    ...detailCalls.map((c) => `${c.call.transcript ?? ""} ${c.call.ai_summary ?? ""}`),
    ...messages
      .filter(
        (m) =>
          (!business || m.business_id === business.id) &&
          m.customer_profile_id === profile.id &&
          m.direction === "inbound"
      )
      .map((m) => m.body ?? "")
  ].join(" ");
  const detectedVehicle = detectVehicle(historyText);
  const detectedContact = detectPreferredContact(historyText);
  const vehiclesValue = profile.vehicles || detectedVehicle || "";
  const contactValue = profile.preferred_contact || detectedContact || "";
  const autoFilled = Boolean(
    (!profile.vehicles && detectedVehicle) || (!profile.preferred_contact && detectedContact)
  );

  // The AI-read essentials — shown inside the contact card (tap the name).
  // Vehicle is skipped here: it's already an editable field on the card.
  type JobFact = { label: string; value: string };
  const jobFacts: JobFact[] = [
    aiX.service_requested ? { label: "Service", value: aiX.service_requested } : null,
    aiX.requested_datetime ? { label: "Asked for", value: aiX.requested_datetime } : null,
    bookingPrice ? { label: "Ballpark", value: bookingPrice } : null
  ].filter((f): f is JobFact => f !== null);

  // Job history for the contact card.
  const pastJobsForCard: PastJob[] = pastJobs.map((a) => ({
    id: a.id,
    title: a.service_requested || a.title || "Appointment",
    when: fmtTime(a.scheduled_start_at, tz),
    done: a.status === "completed"
  }));

  const leadName = profile.display_name || fmtPhone(profile.phone_e164);

  // Live forecast (owner's zip) so offered time slots steer around bad-weather days.
  const forecast = await getWeatherByZip(settings.weather);

  return (
    <main className="owner-page" style={S.shell}>
      <MarkLeadRead id={profile.id} activity={profile.last_contact_at} />
      <Link href="/owner/leads" style={S.back}><ArrowLeft size={14} className="ico-inline" aria-hidden /> Leads</Link>

      {/* Contact header — tap the name for details + history, call/text on the right. */}
      <div style={S.headRow}>
        <LeadContactCard
          profileId={profile.id}
          name={leadName}
          phoneLabel={fmtPhone(profile.phone_e164)}
          lastHeard={profile.last_contact_at ? `last heard ${fmtTime(profile.last_contact_at, tz)}` : null}
          replied={customer_replied}
          firstTime={first_time_customer}
          vehiclesValue={vehiclesValue}
          poBox={profile.po_box ?? ""}
          contactValue={contactValue}
          referral={profile.referral_source ?? ""}
          autoFilled={autoFilled}
          facts={jobFacts}
          pastJobs={pastJobsForCard}
        />
        {profile.phone_e164 && <ContactButtons phone={profile.phone_e164} profileId={profile.id} />}
      </div>

      <LeadActionBar
        profileId={profile.id}
        status={profile.status}
        openTaskId={open_task?.id ?? null}
        bookTitle={`${profile.display_name || fmtPhone(profile.phone_e164)}${aiX.service_requested ? ` — ${aiX.service_requested}` : ""}`}
        bookService={aiX.service_requested ?? ""}
        bookNotes={bookingNotes}
        prefilledStart={inboundConfirmation && !inboundConfirmation.isConflict ? inboundConfirmation.datetimeLocal : undefined}
        confirmedLabel={inboundConfirmation && !inboundConfirmation.isConflict ? inboundConfirmation.label : undefined}
      />

      {/* The conversation IS the page — bubbles straight on the background. */}
      <div style={S.convo}>
        {convo.length === 0 ? (
          <div style={S.convoEmpty}>No calls or texts yet — when they reach out, it shows up here.</div>
        ) : (
          convo.map((item) =>
            item.kind === "call" ? (
              <div key={item.call.id} style={bubbleWrap(false)}>
                <div style={S.vmBubble}>
                  <div style={S.vmHead}>
                    <Voicemail size={13} className="ico-inline" aria-hidden /> {callLabel(item.call.call_type, Boolean(item.call.transcript), Boolean(item.call.recording_url))} ·{" "}
                    {fmtTime(item.at, tz)}{item.call.duration_seconds ? ` · ${item.call.duration_seconds}s` : ""}
                  </div>
                  {item.call.transcript ? (
                    <div style={S.vmBody}>
                      “{item.call.transcript}”
                      {item.call.needs_review && <span style={S.review}> · auto-transcribed</span>}
                    </div>
                  ) : item.call.call_type === "voicemail" || item.call.recording_url ? (
                    <div style={S.transcribing}><Hourglass size={12} className="ico-inline" aria-hidden /> Transcribing voicemail…</div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div key={item.msg.id} style={bubbleWrap(item.msg.direction === "outbound")}>
                <div style={bubble(item.msg.direction === "outbound")}>
                  <div>{item.msg.body}</div>
                  <div style={bubbleMeta(item.msg.direction === "outbound")}>{messageLabel(item.msg)} · {fmtTime(item.at, tz)}</div>
                </div>
              </div>
            )
          )
        )}
      </div>

      {profile.phone_e164 && (
        <ReplyComposer
          customerName={profile.display_name || ""}
          businessName={business?.name || "us"}
          profileId={profile.id}
          quoteRanges={settings.quote_ranges}
          businessHours={settings.business_hours}
          travelBufferMinutes={settings.travel_buffer_minutes}
          busy={busy}
          requestedWhen={aiX.requested_datetime ?? ""}
          contextText={contextText}
          pricingInquiry={pricingInquiry}
          transcript={heroCall?.call.transcript ?? ""}
          aiEnabled={aiEnabled}
          aiSettings={settings.ai_reply}
          slotConflict={inboundConfirmation?.isConflict ?? false}
          confirmedSlot={inboundConfirmation && !inboundConfirmation.isConflict ? inboundConfirmation.label : null}
          textingLive={textingLive}
          textingMissing={textingMissing}
          weather={forecast.days}
        />
      )}
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  shell: { maxWidth: 860 },
  back: { color: "var(--brand)", fontWeight: 600, fontSize: 13, textDecoration: "none" },
  empty: { marginTop: 16, padding: "22px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", textAlign: "center", color: "var(--muted)" },

  headRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 14 },

  convo: { marginTop: 16 },
  convoEmpty: { padding: "26px 12px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 },
  transcribing: { marginTop: 4, fontSize: 13, color: "var(--muted)", fontStyle: "italic" },
  review: { color: "#9a6210", fontSize: 11 },
  vmBubble: {
    maxWidth: "85%", padding: "11px 14px", borderRadius: "18px 18px 18px 5px",
    background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)",
    fontSize: 14, boxSizing: "border-box"
  },
  vmHead: { fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 },
  vmBody: { color: "var(--ink)", lineHeight: 1.5 }
};

function bubbleWrap(out: boolean): CSSProperties {
  return { display: "flex", justifyContent: out ? "flex-end" : "flex-start", margin: "8px 0" };
}

// iMessage-style bubbles: theirs = white with a tail, yours = solid brand.
function bubble(out: boolean): CSSProperties {
  return out
    ? { maxWidth: "80%", padding: "10px 14px", borderRadius: "18px 18px 5px 18px", background: "var(--brand)", color: "#fff", fontSize: 14, lineHeight: 1.5, boxShadow: "0 1px 4px rgba(var(--brand-rgb),0.3)" }
    : { maxWidth: "80%", padding: "10px 14px", borderRadius: "18px 18px 18px 5px", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-xs)", color: "var(--ink)", fontSize: 14, lineHeight: 1.5 };
}

function bubbleMeta(out: boolean): CSSProperties {
  return { marginTop: 4, fontSize: 10.5, color: out ? "rgba(255,255,255,0.75)" : "var(--faint)" };
}
