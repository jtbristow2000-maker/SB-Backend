"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { setAppointmentStatus } from "@/app/owner/actions";

// Calendar with Week (hourly time axis + positioned blocks), Month (grid), and
// Agenda views. Date math is in the browser's local timezone — for a single
// owner that equals the business timezone, which keeps the grid math simple.

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string | null; // ISO
  status: string;
  who: string;
  customerProfileId: string | null;
};

type View = "week" | "month" | "agenda";
type Ev = CalendarEvent & { startDate: Date; endDate: Date | null };

const AXIS_START = 7; // 7 AM
const AXIS_END = 21; // 9 PM
const HOUR_PX = 44;
const TOTAL_PX = (AXIS_END - AXIS_START) * HOUR_PX;
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
const STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay()); // Sunday
  return x;
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function hourLabel(h: number): string {
  const ampm = h < 12 ? "AM" : "PM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${ampm}`;
}
function timeLabel(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function statusColor(s: string): string {
  return s === "completed"
    ? "var(--positive)"
    : s === "cancelled" || s === "no_show"
      ? "#b23b3b"
      : s === "confirmed"
        ? "var(--brand)"
        : "#c77d14";
}
function blockGeom(start: Date, end: Date | null): { top: number; height: number } {
  const sH = start.getHours() + start.getMinutes() / 60;
  const eH = end ? end.getHours() + end.getMinutes() / 60 : sH + 1;
  const top = (Math.min(Math.max(sH, AXIS_START), AXIS_END) - AXIS_START) * HOUR_PX;
  const bottomH = Math.min(Math.max(eH, sH + 0.5), AXIS_END);
  return { top, height: Math.max((bottomH - AXIS_START) * HOUR_PX - top, 20) };
}
function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  return `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${sameMonth ? "" : `${MONTHS[end.getMonth()].slice(0, 3)} `}${end.getDate()}, ${end.getFullYear()}`;
}

