import Link from "next/link";
import type { CSSProperties } from "react";
import { CalendarCheck2, CircleCheckBig, PhoneMissed, TrendingUp, Voicemail } from "lucide-react";

import { CountUp } from "@/app/owner/CountUp";
import { getWeatherByZip } from "@/app/owner/weather";
import { WeatherBlurb } from "@/app/owner/WeatherBlurb";

import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings, isPrivateNumber } from "@/server/business/settings";
import { buildCallbackProfileList } from "@/server/profiles/callbacks";
import { LeadList, type LeadListItem } from "@/app/owner/LeadList";
import { OnboardingChecklist, type OnboardingStep } from "@/app/owner/OnboardingChecklist";
import { buildLeadRundown, callMetaLabels } from "@/app/owner/leadRundown";
import { fmtPhone } from "@/app/owner/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Today — the overview/home screen: greeting, metric cards, needs-attention.
// Server component; metrics derived from the sandbox runtime + read-API builder.
// Greeting, date, and "calls today" are computed in the business timezone so
// they're correct regardless of where the server runs (Vercel = UTC).
// ---------------------------------------------------------------------------

const FALLBACK_TZ = "America/New_York";

function greeting(tz: string): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(new Date())) % 24;
  return h < 12 ? "Good morning." : h < 18 ? "Good afternoon." : "Good evening.";
}

// Owner has reached out (vs a brand-new, untouched lead) → show the "Responded" pill.
const RESPONDED_STATUSES = new Set(["contacted", "booked", "won"]);

function outcomeSnippet(c: { last_call_outcome: string; voicemail_snippet: string | null }): string {
  if (c.last_call_outcome === "voicemail" && c.voicemail_snippet) return `“${c.voicemail_snippet}…”`;
  if (c.last_call_outcome === "missed") return "Missed · no voicemail";
  if (c.last_call_outcome === "answered") return "You answered";
  return "Voicemail";
}

export default async function Today() {
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
  const tz = business?.timezone || FALLBACK_TZ;
  const settingsForPrivacy = getBusinessSettings(business);
  const callbacks = (business
    ? buildCallbackProfileList({ businessId: business.id, profiles, calls, messages, tasks })
    : []
  ).filter((c) => !isPrivateNumber(settingsForPrivacy, c.phone_e164)); // personal contacts stay out of the pipeline

  // Compare calendar days in the business timezone (en-CA → YYYY-MM-DD).
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const todayKey = dayKey(new Date());
  const callsToday = calls.filter((c) => c.started_at && dayKey(new Date(c.started_at)) === todayKey).length;

  // "This week" performance — a rolling 7-day window.
  const weekAgoMs = Date.now() - 7 * 24 * 3600 * 1000;
  const inWeek = (iso: string | null | undefined) => Boolean(iso) && new Date(iso as string).getTime() >= weekAgoMs;
  const bizAppts = appointments.filter((a) => !business || a.business_id === business.id);
  const bookedToday = bizAppts.filter(
    (a) => dayKey(new Date(a.scheduled_start_at)) === todayKey && a.status !== "cancelled" && a.status !== "no_show"
  ).length;
  const voicemailsToday = calls.filter(
    (c) => c.started_at && dayKey(new Date(c.started_at)) === todayKey && (c.transcript || c.call_type === "voicemail")
  ).length;
  const weekly = [
    { label: "New leads", value: profiles.filter((p) => (!business || p.business_id === business.id) && inWeek(p.last_contact_at)).length },
    { label: "Calls", value: calls.filter((c) => inWeek(c.started_at)).length },
    { label: "Jobs booked", value: bizAppts.filter((a) => inWeek(a.scheduled_start_at) && a.status !== "cancelled" && a.status !== "no_show").length },
    { label: "Completed", value: bizAppts.filter((a) => a.status === "completed" && inWeek(a.scheduled_start_at)).length }
  ];

  // Top row = a "right now / today" snapshot, distinct from the weekly rollup below.
  // (Dropped the redundant all-time "Voicemails" ≈ Callbacks, and the confusing
  // "Replied — waiting on you" 0 — replies now surface as a badge in Needs Attention.)
  const metrics = [
    { label: "Callbacks waiting", value: callbacks.length, tint: "rgba(var(--brand-rgb),0.13)", iconColor: "var(--brand)", Icon: PhoneMissed, href: "/owner/leads" },
    { label: "Booked today", value: bookedToday, tint: "rgba(var(--positive-rgb),0.14)", iconColor: "var(--positive)", Icon: CalendarCheck2, href: "/owner/calendar" },
    { label: "Calls today", value: callsToday, tint: "rgba(58,123,208,0.14)", iconColor: "#3a7bd0", Icon: TrendingUp, href: "/owner/leads" },
    { label: "Voicemails today", value: voicemailsToday, tint: "rgba(199,125,20,0.14)", iconColor: "#b06f12", Icon: Voicemail, href: "/owner/leads" }
  ];

  const settings = getBusinessSettings(business);
  // Needs Attention = only what still needs YOU: brand-new leads you haven't
  // responded to, or existing customers who've replied back. Once you've
  // responded (and they haven't written back) it drops off here — it still
  // lives on the Leads page. Replies-waiting float to the top.
  const attentionCallbacks = callbacks
    .filter((c) => c.customer_replied || !RESPONDED_STATUSES.has(c.status))
    .sort((a, b) => Number(b.customer_replied) - Number(a.customer_replied));
  const attentionItems: LeadListItem[] = attentionCallbacks.map((c) => {
    const m = callMetaLabels(c.id, calls, tz);
    return {
      id: c.id,
      name: c.display_name || fmtPhone(c.phone_e164),
      snippet: outcomeSnippet(c),
      customerReplied: c.customer_replied,
      responded: RESPONDED_STATUSES.has(c.status),
      lastActivity: c.last_contact_at,
      rundown: buildLeadRundown(c.id, calls, settings.quote_ranges),
      callTimeLabel: m.timeLabel,
      voicemailLabel: m.vmLabel,
      status: c.status
    };
  });

  // Interactive setup checklist — each step ticks itself off from real data.
  const onboardingSteps: OnboardingStep[] = [
    {
      key: "number",
      title: "Connect your phone",
      desc: "Keep your own number — save your cell and dial one forwarding code. Missed calls flow straight into Snagly.",
      note: "Prefer a separate business line? That option's right underneath in Settings.",
      done: Boolean(business?.business_phone_e164 || business?.twilio_number_e164),
      href: "/owner/settings",
      cta: "Set up →"
    },
    {
      key: "services",
      title: "Add your services, prices & hours",
      desc: "So quotes auto-fill and the booking tool offers the right times.",
      done: settings.quote_ranges.length > 0,
      href: "/owner/settings",
      cta: "Add →"
    },
    {
      key: "lead",
      title: "Get your first lead",
      desc: "Test it: call your Snagly number from another phone, let it ring out, and watch the lead show up right here.",
      done: profiles.length > 0 || calls.length > 0,
      href: "/owner/settings",
      cta: "Find # →"
    }
  ];

  const forecast = await getWeatherByZip(settings.weather);

  return (
    <main className="owner-page">
      <div style={S.greeting}>{greeting(tz)}</div>
      <div style={S.date}>
        {new Date().toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "long", day: "numeric" })}
      </div>
      <WeatherBlurb forecast={forecast} tz={tz} />

      <OnboardingChecklist steps={onboardingSteps} />

      <div style={S.metricRow}>
        {metrics.map((m) => (
          <Link key={m.label} href={m.href} className="card card-tap" style={S.metricCard}>
            <div style={metricChip(m.tint, m.iconColor)}><m.Icon size={16} strokeWidth={2.2} aria-hidden /></div>
            <div style={S.metricValue}><CountUp value={m.value} /></div>
            <div style={S.metricLabel}>{m.label}</div>
          </Link>
        ))}
      </div>

      <div style={S.sectionLabel}>THIS WEEK</div>
      <div style={S.weekRow}>
        {weekly.map((w) => (
          <div key={w.label} className="card" style={S.weekCard}>
            <div style={S.weekValue}>{w.value}</div>
            <div style={S.weekLabel}>{w.label}</div>
          </div>
        ))}
      </div>

      <div style={S.sectionLabel}>NEEDS ATTENTION</div>
      {attentionItems.length === 0 ? (
        <div style={S.empty}>
          <CircleCheckBig size={26} strokeWidth={1.8} style={{ color: "var(--positive)" }} aria-hidden />
          <div>
            <div style={S.emptyTitle}>You&apos;re all caught up</div>
            <div style={S.emptyText}>Nothing needs a reply right now — new leads and replies show up here automatically.</div>
          </div>
        </div>
      ) : (
        <div>
          <div className="scroll-soft" style={S.attentionScroll}>
            <LeadList items={attentionItems} />
          </div>
          <Link href="/owner/leads" style={S.viewAll}>View all {callbacks.length} leads →</Link>
        </div>
      )}
    </main>
  );
}

