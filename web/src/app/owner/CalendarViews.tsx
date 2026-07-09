"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { BadgeDollarSign, CalendarDays, Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, MapPin, Pencil, Phone, Plus, StickyNote, Sun, Tag, Trash2, UserRound, X, type LucideIcon } from "lucide-react";

import { createAppointment, deleteAppointment, setAppointmentStatus, updateAppointment } from "@/app/owner/actions";
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

export function CalendarViews({ events, weather, weatherHours }: { events: CalendarEvent[]; weather?: WeatherByDay; weatherHours?: WeatherByHour }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<Selection | null>(null);

  // Quick-book: set by clicking/dragging an empty slot (or the + Book button);
  // opens a small prefilled dialog that posts createAppointment.
  const [draft, setDraft] = useState<{ start: Date; end: Date } | null>(null);
  const openBook = () => {
    const s0 = new Date();
    s0.setMinutes(0, 0, 0);
    s0.setHours(Math.min(Math.max(s0.getHours() + 1, AXIS_START), AXIS_END - 1));
    const e0 = new Date(s0);
    e0.setHours(s0.getHours() + 1);
    setDraft({ start: s0, end: e0 });
  };

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
      return startOfDay(x) < startOfDay(now) ? startOfDay(now) : x;
    });
  };

  const periodLabel =
    view === "month"
      ? `${MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`
      : view === "week"
        ? weekLabel(startOfDay(anchor))
        : "Upcoming";

  // The schedule never needs to go back in time — block navigating before the current week/month.
  const canGoBack =
    view === "month"
      ? new Date(anchor.getFullYear(), anchor.getMonth(), 1) > new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      : startOfDay(anchor) > startOfDay(new Date());

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
          <button type="button" onClick={openBook} className="btn" style={S.bookBtn}>
            <Plus size={14} aria-hidden /> Book
          </button>
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
      <div
        ref={frameRef}
        style={{ position: "relative", maxWidth: calW ?? undefined, margin: calW !== null ? "0 auto" : undefined, paddingBottom: view === "week" ? 9 : 0 }}
      >
        {view === "week" && (
          <WeekView anchor={anchor} evs={evs} weather={weather} weatherHours={weatherHours} hourPx={hourPx} gridH={gridH} onOpen={openEvent} onHover={showHover} onHoverLeave={queueHideHover} onCreate={(start, end) => setDraft({ start, end })} />
        )}
        {view === "month" && (
          <MonthView
            anchor={anchor}
            evs={evs}
            weather={weather}
            onPickDay={(d) => {
              const today = startOfDay(new Date());
              setAnchor(d < today ? today : d);
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

      {draft && <QuickBook draft={draft} onClose={() => setDraft(null)} />}
    </div>
  );
}

// Compact booking dialog, prefilled from the slot the owner clicked/dragged.
function QuickBook({ draft, onClose }: { draft: { start: Date; end: Date }; onClose: () => void }) {
  const mins = Math.max(30, Math.round((draft.end.getTime() - draft.start.getTime()) / 60000));
  const duration = DURATION_OPTIONS.reduce((best, d) => (Math.abs(d - mins) < Math.abs(best - mins) ? d : best), 60);
  const whenLabel = `${draft.start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${timeLabel(draft.start)} – ${timeLabel(draft.end)}`;
  return (
    <div style={S.overlay} onClick={onClose} role="presentation">
      <div style={S.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Book an appointment">
        <div style={S.modalHead}>
          <strong style={{ fontSize: 16, paddingRight: 8 }}>New appointment</strong>
          <button type="button" onClick={onClose} className="btn" style={S.modalClose} aria-label="Close"><X size={16} aria-hidden /></button>
        </div>
        <div style={S.quickWhen}><CalendarDays size={13} className="ico-inline" aria-hidden /> {whenLabel}</div>
        <form action={createAppointment} onSubmit={onClose} style={S.modalBody}>
          <input name="title" required placeholder="What & who (e.g. Full detail - Sarah's SUV)" className="input" style={S.qInput} autoFocus autoComplete="off" />
          <input name="service" placeholder="Service (matches your price list)" className="input" style={S.qInput} autoComplete="off" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input name="start" type="datetime-local" required defaultValue={toLocalInput(draft.start)} className="input" style={{ ...S.qInput, flex: "1 1 190px" }} aria-label="Start time" />
            <select name="duration" defaultValue={String(duration)} className="input" style={{ ...S.qInput, width: 104 }} aria-label="Duration">
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>{m < 60 ? `${m}m` : `${m / 60}h`}</option>
              ))}
            </select>
          </div>
          <input name="location" placeholder="Address (optional - for directions)" className="input" style={S.qInput} autoComplete="off" />
          <input name="notes" placeholder="Notes (optional - gate code, etc.)" className="input" style={S.qInput} autoComplete="off" />
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Add to schedule</button>
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
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
  onHoverLeave,
  onCreate
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
  onCreate: (start: Date, end: Date) => void;
}) {
  // Live "you are here" marker (Outlook-style red line), refreshed each minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowH = now.getHours() + now.getMinutes() / 60;
  const nowOnAxis = nowH >= AXIS_START && nowH <= AXIS_END;

  // The grid lives in a scroll window. If today is in view, open centered on
  // right now; otherwise open on the working morning (8 AM).
  const weekHasToday = (() => {
    const t = startOfDay(new Date());
    const ws = startOfDay(anchor);
    return t >= ws && t < addDays(ws, 7);
  })();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const anchorH = weekHasToday && nowOnAxis ? nowH : 8;
    const centerOffset = weekHasToday && nowOnAxis ? el.clientHeight * 0.4 : 6;
    el.scrollTop = Math.max(0, (anchorH - AXIS_START) * hourPx - centerOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hourPx, weekHasToday]);

  // Google-style booking gestures. Drag on empty grid paints a time window and
  // books it on release; DOUBLE-click books a one-hour slot; existing blocks
  // drag to move. Drag state lives in refs (mirrored to state for painting) so
  // event fields are only read synchronously — reading them inside deferred
  // React updaters crashed the page (currentTarget is null by then).
  type Sel = { di: number; a: number; b: number; moved: boolean };
  const [sel, setSel] = useState<Sel | null>(null);
  const selRef = useRef<Sel | null>(null);
  const putSel = (v: Sel | null) => {
    selRef.current = v;
    setSel(v);
  };
  const snapAt = (colTop: number, clientY: number) => {
    const raw = (clientY - colTop) / hourPx + AXIS_START;
    return Math.min(AXIS_END - 0.5, Math.max(AXIS_START, Math.floor(raw * 2) / 2));
  };
  const dateAt = (day: Date, h: number) => {
    const x = new Date(day);
    x.setHours(Math.floor(h), Math.round((h % 1) * 60), 0, 0);
    return x;
  };
  const beginCreate = (e: ReactPointerEvent<HTMLDivElement>, di: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button")) return; // an event block
    const h = snapAt(e.currentTarget.getBoundingClientRect().top, e.clientY);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* capture unsupported */ }
    putSel({ di, a: h, b: h + 0.5, moved: false });
  };
  const moveCreate = (e: ReactPointerEvent<HTMLDivElement>, di: number) => {
    const cur = selRef.current;
    if (!cur || cur.di !== di) return;
    const h = snapAt(e.currentTarget.getBoundingClientRect().top, e.clientY) + 0.5;
    const b = Math.max(cur.a + 0.5, Math.min(AXIS_END, h));
    if (b !== cur.b) putSel({ ...cur, b, moved: true });
  };
  const endCreate = (di: number, day: Date) => {
    const cur = selRef.current;
    putSel(null);
    if (!cur || cur.di !== di || !cur.moved) return; // plain clicks don't book — double-click does
    const startH = Math.min(cur.a, cur.b - 0.5);
    const endH = Math.max(cur.b, startH + 0.5);
    onCreate(dateAt(day, startH), dateAt(day, endH));
  };
  const doubleCreate = (e: React.MouseEvent<HTMLDivElement>, d: Date) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const h = snapAt(e.currentTarget.getBoundingClientRect().top, e.clientY);
    onCreate(dateAt(d, h), dateAt(d, Math.min(AXIS_END, h + 1)));
  };

  // ---- drag-to-move existing appointments ----
  // Live preview via an override map; committed through updateAppointment with
  // the block's existing details (empty fields would otherwise be nulled).
  const colRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [moveOverrides, setMoveOverrides] = useState<Record<string, { start: Date; end: Date | null }>>({});
  useEffect(() => {
    setMoveOverrides({}); // fresh server data wins once it arrives
  }, [evs]);
  const [, startMoveTransition] = useTransition();

  const resolveTarget = (clientX: number, clientY: number): { day: Date; top: number } | null => {
    for (let i = 0; i < days.length; i++) {
      const el = colRefs.current[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right) return { day: days[i], top: r.top };
    }
    return null;
  };

  const previewMove = (ev: Ev, clientX: number, clientY: number, grabOffsetH: number) => {
    const target = resolveTarget(clientX, clientY);
    if (!target) return;
    const durH = ev.endDate ? Math.max(0.5, (ev.endDate.getTime() - ev.startDate.getTime()) / 3_600_000) : 1;
    const rawStart = (clientY - target.top) / hourPx + AXIS_START - grabOffsetH;
    const startH = Math.min(AXIS_END - durH, Math.max(AXIS_START, Math.round(rawStart * 2) / 2));
    const start = dateAt(target.day, startH);
    const end = ev.endDate ? new Date(start.getTime() + (ev.endDate.getTime() - ev.startDate.getTime())) : null;
    setMoveOverrides((prev) => ({ ...prev, [ev.id]: { start, end } }));
  };

  const commitMove = (ev: Ev) => {
    const ov = moveOverridesRef.current[ev.id];
    if (!ov) return;
    const durationMin = ov.end
      ? Math.max(30, Math.round((ov.end.getTime() - ov.start.getTime()) / 60_000))
      : ev.endDate
        ? Math.max(30, Math.round((ev.endDate.getTime() - ev.startDate.getTime()) / 60_000))
        : 60;
    const fd = new FormData();
    fd.set("appointmentId", ev.id);
    fd.set("title", ev.title);
    fd.set("service", ev.service ?? "");
    fd.set("location", ev.location ?? "");
    fd.set("notes", ev.notes ?? "");
    fd.set("start", toLocalInput(ov.start));
    fd.set("duration", String(durationMin));
    startMoveTransition(async () => {
      await updateAppointment(fd);
    });
  };
  const moveOverridesRef = useRef(moveOverrides);
  moveOverridesRef.current = moveOverrides;

  // Drag the bottom edge of a block to change its length (30-min snap).
  const previewResize = (ev: Ev, clientY: number) => {
    const current = moveOverridesRef.current[ev.id];
    const start = current?.start ?? ev.startDate;
    const di = days.findIndex((d) => sameDay(d, start));
    const el = di >= 0 ? colRefs.current[di] : null;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    const startH = start.getHours() + start.getMinutes() / 60;
    let endH = Math.round(((clientY - top) / hourPx + AXIS_START) * 2) / 2;
    endH = Math.max(startH + 0.5, Math.min(AXIS_END, endH));
    const end = dateAt(start, endH);
    setMoveOverrides((prev) => ({ ...prev, [ev.id]: { start, end } }));
  };
  // Rolling 7-day outlook: today (or the navigated day) is the leftmost column.
  const weekStart = startOfDay(anchor);
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
          {days.map((d, i) => {
            const dayEvents = evs
              .map((e) => (moveOverrides[e.id] ? { ...e, startDate: moveOverrides[e.id].start, endDate: moveOverrides[e.id].end } : e))
              .filter((e) => sameDay(e.startDate, d));
            return (
              <div
                key={d.toISOString()}
                ref={(el) => { colRefs.current[i] = el; }}
                style={{ ...S.dayCol, height: totalPx }}
                onPointerDown={(e) => beginCreate(e, i)}
                onPointerMove={sel && sel.di === i ? (e) => moveCreate(e, i) : undefined}
                onPointerUp={() => endCreate(i, d)}
                onPointerCancel={() => putSel(null)}
                onDoubleClick={(e) => doubleCreate(e, d)}
              >
                {sel && sel.di === i && sel.moved && (
                  <div
                    style={{
                      ...S.selBlock,
                      top: (Math.min(sel.a, sel.b - 0.5) - AXIS_START) * hourPx,
                      height: (Math.max(sel.b, sel.a + 0.5) - Math.min(sel.a, sel.b - 0.5)) * hourPx
                    }}
                  >
                    {timeLabel(dateAt(d, Math.min(sel.a, sel.b - 0.5)))} – {timeLabel(dateAt(d, Math.max(sel.b, sel.a + 0.5)))}
                  </div>
                )}
                {weatherHours &&
                  hours.map((h) => {
                    const wx = weatherHours[hourKey(d, h)];
                    if (!wx?.bad) return null;
                    return <div key={`wx-${h}`} style={{ ...S.wxBand, top: (h - AXIS_START) * hourPx, height: hourPx }} />;
                  })}
                {weatherHours &&
                  hours.filter((h) => h % 2 === 0).map((h) => {
                    const wx = weatherHours[hourKey(d, h)];
                    if (!wx || wx.temp === null) return null;
                    const Icon = wxIcon(wx.short);
                    return (
                      <span
                        key={`stamp-${h}`}
                        style={{ ...S.wxStamp, top: (h - AXIS_START) * hourPx + 2, color: wx.bad ? "#b06f12" : "var(--muted)" }}
                      >
                        <Icon size={12} aria-hidden />
                        {wx.temp}°
                        {wx.rain !== null && wx.rain >= 30 && (
                          <span style={{ color: wx.bad ? "#b06f12" : "#3a7bd0", fontWeight: 700 }}>{wx.rain}%</span>
                        )}
                      </span>
                    );
                  })}
                {hours.map((h) => (
                  <div key={h} style={{ ...S.hourLine, top: (h - AXIS_START) * hourPx }} />
                ))}
                {sameDay(d, today) && nowOnAxis && (
                  <div style={{ ...S.nowLine, top: (nowH - AXIS_START) * hourPx }} title={`Now · ${timeLabel(now)}`}>
                    <span style={S.nowDot} />
                    <span style={S.nowTime}>{timeLabel(now)}</span>
                  </div>
                )}
                {dayEvents.map((e) => {
                  const g = blockGeom(e.startDate, e.endDate, hourPx);
                  return (
                    <EventBlock
                      key={e.id}
                      ev={e}
                      top={g.top}
                      height={g.height}
                      hourPx={hourPx}
                      onOpen={onOpen}
                      onHover={onHover}
                      onHoverLeave={onHoverLeave}
                      onPreviewMove={previewMove}
                      onPreviewResize={previewResize}
                      onCommitMove={commitMove}
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
  hourPx,
  onOpen,
  onHover,
  onHoverLeave,
  onPreviewMove,
  onPreviewResize,
  onCommitMove
}: {
  ev: Ev;
  top: number;
  height: number;
  hourPx: number;
  onOpen: (ev: Ev, mode: "view" | "edit") => void;
  onHover: (ev: Ev, rect: DOMRect) => void;
  onHoverLeave: () => void;
  onPreviewMove: (ev: Ev, clientX: number, clientY: number, grabOffsetH: number) => void;
  onPreviewResize: (ev: Ev, clientY: number) => void;
  onCommitMove: (ev: Ev) => void;
}) {
  const color = ev.serviceColor || statusColor(ev.status);
  const dimmed = ev.status === "cancelled" || ev.status === "no_show";
  // Distinguish single click (view) from double click (edit) with a short timer.
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Drag-to-move: only kicks in past a small movement threshold, so click and
  // double-click keep working. All event reads happen synchronously.
  const drag = useRef<{ mode: "move" | "resize"; startX: number; startY: number; grabOffsetH: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const onBlockPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation(); // don't start the column's create-drag
    const mode: "move" | "resize" = (e.target as HTMLElement).closest("[data-resize]") ? "resize" : "move";
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, grabOffsetH: (e.clientY - rect.top) / hourPx, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch { /* capture unsupported */ }
  };
  const onBlockPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      const threshold = d.mode === "resize" ? 3 : 6;
      if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) < threshold) return;
      d.moved = true;
      setDragging(true);
      onHoverLeave();
    }
    if (d.mode === "resize") onPreviewResize(ev, e.clientY);
    else onPreviewMove(ev, e.clientX, e.clientY, d.grabOffsetH);
  };
  const onBlockPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      setDragging(false);
      if (timer.current) clearTimeout(timer.current);
      onCommitMove(ev);
    }
  };
  const handleClick = () => {
    if (dragging) return;
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
    cursor: dragging ? "grabbing" : "pointer",
    fontFamily: "inherit",
    opacity: dimmed ? 0.5 : 1,
    touchAction: "none",
    boxShadow: dragging ? "var(--shadow-md)" : undefined,
    zIndex: dragging ? 3 : undefined
  };
  return (
    <button
      type="button"
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDouble}
      onPointerDown={onBlockPointerDown}
      onPointerMove={onBlockPointerMove}
      onPointerUp={onBlockPointerUp}
      onPointerCancel={onBlockPointerUp}
      onMouseEnter={(e) => { if (!dragging) onHover(ev, e.currentTarget.getBoundingClientRect()); }}
      onMouseLeave={onHoverLeave}
    >
      <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {timeLabel(ev.startDate)}
      </div>
      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{ev.title}</div>
      {ev.service && height >= 62 && (
        <div style={{ fontSize: 10, opacity: 0.75, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.service}</div>
      )}
      {ev.location && height >= 82 && (
        <span
          role="link"
          title={ev.location}
          onClick={(e) => {
            e.stopPropagation();
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location ?? "")}`, "_blank", "noopener");
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          style={{ display: "inline-flex", alignItems: "center", gap: 3, maxWidth: "100%", fontSize: 9.5, fontWeight: 700, color: "#2b5f9e", cursor: "pointer", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        >
          <MapPin size={10} style={{ flexShrink: 0 }} aria-hidden /> {ev.location}
        </span>
      )}
      {/* bottom grip: drag to change the appointment's length */}
      <span data-resize style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 8, cursor: "ns-resize" }} aria-hidden />
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
  wxStamp: { position: "absolute", right: 3, display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 650, zIndex: 1, background: "rgba(255,255,255,0.9)", padding: "2px 6px", borderRadius: 999, pointerEvents: "none", boxShadow: "var(--shadow-xs)" },
  bookBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 999, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", boxShadow: "0 2px 8px rgba(var(--brand-rgb),0.3)" },
  quickWhen: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--brand)", margin: "2px 0 10px" },
  qInput: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, width: "100%", boxSizing: "border-box" },
  selBlock: { position: "absolute", left: 3, right: 3, zIndex: 2, borderRadius: 8, background: "rgba(var(--brand-rgb),0.16)", border: "1.5px dashed var(--brand)", color: "#2a2a8a", fontSize: 10.5, fontWeight: 700, padding: "3px 6px", pointerEvents: "none", boxSizing: "border-box" },
  zoomWrap: { display: "inline-flex", alignItems: "center", gap: 7, padding: "0 4px" },
  zoomLabel: { fontSize: 11.5, fontWeight: 600, color: "var(--muted)" },
  zoom: { width: 96, accentColor: "var(--brand)", cursor: "ew-resize" },
  stickyHead: { position: "sticky", top: 0, zIndex: 3, background: "var(--surface)", boxShadow: "0 1px 0 var(--border)" },
  heightHandle: { position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -2, width: 56, height: 13, cursor: "ns-resize", zIndex: 4, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xs)", display: "flex", alignItems: "center", justifyContent: "center", gap: 3, touchAction: "none" },
  gripDot: { width: 3, height: 3, borderRadius: 999, background: "var(--muted)" },
  cornerHandle: { position: "absolute", right: -2, bottom: -2, width: 18, height: 18, cursor: "nwse-resize", zIndex: 4, borderRadius: "3px 3px 8px 3px", background: "repeating-linear-gradient(135deg, transparent 0 4px, var(--border-strong) 4px 6px)", opacity: 0.9, touchAction: "none" },
  hourLine: { position: "absolute", left: 0, right: 0, height: 1, background: "#f1f2f5" },
  nowLine: { position: "absolute", left: 0, right: 0, height: 2, background: "#e5484d", zIndex: 2, pointerEvents: "none", boxShadow: "0 0 4px rgba(229,72,77,0.45)" },
  nowDot: { position: "absolute", left: -4, top: -3.5, width: 9, height: 9, borderRadius: 999, background: "#e5484d", boxShadow: "0 0 0 2px #fff" },
  nowTime: { position: "absolute", right: 3, top: -15, fontSize: 9, fontWeight: 800, color: "#e5484d", background: "rgba(255,255,255,0.9)", padding: "0 4px", borderRadius: 4 },
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