export function CalendarViews({ events }: { events: CalendarEvent[] }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const evs: Ev[] = useMemo(
    () => events.map((e) => ({ ...e, startDate: new Date(e.start), endDate: e.end ? new Date(e.end) : null })),
    [events]
  );

  const go = (dir: number) => {
    setAnchor((prev) => {
      if (view === "month") {
        const x = new Date(prev);
        x.setDate(1);
        x.setMonth(x.getMonth() + dir);
        return x;
      }
      return addDays(prev, dir * 7);
    });
  };

  const periodLabel =
    view === "month"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === "week"
        ? weekLabel(startOfWeek(anchor))
        : "Upcoming";

  return (
    <div>
      <div style={S.toolbar}>
        <div style={S.viewToggle}>
          {(["week", "month", "agenda"] as View[]).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} style={toggleBtn(v === view)}>
              {v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
        {view !== "agenda" && (
          <div style={S.nav}>
            <button type="button" onClick={() => go(-1)} style={S.navBtn} aria-label="Previous">‹</button>
            <button type="button" onClick={() => setAnchor(new Date())} style={S.navToday}>Today</button>
            <button type="button" onClick={() => go(1)} style={S.navBtn} aria-label="Next">›</button>
          </div>
        )}
      </div>
      <div style={S.periodLabel}>{periodLabel}</div>

      {view === "week" && <WeekView anchor={anchor} evs={evs} />}
      {view === "month" && (
        <MonthView
          anchor={anchor}
          evs={evs}
          onPickDay={(d) => {
            setAnchor(d);
            setView("week");
          }}
        />
      )}
      {view === "agenda" && <AgendaView evs={evs} />}
    </div>
  );
}

function WeekView({ anchor, evs }: { anchor: Date; evs: Ev[] }) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const hours = Array.from({ length: AXIS_END - AXIS_START }, (_, i) => AXIS_START + i);

  return (
    <div style={S.weekScroll}>
      <div style={S.weekInner}>
        <div style={S.weekRow}>
          <div style={S.axisCol} />
          {days.map((d) => (
            <div key={d.toISOString()} style={dayHeader(sameDay(d, today))}>
              <div>{DOW[d.getDay()]}</div>
              <div style={S.dayHeaderNum}>{d.getDate()}</div>
            </div>
          ))}
        </div>
        <div style={S.weekRow}>
          <div style={S.axisCol}>
            {hours.map((h) => (
              <div key={h} style={S.axisHour}>{hourLabel(h)}</div>
            ))}
          </div>
          {days.map((d) => {
            const dayEvents = evs.filter((e) => sameDay(e.startDate, d));
            return (
              <div key={d.toISOString()} style={S.dayCol}>
                {hours.map((h) => (
                  <div key={h} style={{ ...S.hourLine, top: (h - AXIS_START) * HOUR_PX }} />
                ))}
                {dayEvents.map((e) => {
                  const g = blockGeom(e.startDate, e.endDate);
                  return <EventBlock key={e.id} ev={e} top={g.top} height={g.height} />;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventBlock({ ev, top, height }: { ev: Ev; top: number; height: number }) {
  const color = statusColor(ev.status);
  const style: CSSProperties = {
    position: "absolute",
    top,
    height,
    left: 3,
    right: 3,
    background: `${color}1f`,
    borderLeft: `3px solid ${color}`,
    borderRadius: 6,
    padding: "2px 5px",
    overflow: "hidden",
    fontSize: 11,
    lineHeight: 1.25,
    color: "#1e2026",
    textDecoration: "none",
    display: "block"
  };
  const inner = (
    <>
      <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {timeLabel(ev.startDate)}
      </div>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
    </>
  );
  return ev.customerProfileId ? (
    <Link href={`/owner/${ev.customerProfileId}`} style={style}>{inner}</Link>
  ) : (
    <div style={style}>{inner}</div>
  );
}

function MonthView({ anchor, evs, onPickDay }: { anchor: Date; evs: Ev[]; onPickDay: (d: Date) => void }) {
  const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date();

  return (
    <div>
      <div style={S.monthDow}>
        {DOW.map((d) => (
          <div key={d} style={S.monthDowCell}>{d}</div>
        ))}
      </div>
      <div style={S.monthGrid}>
        {cells.map((d) => {
          const inMonth = d.getMonth() === anchor.getMonth();
          const dayEvents = evs
            .filter((e) => sameDay(e.startDate, d))
            .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
          return (
            <button key={d.toISOString()} type="button" onClick={() => onPickDay(new Date(d))} style={monthCell(inMonth, sameDay(d, today))}>
              <div style={S.monthDayNum}>{d.getDate()}</div>
              {dayEvents.slice(0, 3).map((e) => (
                <div key={e.id} style={{ ...S.monthChip, background: `${statusColor(e.status)}1f`, borderLeft: `2px solid ${statusColor(e.status)}` }}>
                  {timeLabel(e.startDate)} {e.title}
                </div>
              ))}
              {dayEvents.length > 3 && <div style={S.monthMore}>+{dayEvents.length - 3} more</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ evs }: { evs: Ev[] }) {
  const today = startOfDay(new Date());
  const upcoming = evs.filter((e) => e.startDate >= today).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  if (upcoming.length === 0) {
    return <div style={S.empty}>No upcoming appointments.</div>;
  }
  const groups: { key: string; label: string; items: Ev[] }[] = [];
  for (const e of upcoming) {
    const key = startOfDay(e.startDate).toDateString();
    let group = groups.find((x) => x.key === key);
    if (!group) {
      group = { key, label: e.startDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }), items: [] };
      groups.push(group);
    }
    group.items.push(e);
  }
  return (
    <div>
      {groups.map((g) => (
        <div key={g.key} style={{ marginTop: 14 }}>
          <div style={S.agendaDay}>{g.label}</div>
          {g.items.map((e) => (
            <div key={e.id} style={S.agendaItem}>
              <div style={S.agendaTime}>
                {timeLabel(e.startDate)}
                {e.endDate ? <div style={S.agendaEnd}>–{timeLabel(e.endDate)}</div> : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{e.title}</div>
                {e.who && <div style={S.agendaWho}>{e.who}</div>}
              </div>
              <form action={setAppointmentStatus} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <input type="hidden" name="appointmentId" value={e.id} />
                <select name="status" defaultValue={e.status} style={S.miniSelect}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
                <button type="submit" style={S.miniBtn}>Save</button>
              </form>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function toggleBtn(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 8,
    border: `1px solid ${active ? "var(--brand)" : "#d8dce3"}`,
    background: active ? "var(--brand)" : "#fff",
    color: active ? "#fff" : "#3c414b",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer"
  };
}
function dayHeader(isToday: boolean): CSSProperties {
  return {
    flex: "1 0 96px",
    textAlign: "center",
    padding: "6px 2px",
    fontSize: 12,
    fontWeight: 600,
    color: isToday ? "var(--brand)" : "#3c414b",
    borderLeft: "1px solid #eceef2"
  };
}
function monthCell(inMonth: boolean, isToday: boolean): CSSProperties {
  return {
    minHeight: 80,
    textAlign: "left",
    padding: 4,
    borderRadius: 8,
    border: isToday ? "1px solid var(--brand)" : "1px solid #eceef2",
    background: inMonth ? "#fff" : "#f6f7f9",
    color: inMonth ? "#1e2026" : "#b0b6c0",
    cursor: "pointer",
    overflow: "hidden",
    display: "block"
  };
}

const S: Record<string, CSSProperties> = {
  toolbar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" },
  viewToggle: { display: "flex", gap: 4 },
  nav: { display: "flex", gap: 6, alignItems: "center" },
  navBtn: { padding: "6px 12px", borderRadius: 8, border: "1px solid #d8dce3", background: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", lineHeight: 1 },
  navToday: { padding: "6px 12px", borderRadius: 8, border: "1px solid #d8dce3", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  periodLabel: { fontSize: 15, fontWeight: 700, color: "#15171b", margin: "10px 0 6px" },
  weekScroll: { overflowX: "auto", border: "1px solid #eceef2", borderRadius: 12, background: "#fff" },
  weekInner: { minWidth: 724 },
  weekRow: { display: "flex" },
  axisCol: { flex: "0 0 52px", width: 52 },
  axisHour: { height: HOUR_PX, fontSize: 10, color: "#8a909c", textAlign: "right", paddingRight: 6, transform: "translateY(-6px)" },
  dayHeaderNum: { fontSize: 15, fontWeight: 700, color: "#15171b" },
  dayCol: { flex: "1 0 96px", position: "relative", height: TOTAL_PX, borderLeft: "1px solid #eceef2" },
  hourLine: { position: "absolute", left: 0, right: 0, height: 1, background: "#f1f2f5" },
  monthDow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: 4 },
  monthDowCell: { textAlign: "center", fontSize: 11, fontWeight: 700, color: "#8a909c", padding: "4px 0" },
  monthGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  monthDayNum: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  monthChip: { fontSize: 9, padding: "1px 3px", borderRadius: 3, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1e2026" },
  monthMore: { fontSize: 9, color: "#8a909c" },
  empty: { marginTop: 16, padding: "22px 16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", textAlign: "center", color: "#8a909c" },
  agendaDay: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "#8a909c", textTransform: "uppercase", margin: "6px 0 8px" },
  agendaItem: { display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", marginBottom: 8, borderRadius: 12, background: "#fff", border: "1px solid #eceef2" },
  agendaTime: { fontSize: 13, fontWeight: 700, color: "#15171b", minWidth: 62 },
  agendaEnd: { fontSize: 11, fontWeight: 400, color: "#8a909c" },
  agendaWho: { fontSize: 13, color: "#3c414b", marginTop: 2 },
  miniSelect: { padding: "4px 6px", borderRadius: 7, border: "1px solid #d8dce3", fontSize: 11, background: "#fff" },
  miniBtn: { padding: "4px 8px", borderRadius: 7, border: "none", background: "#eceef2", color: "#1e2026", fontWeight: 600, fontSize: 11, cursor: "pointer" }
};
