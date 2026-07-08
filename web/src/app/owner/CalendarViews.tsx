"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { BadgeDollarSign, CalendarDays, Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, MapPin, Pencil, Phone, StickyNote, Sun, Tag, Trash2, UserRound, X, type LucideIcon } from "lucide-react";

import { deleteAppointment, setAppointmentStatus, updateAppointment } from "@/app/owner/actions";
import { fmtPhone } from "@/app/owner/format";
import type { WeatherByDay, WeatherByHour } from "@/app/owner/weather";

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
  service: string | null;
  location: string | null;
  notes: string | null;
  phone: string | null;
  priceLabel: string | null;
  serviceColor: string;
};

type View = "week" | "month" | "agenda";
type Ev = CalendarEvent & { startDate: Date; endDate: Date | null };
type Selection = { ev: Ev; mode: "view" | "edit" };
const DURATION_OPTIONS = [30, 60, 90, 120, 180, 240];

const AXIS_START = 7; // 7 AM
const AXIS_END = 21; // 9 PM
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
function blockGeom(start: Date, end: Date | null, hourPx: number): { top: number; height: number } {
  const sH = start.getHours() + start.getMinutes() / 60;
  const eH = end ? end.getHours() + end.getMinutes() / 60 : sH + 1;
  const top = (Math.min(Math.max(sH, AXIS_START), AXIS_END) - AXIS_START) * hourPx;
  const bottomH = Math.min(Math.max(eH, sH + 0.5), AXIS_END);
  return { top, height: Math.max((bottomH - AXIS_START) * hourPx - top, 20) };
}
function weekLabel(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  const sameMonth = weekStart.getMonth() === end.getMonth();
  return `${MONTHS[weekStart.getMonth()].slice(0, 3)} ${weekStart.getDate()} – ${sameMonth ? "" : `${MONTHS[end.getMonth()].slice(0, 3)} `}${end.getDate()}, ${end.getFullYear()}`;
}

// ------------------------------------------------------------ weather glyphs
function localKey(d: Date): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in the browser's local tz
}
function wxIcon(short: string): LucideIcon {
  const s = short.toLowerCase();
  if (/thunder|storm/.test(s)) return CloudLightning;
  if (/snow|sleet|ice|blizzard|flurr|freezing/.test(s)) return CloudSnow;
  if (/rain|shower|drizzle/.test(s)) return CloudRain;
  if (/partly|mostly sunny/.test(s)) return CloudSun;
  if (/cloud|overcast|fog|haze/.test(s)) return Cloud;
  return Sun;
}
// Small forecast tag for a calendar day: icon + high, amber when the day breaks
// the owner's weather cutoffs (tooltip carries the reason).
function WxTag({ weather, date, size = 12 }: { weather?: WeatherByDay; date: Date; size?: number }) {
  const w = weather?.[localKey(date)];
  if (!w || (w.hi === null && !w.short)) return null;
  const Icon = wxIcon(w.short);
  const color = w.bad ? "#b06f12" : "var(--muted)";
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: size - 1.5, fontWeight: 600, color, whiteSpace: "nowrap" }}
      title={`${w.short}${w.hi !== null ? ` · ${w.hi}°` : ""}${w.rain !== null ? ` · ${w.rain}% rain` : ""}${w.bad && w.reason ? ` — ${w.reason}` : ""}`}
    >
      <Icon size={size} aria-hidden />
      {w.hi !== null ? `${w.hi}°` : ""}
    </span>
  );
}

