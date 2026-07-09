import type { CSSProperties } from "react";
import {
  CalendarCheck2,
  Flame,
  PhoneCall,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users
} from "lucide-react";

import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings } from "@/server/business/settings";
import { CountUp } from "@/app/owner/CountUp";
import { GoalsEditor } from "@/app/owner/GoalsEditor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Stats — the scoreboard. Weekly numbers with deltas, a win-rate ring, weekly
// goals with progress bars, an 8-week trend chart, a 14-day activity strip, and
// personal records. Everything is computed from the live tables in the business
// timezone; goals persist in settings_json (no migration).
// ---------------------------------------------------------------------------

const FALLBACK_TZ = "America/New_York";
const DAY_MS = 86_400_000;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Calendar day (YYYY-MM-DD) in the business timezone.
function dayKey(d: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Monday-start week key (the Monday's YYYY-MM-DD) in the business timezone.
function weekKey(d: Date, tz: string): string {
  const day = dayKey(d, tz);
  const [y, m, dd] = day.split("-").map(Number);
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d);
  const idx = Math.max(0, WEEKDAYS.indexOf(wd));
  return new Date(Date.UTC(y, m - 1, dd) - idx * DAY_MS).toISOString().slice(0, 10);
}

function weekLabel(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function count(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export default async function StatsPage() {
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const [profiles, calls, appointments] = rt
    ? await Promise.all([
        rt.customerProfileRepository.list(),
        rt.callRecordRepository.list(),
        rt.appointmentRepository.list()
      ])
    : [[], [], []];
  const tz = business?.timezone || FALLBACK_TZ;
  const settings = getBusinessSettings(business);
  const goals = settings.goals;

  const bizProfiles = profiles.filter((p) => !business || p.business_id === business.id);
  const bizCalls = calls.filter((c) => !business || c.business_id === business.id);
  const bizAppts = appointments.filter(
    (a) => (!business || a.business_id === business.id) && a.status !== "cancelled" && a.status !== "no_show"
  );

  // ------- bucket everything by day + week (business timezone) -------
  const callsByDay = new Map<string, number>();
  const callsByWeek = new Map<string, number>();
  for (const c of bizCalls) {
    if (!c.started_at) continue;
    const d = new Date(c.started_at);
    count(callsByDay, dayKey(d, tz));
    count(callsByWeek, weekKey(d, tz));
  }
  const leadsByWeek = new Map<string, number>();
  for (const p of bizProfiles) {
    if (!p.created_at) continue;
    count(leadsByWeek, weekKey(new Date(p.created_at), tz));
  }
  const bookedByWeek = new Map<string, number>();
  for (const a of bizAppts) {
    if (!a.created_at) continue;
    count(bookedByWeek, weekKey(new Date(a.created_at), tz));
  }

  const now = new Date();
  const thisWeek = weekKey(now, tz);
  const [ty, tm, td] = thisWeek.split("-").map(Number);
  const thisWeekUtc = Date.UTC(ty, tm - 1, td);
  const weekKeyAt = (offset: number) => new Date(thisWeekUtc - offset * 7 * DAY_MS).toISOString().slice(0, 10);
  const lastWeek = weekKeyAt(1);

  // ------- this week vs last -------
  const weekly = [
    { label: "Calls", Icon: PhoneCall, now: callsByWeek.get(thisWeek) ?? 0, prev: callsByWeek.get(lastWeek) ?? 0 },
    { label: "New leads", Icon: Users, now: leadsByWeek.get(thisWeek) ?? 0, prev: leadsByWeek.get(lastWeek) ?? 0 },
    { label: "Jobs booked", Icon: CalendarCheck2, now: bookedByWeek.get(thisWeek) ?? 0, prev: bookedByWeek.get(lastWeek) ?? 0 }
  ];

  // ------- win rate -------
  const won = bizProfiles.filter((p) => p.status === "won").length;
  const lost = bizProfiles.filter((p) => p.status === "lost").length;
  const decided = won + lost;
  const winRate = decided > 0 ? won / decided : null;

  // ------- goals -------
  const goalRows = [
    { key: "weekly_calls", label: "Calls", target: goals.weekly_calls, current: callsByWeek.get(thisWeek) ?? 0 },
    { key: "weekly_leads", label: "New leads", target: goals.weekly_leads, current: leadsByWeek.get(thisWeek) ?? 0 },
    { key: "weekly_booked", label: "Jobs booked", target: goals.weekly_booked, current: bookedByWeek.get(thisWeek) ?? 0 }
  ].filter((g) => g.target > 0);
  const hasGoals = goalRows.length > 0;
  const goalsHit = goalRows.filter((g) => g.current >= g.target).length;

  // ------- 8-week trend -------
  const trendWeeks = Array.from({ length: 8 }, (_, i) => weekKeyAt(7 - i));
  const trend = trendWeeks.map((k) => ({
    key: k,
    label: weekLabel(k),
    calls: callsByWeek.get(k) ?? 0,
    booked: bookedByWeek.get(k) ?? 0
  }));
  const trendMax = Math.max(1, ...trend.map((t) => Math.max(t.calls, t.booked)));

  // ------- 14-day activity -------
  const todayKey = dayKey(now, tz);
  const [cy, cm, cd] = todayKey.split("-").map(Number);
  const todayUtc = Date.UTC(cy, cm - 1, cd);
  const days = Array.from({ length: 14 }, (_, i) => {
    const t = new Date(todayUtc - (13 - i) * DAY_MS);
    const k = t.toISOString().slice(0, 10);
    return {
      key: k,
      letter: new Date(t).toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" }),
      calls: callsByDay.get(k) ?? 0
    };
  });
  const daysMax = Math.max(1, ...days.map((d) => d.calls));

  // ------- personal records -------
  const bestDayCalls = Math.max(0, ...callsByDay.values());
  const bestWeekCalls = Math.max(0, ...callsByWeek.values());
  const bestWeekBooked = Math.max(0, ...bookedByWeek.values());
  const completedJobs = bizAppts.filter((a) => a.status === "completed").length;
  const records = [
    { label: "Best day — calls", value: bestDayCalls },
    { label: "Best week — calls", value: bestWeekCalls },
    { label: "Best week — booked", value: bestWeekBooked },
    { label: "Jobs completed", value: completedJobs }
  ];

  const ringC = 2 * Math.PI * 34;

  return (
    <main className="owner-page" style={S.page}>
      <h1 style={S.h1}>Stats</h1>
      <div style={S.sub}>Your scoreboard — this week, your goals, and the records to beat.</div>

      {/* This week + win rate */}
      <section className="card" style={S.heroCard}>
        <div style={S.heroLeft}>
          <div style={S.heroTitle}>THIS WEEK</div>
          {weekly.map((w) => {
            const diff = w.now - w.prev;
            return (
              <div key={w.label} style={S.heroRow}>
                <w.Icon size={16} style={{ color: "var(--muted)", flexShrink: 0 }} aria-hidden />
                <span style={S.heroLabel}>{w.label}</span>
                <span style={S.heroValue}><CountUp value={w.now} /></span>
                <span style={delta(diff)}>
                  {diff > 0 ? <TrendingUp size={12} aria-hidden /> : diff < 0 ? <TrendingDown size={12} aria-hidden /> : null}
                  {diff === 0 ? "— same as last week" : `${diff > 0 ? "+" : ""}${diff} vs last week`}
                </span>
              </div>
            );
          })}
        </div>
        <div style={S.ringWrap}>
          <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
            <circle cx="48" cy="48" r="34" fill="none" stroke="#edeef3" strokeWidth="9" />
            {winRate !== null && (
              <circle
                cx="48" cy="48" r="34" fill="none"
                stroke="var(--positive)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={ringC} strokeDashoffset={ringC * (1 - winRate)}
                transform="rotate(-90 48 48)"
              />
            )}
          </svg>
          <div style={S.ringCenter}>
            <div style={S.ringValue}>{winRate === null ? "—" : `${Math.round(winRate * 100)}%`}</div>
            <div style={S.ringLabel}>win rate</div>
          </div>
          <div style={S.ringSub}>{decided > 0 ? `${won} won · ${lost} lost` : "No wins or losses yet"}</div>
        </div>
      </section>

      {/* Goals */}
      <section className="card" style={S.sectionCard}>
        <div style={S.cardHead}>
          <span style={S.cardTitle}><Target size={15} style={{ color: "var(--brand)" }} aria-hidden /> Weekly goals</span>
          {hasGoals && (
            <span style={S.goalScore}>
              {goalsHit === goalRows.length ? <Trophy size={13} style={{ color: "#c77d14" }} aria-hidden /> : null}
              {goalsHit}/{goalRows.length} hit
            </span>
          )}
        </div>
        {hasGoals ? (
          <div style={S.goalList}>
            {goalRows.map((g) => {
              const pct = Math.min(1, g.current / g.target);
              const hit = g.current >= g.target;
              return (
                <div key={g.key}>
                  <div style={S.goalRow}>
                    <span style={S.goalLabel}>{g.label}</span>
                    <span style={{ ...S.goalCount, color: hit ? "var(--positive)" : "var(--ink)" }}>
                      {g.current}/{g.target}
                      {hit && <Trophy size={12} className="ico-inline" style={{ marginLeft: 5, color: "#c77d14" }} aria-hidden />}
                    </span>
                  </div>
                  <div style={S.track}>
                    <div style={{ ...S.fill, width: `${pct * 100}%`, background: hit ? "var(--positive)" : "var(--brand)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={S.goalEmpty}>Set a weekly target and watch the bars fill up as the week goes.</div>
        )}
        <GoalsEditor
          weeklyCalls={goals.weekly_calls}
          weeklyLeads={goals.weekly_leads}
          weeklyBooked={goals.weekly_booked}
          startOpen={!hasGoals}
        />
      </section>

      {/* 8-week trend */}
      <section className="card" style={S.sectionCard}>
        <div style={S.cardHead}>
          <span style={S.cardTitle}><TrendingUp size={15} style={{ color: "var(--brand)" }} aria-hidden /> Last 8 weeks</span>
          <span style={S.legend}>
            <span style={{ ...S.dot, background: "var(--brand)" }} /> Calls
            <span style={{ ...S.dot, background: "var(--positive)", marginLeft: 10 }} /> Booked
          </span>
        </div>
        <div style={S.chart}>
          {trend.map((t) => (
            <div key={t.key} style={S.chartCol} title={`${t.label}: ${t.calls} calls · ${t.booked} booked`}>
              <div style={S.barsBox}>
                <div style={{ ...S.bar, height: `${(t.calls / trendMax) * 100}%`, background: "var(--brand)", opacity: t.key === thisWeek ? 1 : 0.55 }} />
                <div style={{ ...S.bar, height: `${(t.booked / trendMax) * 100}%`, background: "var(--positive)", opacity: t.key === thisWeek ? 1 : 0.55 }} />
              </div>
              <div style={{ ...S.chartLabel, fontWeight: t.key === thisWeek ? 700 : 500, color: t.key === thisWeek ? "var(--ink)" : "var(--faint)" }}>
                {t.key === thisWeek ? "Now" : t.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 14-day activity */}
      <section className="card" style={S.sectionCard}>
        <div style={S.cardHead}>
          <span style={S.cardTitle}><Flame size={15} style={{ color: "#c77d14" }} aria-hidden /> Daily activity</span>
          <span style={S.legend}>calls per day · last 14 days</span>
        </div>
        <div style={S.daysRow}>
          {days.map((d) => (
            <div key={d.key} style={S.dayCol} title={`${d.key}: ${d.calls} call${d.calls === 1 ? "" : "s"}`}>
              <div style={S.dayBarBox}>
                <div style={{ ...S.dayBar, height: `${Math.max(d.calls > 0 ? 12 : 4, (d.calls / daysMax) * 100)}%`, background: d.calls > 0 ? "var(--brand)" : "#e5e7ee" }} />
              </div>
              <div style={S.dayLetter}>{d.letter}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Records */}
      <section className="card" style={S.sectionCard}>
        <div style={S.cardHead}>
          <span style={S.cardTitle}><Trophy size={15} style={{ color: "#c77d14" }} aria-hidden /> Records</span>
          <span style={S.legend}>your bests — beat them</span>
        </div>
        <div style={S.recordGrid}>
          {records.map((r) => (
            <div key={r.label} style={S.record}>
              <div style={S.recordValue}><CountUp value={r.value} /></div>
              <div style={S.recordLabel}>{r.label}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function delta(diff: number): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11.5,
    fontWeight: 600,
    whiteSpace: "nowrap",
    color: diff > 0 ? "var(--positive)" : diff < 0 ? "#b23b3b" : "var(--faint)"
  };
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 920 },
  h1: { margin: "4px 0 2px", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" },
  sub: { color: "var(--muted)", fontSize: 13 },

  heroCard: { marginTop: 18, padding: "16px 18px", display: "flex", gap: 18, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
  heroLeft: { flex: "1 1 260px", minWidth: 240 },
  heroTitle: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "var(--muted)", marginBottom: 10 },
  heroRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--border)", minWidth: 0 },
  heroLabel: { fontSize: 13.5, fontWeight: 600, color: "var(--text)", width: 92, flexShrink: 0 },
  heroValue: { fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.4px", width: 40, flexShrink: 0 },
  ringWrap: { position: "relative", width: 130, textAlign: "center", flexShrink: 0 },
  ringCenter: { position: "absolute", top: 26, left: 0, right: 0 },
  ringValue: { fontSize: 19, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.4px" },
  ringLabel: { fontSize: 10.5, fontWeight: 600, color: "var(--muted)" },
  ringSub: { fontSize: 11.5, color: "var(--muted)", marginTop: 2 },

  sectionCard: { marginTop: 14, padding: "15px 18px 16px" },
  cardHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 },
  cardTitle: { display: "inline-flex", alignItems: "center", gap: 7, fontSize: 14.5, fontWeight: 700, color: "var(--ink)" },
  legend: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--muted)", fontWeight: 600 },
  dot: { width: 8, height: 8, borderRadius: 999, display: "inline-block" },

  goalList: { display: "flex", flexDirection: "column", gap: 12 },
  goalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  goalLabel: { fontSize: 13, fontWeight: 600, color: "var(--text)" },
  goalCount: { fontSize: 13, fontWeight: 800, display: "inline-flex", alignItems: "center" },
  goalScore: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: "var(--muted)" },
  track: { height: 8, borderRadius: 999, background: "#edeef3", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999, transition: "width .4s ease" },
  goalEmpty: { fontSize: 13, color: "var(--muted)", lineHeight: 1.5 },

  chart: { display: "flex", gap: 8, alignItems: "stretch" },
  chartCol: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 },
  barsBox: { height: 110, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3 },
  bar: { width: 10, minHeight: 3, borderRadius: 4 },
  chartLabel: { textAlign: "center", fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

  daysRow: { display: "flex", gap: 5 },
  dayCol: { flex: 1, display: "flex", flexDirection: "column", gap: 5, alignItems: "center" },
  dayBarBox: { height: 56, width: "100%", display: "flex", alignItems: "flex-end", justifyContent: "center" },
  dayBar: { width: "70%", maxWidth: 18, borderRadius: 4 },
  dayLetter: { fontSize: 9.5, fontWeight: 600, color: "var(--faint)" },

  recordGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 },
  record: { padding: "13px 12px", borderRadius: 12, background: "#f6f7f9", border: "1px solid var(--border)", textAlign: "center" },
  recordValue: { fontSize: 24, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" },
  recordLabel: { fontSize: 11.5, fontWeight: 600, color: "var(--muted)", marginTop: 3 }
};