const S = {
  greeting: { fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.6px" } as CSSProperties,
  date: { color: "var(--muted)", fontSize: 13, marginTop: 3, fontWeight: 500 } as CSSProperties,
  metricRow: { display: "flex", gap: 14, flexWrap: "wrap", marginTop: 22 } as CSSProperties,
  metricCard: { flex: "1 1 170px", minWidth: 160, padding: "18px 17px 16px", position: "relative" } as CSSProperties,
  metricValue: { fontSize: 32, fontWeight: 800, color: "var(--ink)", lineHeight: 1.05, letterSpacing: "-0.5px" } as CSSProperties,
  metricLabel: { fontSize: 12, color: "var(--muted)", marginTop: 5, fontWeight: 600 } as CSSProperties,
  sectionLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: "var(--muted)", margin: "30px 0 11px", textTransform: "uppercase" } as CSSProperties,
  empty: { display: "flex", alignItems: "center", gap: 14, padding: "24px 20px", borderRadius: "var(--radius-lg)", background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" } as CSSProperties,
  emptyTitle: { fontSize: 14.5, fontWeight: 700, color: "var(--ink)" } as CSSProperties,
  emptyText: { fontSize: 13, color: "var(--muted)", lineHeight: 1.5, marginTop: 2 } as CSSProperties,
  attentionScroll: { maxHeight: 540, overflowY: "auto", padding: "2px 8px 2px 2px" } as CSSProperties,
  weekRow: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 } as CSSProperties,
  weekCard: { flex: "1 1 120px", minWidth: 110, padding: "14px 15px" } as CSSProperties,
  weekValue: { fontSize: 23, fontWeight: 800, color: "var(--ink)", lineHeight: 1.05, letterSpacing: "-0.4px" } as CSSProperties,
  weekLabel: { fontSize: 12, color: "var(--muted)", marginTop: 3, fontWeight: 500 } as CSSProperties,
  viewAll: { display: "inline-block", marginTop: 12, color: "var(--brand)", fontWeight: 700, fontSize: 13, textDecoration: "none" } as CSSProperties
};

function metricChip(tint: string, color: string): CSSProperties {
  return { position: "absolute", top: 15, right: 15, width: 32, height: 32, borderRadius: 10, background: tint, color, display: "flex", alignItems: "center", justifyContent: "center" };
}