export function CalendarViews({ events, legend = [], weather, weatherHours }: { events: CalendarEvent[]; legend?: { service: string; color: string }[]; weather?: WeatherByDay; weatherHours?: WeatherByHour }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<Selection | null>(null);

  // Freely resizable layout: the week grid scrolls inside a window whose height
  // and width you drag (corner / bottom handles), plus a smooth zoom slider for
  // the hour height. Everything persists per browser; loaded after mount.
  const [hourPx, setHourPx] = useState(56);
  const [gridH, setGridH] = useState(520);
  const [calW, setCalW] = useState<number | null>(null); // null = fill the page
  const layoutLoaded = useRef(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    try {
      const z = Number(localStorage.getItem("snagly_cal_zoom"));
      if (z >= 36 && z <= 88) setHourPx(z);
      const h = Number(localStorage.getItem("snagly_cal_h"));
      if (h >= 300 && h <= 900) setGridH(h);
      const w = localStorage.getItem("snagly_cal_w");
      if (w && w !== "fill") {
        const n = Number(w);
        if (n >= 560) setCalW(n);
      }
    } catch { /* private mode */ }
    layoutLoaded.current = true;
  }, []);
  useEffect(() => {
    if (!layoutLoaded.current) return;
    try {
      localStorage.setItem("snagly_cal_zoom", String(hourPx));
      localStorage.setItem("snagly_cal_h", String(gridH));
      localStorage.setItem("snagly_cal_w", calW === null ? "fill" : String(calW));
    } catch { /* ignore */ }
  }, [hourPx, gridH, calW]);

  // Window-style resize: corner handle drags width + height, bottom bar drags
  // height. Dragging (nearly) as wide as the page snaps back to "fill".
  const startResize = (e: ReactPointerEvent<HTMLDivElement>, mode: "corner" | "height") => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = frameRef.current?.getBoundingClientRect().width ?? 900;
    const startH = gridH;
    const avail = frameRef.current?.parentElement?.getBoundingClientRect().width ?? startW;
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    const onMove = (ev: globalThis.PointerEvent) => {
      if (mode === "corner") {
        const w = startW + (ev.clientX - startX);
        setCalW(w >= avail - 20 ? null : Math.max(560, Math.round(w)));
      }
      if (view === "week") {
        setGridH(Math.max(300, Math.min(900, Math.round(startH + (ev.clientY - startY)))));
      }
    };
    const onUp = () => {
      document.body.style.userSelect = prevSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const resetLayout = () => {
    setCalW(null);
    setGridH(520);
    setHourPx(56);
  };
  const openEvent = (ev: Ev, mode: "view" | "edit") => setSelected({ ev, mode });

  // Desktop hover preview (skipped on touch, where the click popup is the path).
  const [hover, setHover] = useState<{ ev: Ev; left: number; top: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showHover = (ev: Ev, rect: DOMRect) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const vw = typeof window !== "undefined" ? window.innerWidth : 360;
    setHover({ ev, left: Math.min(Math.max(rect.left, 8), vw - 288), top: rect.bottom + 6 });
  };
  const queueHideHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(null), 160);
  };
  const cancelHideHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  // Delete is owned here (not in the modal) so the modal can close instantly for a
  // snappy paint while the server action + revalidation run in the background.
  const [, startDeleteTransition] = useTransition();
  const handleDelete = (ev: Ev) => {
    setSelected(null);
    const fd = new FormData();
    fd.set("appointmentId", ev.id);
    startDeleteTransition(async () => {
      await deleteAppointment(fd);
    });
  };

  const evs: Ev[] = useMemo(
    () => events.map((e) => ({ ...e, startDate: new Date(e.start), endDate: e.end ? new Date(e.end) : null })),
    [events]
  );

  const go = (dir: number) => {
    setAnchor((prev) => {
      const now = new Date();
      if (view === "month") {
        const x = new Date(prev);
        x.setDate(1);
        x.setMonth(x.getMonth() + dir);
        const curMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return x < curMonth ? curMonth : x;
      }
      const x = addDays(prev, dir * 7);
      return startOfWeek(x) < startOfWeek(now) ? startOfWeek(now) : x;
    });
  };

  const periodLabel =
    view === "month"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === "week"
        ? weekLabel(startOfWeek(anchor))
        : "Upcoming";

  // The schedule never needs to go back in time — block navigating before the current week/month.
  const canGoBack =
    view === "month"
      ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) > new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      : startOfWeek(anchor) > startOfWeek(new Date());

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
        <div style={S.nav}>
          {view === "week" && (
            <label style={S.zoomWrap} title="Hour height - drag to zoom the grid">
              <span style={S.zoomLabel}>Zoom</span>
              <input
                type="range"
                min={36}
                max={88}
                step={2}
                value={hourPx}
                onChange={(e) => setHourPx(Number(e.target.value))}
                style={S.zoom}
                aria-label="Hour row height"
              />
            </label>
          )}
          {view !== "agenda" && (
            <>
              <button type="button" onClick={() => go(-1)} disabled={!canGoBack} style={{ ...S.navBtn, opacity: canGoBack ? 1 : 0.35, cursor: canGoBack ? "pointer" : "default" }} aria-label="Previous">‹</button>
              <button type="button" onClick={() => setAnchor(new Date())} style={S.navToday}>Today</button>
              <button type="button" onClick={() => go(1)} style={S.navBtn} aria-label="Next">›</button>
            </>
          )}
        </div>
      </div>
      <div style={S.periodLabel}>{periodLabel}</div>
      {legend.length > 0 && (
        <div style={S.legend}>
          {legend.map((l) => (
            <span key={l.service} style={S.legendItem}>
              <span style={{ ...S.legendDot, background: l.color }} />
              {l.service}
            </span>
          ))}
        </div>
      )}

      <div
        ref={frameRef}
        style={{ position: "relative", maxWidth: calW ?? undefined, margin: calW !== null ? "0 auto" : undefined, paddingBottom: view === "week" ? 9 : 0 }}
      >
        {view === "week" && (
          <WeekView anchor={anchor} evs={evs} weather={weather} weatherHours={weatherHours} hourPx={hourPx} gridH={gridH} onOpen={openEvent} onHover={showHover} onHoverLeave={queueHideHover} />
        )}
        {view === "month" && (
          <MonthView
            anchor={anchor}
            evs={evs}
            weather={weather}
            onPickDay={(d) => {
              setAnchor(d);
              setView("week");
            }}
          />
        )}
        {view === "agenda" && <AgendaView evs={evs} weather={weather} onOpen={openEvent} />}

        {view === "week" && (
          <div
            onPointerDown={(e) => startResize(e, "height")}
            onDoubleClick={resetLayout}
            style={S.heightHandle}
            title="Drag to make the calendar taller or shorter - double-click to reset"
          >
            <span style={S.gripDot} /><span style={S.gripDot} /><span style={S.gripDot} />
          </div>
        )}
        <div
          onPointerDown={(e) => startResize(e, "corner")}
          onDoubleClick={resetLayout}
          style={S.cornerHandle}
          title="Drag to resize the calendar - double-click to reset"
        />
      </div>

      {selected && (
        <AppointmentModal
          key={selected.ev.id}
          ev={selected.ev}
          mode={selected.mode}
          onClose={() => setSelected(null)}
          onEdit={() => setSelected((s) => (s ? { ...s, mode: "edit" } : s))}
          onDelete={handleDelete}
        />
      )}

      {hover && !selected && (
        <HoverCard ev={hover.ev} left={hover.left} top={hover.top} onEnter={cancelHideHover} onLeave={queueHideHover} />
      )}
    </div>
  );
}

