import Link from "next/link";
import type { CSSProperties } from "react";

import { hasConfiguredExtractionProvider } from "@/server/intake/runtime";
import { getAppConfig } from "@/server/config";
import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings, quotePriceLabel } from "@/server/business/settings";
import { buildProfileDetail, type ProfileCallTimelineItem } from "@/server/profiles/detail";
import { ReplyComposer } from "@/app/owner/ReplyComposer";
import { ContactButtons } from "@/app/owner/ContactButtons";
import { LeadActionBar } from "@/app/owner/LeadActionBar";
import { MarkLeadRead } from "@/app/owner/MarkLeadRead";
import { fmtPhone, readExtracted, type Extracted } from "@/app/owner/format";
import { parseInboundConfirmation } from "@/app/owner/inboundParser";

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
      <main style={S.shell}>
        <Link href="/owner" style={S.back}>← Callbacks</Link>
        <div style={S.empty}>Lead not found. It may have been reset.</div>
      </main>
    );
  }

  const { profile, open_task, customer_replied, timeline } = detail;

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
          {fmtPhone(profile.phone_e164)}
          {profile.last_contact_at ? ` · last heard ${fmtTime(profile.last_contact_at, tz)}` : ""}
        </div>
      </header>

      {profile.phone_e164 && <ContactButtons phone={profile.phone_e164} profileId={profile.id} />}

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

      {textingLive ? (
        <div style={S.textOk}>✓ Texting on — replies send from your business number.</div>
      ) : (
        <div style={S.textWarn}>
          ⚠ Texting is off — replies are saved here but not sent yet. Still needed: {textingMissing.join(", ")} (set in Vercel), plus Twilio number verification.
        </div>
      )}

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
          transcript={heroCall?.call.transcript ?? ""}
          aiEnabled={aiEnabled}
          aiSettings={settings.ai_reply}
          slotConflict={inboundConfirmation?.isConflict ?? false}
          confirmedSlot={inboundConfirmation && !inboundConfirmation.isConflict ? inboundConfirmation.label : null}
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
  paneTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#8a909c", margin: "14px 0 8px" },
  empty: { marginTop: 16, padding: "22px 16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", textAlign: "center", color: "#8a909c" },
  transcribing: { marginTop: 4, fontSize: 13, color: "#8a909c", fontStyle: "italic" },
  review: { color: "#9a6210", fontSize: 11 },
  vmBubble: { maxWidth: "88%", padding: "9px 12px", borderRadius: 12, background: "#f4f5f8", borderLeft: "3px solid var(--brand)", fontSize: 13, boxSizing: "border-box" },
  vmHead: { fontSize: 12, fontWeight: 700, color: "#3c414b", marginBottom: 3 },
  vmBody: { color: "#1e2026", lineHeight: 1.4 },
  textOk: { marginTop: 14, marginBottom: 2, fontSize: 11.5, fontWeight: 600, color: "#1d6b4f" },
  textWarn: { marginTop: 14, padding: "9px 12px", borderRadius: 10, background: "rgba(199,125,20,0.12)", color: "#8a5a0c", fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  bubbleMeta: { marginTop: 3, fontSize: 11, color: "#8a909c" },
  footer: { marginTop: 18, color: "#8a909c", fontSize: 12, lineHeight: 1.5 }
};

function bubbleWrap(out: boolean): CSSProperties {
  return { display: "flex", justifyContent: out ? "flex-end" : "flex-start", margin: "7px 0" };
}

function bubble(out: boolean): CSSProperties {
  return { maxWidth: "82%", padding: "9px 12px", borderRadius: 12, background: out ? "rgba(var(--brand-rgb),0.1)" : "#f1f2f5", fontSize: 13 };
}