function WeekView({
  anchor,
  evs,
  weather,
  weatherHours,
  hourPx,
  gridH,
  onOpen,
  onHover,
  onHoverLeave
}: {
  anchor: Date;
  evs: Ev[];
  weather?: WeatherByDay;
  weatherHours?: WeatherByHour;
  hourPx: number;
  gridH: number;
  onOpen: (ev: Ev, mode: "view" | "edit") => void;
  onHover: (ev: Ev, rect: DOMRect) => void;
  onHoverLeave: () => void;
}) {
  // The grid lives in a scroll window; open on the working morning (8 AM).
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = Math.max(0, (8 - AXIS_START) * hourPx - 6);
  }, [hourPx]);
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();
  const hours = Array.from({ length: AXIS_END - AXIS_START }, (_, i) => AXIS_START + i);
  const totalPx = (AXIS_END - AXIS_START) * hourPx;
  const hourKey = (d: Date, h: number) => `${localKey(d)}T${String(h).padStart(2, "0")}`;

  return (
    <div ref={scrollRef} className="scroll-soft" style={{ ...S.weekScroll, height: gridH }}>
      <div style={S.weekInner}>
        <div style={{ ...S.weekRow, ...S.stickyHead }}>
          <div style={S.axisCol} />
          {days.map((d) => (
            <div key={d.toISOString()} style={dayHeader(sameDay(d, today))}>
              <div>{DOW[d.getDay()]}</div>
              <div style={S.dayHeaderNum}>{d.getDate()}</div>
              <WxTag weather={weather} date={d} size={12} />
            </div>
          ))}
        </div>
        <div style={S.weekRow}>
          <div style={S.axisCol}>
            {hours.map((h) => (
              <div key={h} style={{ ...S.axisHour, height: hourPx }}>{hourLabel(h)}</div>
            ))}
          </div>
          {days.map((d) => {
            const dayEvents = evs.filter((e) => sameDay(e.startDate, d));
            return (
              <div key={d.toISOString()} style={{ ...S.dayCol, height: totalPx }}>
                {weatherHours &&
                  hours.map((h) => {
                    const wx = weatherHours[hourKey(d, h)];
                    if (!wx?.bad) return null;
                    return <div key={`wx-${h}`} style={{ ...S.wxBand, top: (h - AXIS_START) * hourPx, height: hourPx }} />;
                  })}
                {weatherHours &&
                  [9, 13, 17].map((h) => {
                    const wx = weatherHours[hourKey(d, h)];
                    if (!wx || wx.temp === null) return null;
                    const Icon = wxIcon(wx.short);
                    return (
                      <span
                        key={`stamp-${h}`}
                        style={{ ...S.wxStamp, top: (h - AXIS_START) * hourPx + 2, color: wx.bad ? "#b06f12" : "var(--faint)" }}
                        title={`${hourLabel(h)} - ${wx.short}${wx.temp !== null ? ` · ${wx.temp}°` : ""}${wx.rain !== null ? ` · ${wx.rain}% rain` : ""}`}
                      >
                        <Icon size={11} aria-hidden />
                        {wx.temp}°
                      </span>
                    );
                  })}
                {hours.map((h) => (
                  <div key={h} style={{ ...S.hourLine, top: (h - AXIS_START) * hourPx }} />
                ))}
                {dayEvents.map((e) => {
                  const g = blockGeom(e.startDate, e.endDate, hourPx);
                  return (
                    <EventBlock
                      key={e.id}
                      ev={e}
                      top={g.top}
                      height={g.height}
                      onOpen={onOpen}
                      onHover={onHover}
                      onHoverLeave={onHoverLeave}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventBlock({
  ev,
  top,
  height,
  onOpen,
  onHover,
  onHoverLeave
}: {
  ev: Ev;
  top: number;
  height: number;
  onOpen: (ev: Ev, mode: "view" | "edit") => void;
  onHover: (ev: Ev, rect: DOMRect) => void;
  onHoverLeave: () => void;
}) {
  const color = ev.serviceColor || statusColor(ev.status);
  const dimmed = ev.status === "cancelled" || ev.status === "no_show";
  // Distinguish single click (view) from double click (edit) with a short timer.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleClick = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onOpen(ev, "view"), 200);
  };
  const handleDouble = () => {
    if (timer.current) clearTimeout(timer.current);
    onOpen(ev, "edit");
  };
  const style: CSSProperties = {
    position: "absolute",
    top,
    height,
    left: 3,
    right: 3,
    boxSizing: "border-box",
    background: `${color}1f`,
    border: "none",
    borderLeft: `3px solid ${color}`,
    borderRadius: 6,
    padding: "3px 6px",
    overflow: "hidden",
    fontSize: 11,
    lineHeight: 1.25,
    color: "#1e2026",
    textAlign: "left",
    cursor: "pointer",
    fontFamily: "inherit",
    opacity: dimmed ? 0.5 : 1
  };
  return (
    <button
      type="button"
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDouble}
      onMouseEnter={(e) => onHover(ev, e.currentTarget.getBoundingClientRect())}
      onMouseLeave={onHoverLeave}
    >
      <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {timeLabel(ev.startDate)}
      </div>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
    </button>
  );
}

function MonthView({ anchor, evs, weather, onPickDay }: { anchor: Date; evs: Ev[]; weather?: WeatherByDay; onPickDay: (d: Date) => void }) {
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
              <div style={S.monthCellTop}><span style={S.monthDayNum}>{d.getDate()}</span><WxTag weather={weather} date={d} size={11} /></div>
              {dayEvents.slice(0, 3).map((e) => (
                <div key={e.id} style={{ ...S.monthChip, background: `${e.serviceColor}1f`, borderLeft: `2px solid ${e.serviceColor}` }}>
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

function AgendaView({ evs, weather, onOpen }: { evs: Ev[]; weather?: WeatherByDay; onOpen: (ev: Ev, mode: "view" | "edit") => void }) {
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
          <div style={S.agendaDay}>{g.label} <WxTag weather={weather} date={g.items[0].startDate} size={12} /></div>
          {g.items.map((e) => (
            <div key={e.id} style={{ ...S.agendaItem, borderLeft: `4px solid ${e.serviceColor}` }}>
              <div style={S.agendaTime}>
                {timeLabel(e.startDate)}
                {e.endDate ? <div style={S.agendaEnd}>–{timeLabel(e.endDate)}</div> : null}
              </div>
              <div
                style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                onClick={() => onOpen(e, "view")}
                onDoubleClick={() => onOpen(e, "edit")}
              >
                <div style={{ fontWeight: 600 }}>{e.title}</div>
                {e.who ? <div style={S.agendaWho}>{e.who}</div> : null}
                {e.priceLabel ? <div style={S.agendaWho}>{e.priceLabel}{e.location ? <> · <MapPin size={11} className="ico-inline" aria-hidden /></> : null}</div> : null}
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

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}
function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function nearestDuration(ev: Ev): number {
  if (!ev.endDate) return 60;
  const mins = Math.round((ev.endDate.getTime() - ev.startDate.getTime()) / 60000);
  if (mins <= 0) return 60;
  return DURATION_OPTIONS.reduce((best, d) => (Math.abs(d - mins) < Math.abs(best - mins) ? d : best), 60);
}

// Lightweight hover preview (desktop). Positioned fixed so the scroll container
// doesn't clip it, and hoverable so the owner can move in and click the Maps link.
function HoverCard({
  ev,
  left,
  top,
  onEnter,
  onLeave
}: {
  ev: Ev;
  left: number;
  top: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const color = statusColor(ev.status);
  const mapsHref = ev.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`
    : null;
  return (
    <div style={{ ...S.hoverCard, left, top }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{ev.title}</div>
      <div style={S.hoverRow}>
        <CalendarDays size={12} className="ico-inline" aria-hidden /> {ev.startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
        {timeLabel(ev.startDate)}{ev.endDate ? `–${timeLabel(ev.endDate)}` : ""}
      </div>
      <div style={S.hoverRow}>
        <span style={{ ...S.statusPill, background: `${color}1f`, color }}>{ev.status.replace("_", " ")}</span>
      </div>
      {ev.priceLabel && <div style={S.hoverRow}><BadgeDollarSign size={12} className="ico-inline" aria-hidden /> {ev.priceLabel}{ev.service ? ` · ${ev.service}` : ""}</div>}
      {ev.location && (
        <div style={S.hoverRow}>
          <MapPin size={12} className="ico-inline" aria-hidden /> {ev.location}
          {mapsHref && <> · <a href={mapsHref} target="_blank" rel="noreferrer" style={S.mapLink}>Maps ↗</a></>}
        </div>
      )}
      {ev.notes && <div style={{ ...S.hoverRow, whiteSpace: "pre-line" }}><StickyNote size={12} className="ico-inline" aria-hidden /> {ev.notes}</div>}
      {ev.who && <div style={S.hoverRow}><UserRound size={12} className="ico-inline" aria-hidden /> {ev.who}</div>}
      {ev.phone && (
        <div style={S.hoverRow}><Phone size={12} className="ico-inline" aria-hidden /> <a href={`tel:${ev.phone}`} style={S.mapLink}>{fmtPhone(ev.phone)}</a></div>
      )}
      <div style={S.hoverHint}>Click for full details · double-click to edit</div>
    </div>
  );
}

// Detail / edit popup for one appointment. Single click on an event opens "view"
// (details, price, address → maps, notes); double click (or the Edit button) opens
// the edit form, which saves via the updateAppointment server action.
function AppointmentModal({
  ev,
  mode,
  onClose,
  onEdit,
  onDelete
}: {
  ev: Ev;
  mode: "view" | "edit";
  onClose: () => void;
  onEdit: () => void;
  onDelete: (ev: Ev) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmDel, setConfirmDel] = useState(false);
  const color = statusColor(ev.status);
  const dateLabel = ev.startDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  const timeRange = `${timeLabel(ev.startDate)}${ev.endDate ? ` – ${timeLabel(ev.endDate)}` : ""}`;
  const mapsHref = ev.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`
    : null;

  const save = (formData: FormData) => {
    startTransition(async () => {
      await updateAppointment(formData);
      onClose();
    });
  };

  return (
    <div style={S.overlay} onClick={onClose} role="presentation">
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <strong style={{ fontSize: 16, paddingRight: 8 }}>{mode === "edit" ? "Edit appointment" : ev.title}</strong>
          <button type="button" onClick={onClose} className="btn" style={S.modalClose} aria-label="Close"><X size={16} aria-hidden /></button>
        </div>

        {mode === "view" ? (
          <div style={S.modalBody}>
            <div style={S.detailRow}><span style={S.detailIcon}><CalendarDays size={14} aria-hidden /></span><span>{dateLabel} · {timeRange}</span></div>
            <div style={S.detailRow}>
              <span style={S.detailIcon}><Tag size={14} aria-hidden /></span>
              <span style={{ ...S.statusPill, background: `${color}1f`, color }}>{ev.status.replace("_", " ")}</span>
            </div>
            {ev.priceLabel && (
              <div style={S.detailRow}>
                <span style={S.detailIcon}><BadgeDollarSign size={14} aria-hidden /></span>
                <span><strong>{ev.priceLabel}</strong>{ev.service ? ` · ${ev.service}` : ""}</span>
              </div>
            )}
            <div style={S.detailRow}>
              <span style={S.detailIcon}><MapPin size={14} aria-hidden /></span>
              {ev.location ? (
                <span>
                  {ev.location}
                  {mapsHref && <> · <a href={mapsHref} target="_blank" rel="noreferrer" style={S.mapLink}>Open in Maps ↗</a></>}
                </span>
              ) : (
                <span style={S.muted}>No address yet — tap Edit to add one.</span>
              )}
            </div>
            <div style={S.detailRow}>
              <span style={S.detailIcon}><StickyNote size={14} aria-hidden /></span>
              {ev.notes ? <span style={{ whiteSpace: "pre-line" }}>{ev.notes}</span> : <span style={S.muted}>No notes</span>}
            </div>
            {ev.who && <div style={S.detailRow}><span style={S.detailIcon}><UserRound size={14} aria-hidden /></span><span>{ev.who}</span></div>}
            {ev.phone && (
              <div style={S.detailRow}>
                <span style={S.detailIcon}><Phone size={14} aria-hidden /></span>
                <span><a href={`tel:${ev.phone}`} style={S.mapLink}>{fmtPhone(ev.phone)}</a></span>
              </div>
            )}

            <div style={S.modalActions}>
              <button type="button" onClick={onEdit} className="btn" style={S.btnPrimary}><Pencil size={13} aria-hidden /> Edit</button>
              {ev.customerProfileId && <Link href={`/owner/${ev.customerProfileId}`} style={S.btnGhost}>Open lead</Link>}
              {ev.phone && <a href={`tel:${ev.phone}`} className="btn" style={S.btnGhost}><Phone size={13} className="ico-inline" aria-hidden /> Call</a>}
              <button
                type="button"
                onClick={() => (confirmDel ? onDelete(ev) : setConfirmDel(true))}
                style={S.btnDanger}
              >
                {confirmDel ? "Tap again to confirm" : <><Trash2 size={13} className="ico-inline" aria-hidden /> Delete</>}
              </button>
            </div>
          </div>
        ) : (
          <form action={save} style={S.modalBody}>
            <input type="hidden" name="appointmentId" value={ev.id} />
            <label style={S.formLabel}>Title<input name="title" defaultValue={ev.title} style={S.input} /></label>
            <label style={S.formLabel}>Service<input name="service" defaultValue={ev.service ?? ""} placeholder="e.g. Full Detail SUV" style={S.input} /></label>
            <div style={{ display: "flex", gap: 8 }}>
              <label style={{ ...S.formLabel, flex: 1 }}>Start<input type="datetime-local" name="start" defaultValue={toLocalInput(ev.startDate)} style={S.input} /></label>
              <label style={S.formLabel}>Length
                <select name="duration" defaultValue={String(nearestDuration(ev))} style={S.input}>
                  <option value="30">30m</option>
                  <option value="60">1h</option>
                  <option value="90">1.5h</option>
                  <option value="120">2h</option>
                  <option value="180">3h</option>
                  <option value="240">4h</option>
                </select>
              </label>
            </div>
            <label style={S.formLabel}>Status
              <select name="status" defaultValue={ev.status} style={S.input}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <label style={S.formLabel}>Address<input name="location" defaultValue={ev.location ?? ""} placeholder="123 Main St, City" style={S.input} /></label>
            <label style={S.formLabel}>Notes<textarea name="notes" defaultValue={ev.notes ?? ""} rows={3} style={S.textarea} /></label>
            <div style={S.modalActions}>
              <button type="submit" disabled={pending} style={S.btnPrimary}>{pending ? "Saving…" : "Save"}</button>
              <button type="button" onClick={onClose} style={S.btnGhost}>Cancel</button>
            </div>
          </form>
        )}
      </div>
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
    borderLeft: "1px solid var(--border)"
  };
}
function monthCell(inMonth: boolean, isToday: boolean): CSSProperties {
  return {
    minHeight: 80,
    textAlign: "left",
    padding: 4,
    borderRadius: 8,
    border: isToday ? "1px solid var(--brand)" : "1px solid var(--border)",
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
  periodLabel: { fontSize: 15, fontWeight: 700, color: "var(--ink)", margin: "10px 0 6px" },
  legend: { display: "flex", flexWrap: "wrap", gap: 12, margin: "0 0 12px", fontSize: 12, color: "var(--text)" },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  legendDot: { width: 11, height: 11, borderRadius: 3, display: "inline-block", flexShrink: 0 },
  weekScroll: { overflow: "auto", overscrollBehavior: "contain", border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", boxShadow: "var(--shadow-sm)" },
  weekInner: { minWidth: 780 },
  weekRow: { display: "flex" },
  axisCol: { flex: "0 0 52px", width: 52 },
  axisHour: { fontSize: 10, color: "var(--muted)", textAlign: "right", paddingRight: 6, transform: "translateY(-6px)" },
  dayHeaderNum: { fontSize: 15, fontWeight: 700, color: "var(--ink)" },
  dayCol: { flex: "1 0 110px", position: "relative", borderLeft: "1px solid var(--border)" },
  wxBand: { position: "absolute", left: 0, right: 0, background: "rgba(58,123,208,0.07)", pointerEvents: "none" },
  wxStamp: { position: "absolute", right: 3, display: "inline-flex", alignItems: "center", gap: 2, fontSize: 9, fontWeight: 600, zIndex: 1 },
  zoomWrap: { display: "inline-flex", alignItems: "center", gap: 7, padding: "0 4px" },
  zoomLabel: { fontSize: 11.5, fontWeight: 600, color: "var(--muted)" },
  zoom: { width: 96, accentColor: "var(--brand)", cursor: "ew-resize" },
  stickyHead: { position: "sticky", top: 0, zIndex: 3, background: "var(--surface)", boxShadow: "0 1px 0 var(--border)" },
  heightHandle: { position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -2, width: 56, height: 13, cursor: "ns-resize", zIndex: 4, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xs)", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, touchAction: "none" },
  gripDot: { width: 3, height: 3, borderRadius: 999, background: "var(--muted)" },
  cornerHandle: { position: "absolute", right: -2, bottom: -2, width: 18, height: 18, cursor: "nwse-resize", zIndex: 4, borderRadius: "3px 3px 8px 3px", background: "repeating-linear-gradient(135deg, transparent 0 4px, var(--border-strong) 4px 6px)", opacity: 0.9, touchAction: "none" },
  hourLine: { position: "absolute", left: 0, right: 0, height: 1, background: "#f1f2f5" },
  monthDow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: 4 },
  monthDowCell: { textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--muted)", padding: "4px 0" },
  monthGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  monthCellTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 4, marginBottom: 2, minWidth: 0 },
  monthDayNum: { fontSize: 12, fontWeight: 700 },
  monthChip: { fontSize: 9, padding: "1px 3px", borderRadius: 3, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1e2026" },
  monthMore: { fontSize: 9, color: "var(--muted)" },
  empty: { marginTop: 16, padding: "22px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", textAlign: "center", color: "var(--muted)" },
  agendaDay: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "var(--muted)", textTransform: "uppercase", margin: "6px 0 8px" },
  agendaItem: { display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", marginBottom: 8, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" },
  agendaTime: { fontSize: 13, fontWeight: 700, color: "var(--ink)", minWidth: 62 },
  agendaEnd: { fontSize: 11, fontWeight: 400, color: "var(--muted)" },
  agendaWho: { fontSize: 13, color: "var(--text)", marginTop: 2 },
  miniSelect: { padding: "4px 6px", borderRadius: 7, border: "1px solid #d8dce3", fontSize: 11, background: "#fff" },
  miniBtn: { padding: "4px 8px", borderRadius: 7, border: "none", background: "#eceef2", color: "#1e2026", fontWeight: 600, fontSize: 11, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(17,21,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "#fff" },
  modalClose: { border: "none", background: "transparent", fontSize: 16, cursor: "pointer", color: "var(--muted)", lineHeight: 1 },
  modalBody: { display: "flex", flexDirection: "column", gap: 12, padding: 16 },
  detailRow: { display: "flex", gap: 10, fontSize: 14, color: "#1e2026", alignItems: "flex-start", lineHeight: 1.45 },
  detailIcon: { width: 20, flexShrink: 0, textAlign: "center" },
  statusPill: { fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999, textTransform: "capitalize" },
  mapLink: { color: "var(--brand)", fontWeight: 600, textDecoration: "none" },
  muted: { color: "var(--muted)" },
  modalActions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 },
  btnPrimary: { display: "inline-block", padding: "10px 14px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "none", textAlign: "center" },
  btnGhost: { display: "inline-block", padding: "10px 14px", borderRadius: 10, border: "1px solid #d8dce3", background: "#fff", color: "#1e2026", fontWeight: 600, fontSize: 14, cursor: "pointer", textDecoration: "none", textAlign: "center" },
  formLabel: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "var(--text)" },
  input: { padding: "9px 11px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit" },
  textarea: { padding: "9px 11px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  btnDanger: { display: "inline-block", padding: "10px 14px", borderRadius: 10, border: "1px solid #f1c4c4", background: "#fff", color: "#b23b3b", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  hoverCard: { position: "fixed", width: 272, maxWidth: "calc(100vw - 16px)", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: "10px 12px", fontSize: 12, lineHeight: 1.45, color: "#1e2026", zIndex: 900 },
  hoverRow: { marginTop: 3 },
  hoverHint: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #f1f2f5", fontSize: 11, color: "var(--muted)" }
};
