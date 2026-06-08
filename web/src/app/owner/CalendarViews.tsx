"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";

import { deleteAppointment, setAppointmentStatus, updateAppointment } from "@/app/owner/actions";
import { fmtPhone } from "@/app/owner/format";

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

export function CalendarViews({ events, legend = [] }: { events: CalendarEvent[]; legend?: { service: string; color: string }[] }) {
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<Selection | null>(null);
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
        {view !== "agenda" && (
          <div style={S.nav}>
            <button type="button" onClick={() => go(-1)} disabled={!canGoBack} style={{ ...S.navBtn, opacity: canGoBack ? 1 : 0.35, cursor: canGoBack ? "pointer" : "default" }} aria-label="Previous">‹</button>
            <button type="button" onClick={() => setAnchor(new Date())} style={S.navToday}>Today</button>
            <button type="button" onClick={() => go(1)} style={S.navBtn} aria-label="Next">›</button>
          </div>
        )}
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

      {view === "week" && (
        <WeekView anchor={anchor} evs={evs} onOpen={openEvent} onHover={showHover} onHoverLeave={queueHideHover} />
      )}
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
      {view === "agenda" && <AgendaView evs={evs} onOpen={openEvent} />}

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
  onOpen,
  onHover,
  onHoverLeave
}: {
  anchor: Date;
  evs: Ev[];
  onOpen: (ev: Ev, mode: "view" | "edit") => void;
  onHover: (ev: Ev, rect: DOMRect) => void;
  onHoverLeave: () => void;
}) {
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

function AgendaView({ evs, onOpen }: { evs: Ev[]; onOpen: (ev: Ev, mode: "view" | "edit") => void }) {
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
                {e.priceLabel ? <div style={S.agendaWho}>{e.priceLabel}{e.location ? " · 📍" : ""}</div> : null}
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
        🗓 {ev.startDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} ·{" "}
        {timeLabel(ev.startDate)}{ev.endDate ? `–${timeLabel(ev.endDate)}` : ""}
      </div>
      <div style={S.hoverRow}>
        <span style={{ ...S.statusPill, background: `${color}1f`, color }}>{ev.status.replace("_", " ")}</span>
      </div>
      {ev.priceLabel && <div style={S.hoverRow}>💰 {ev.priceLabel}{ev.service ? ` · ${ev.service}` : ""}</div>}
      {ev.location && (
        <div style={S.hoverRow}>
          📍 {ev.location}
          {mapsHref && <> · <a href={mapsHref} target="_blank" rel="noreferrer" style={S.mapLink}>Maps ↗</a></>}
        </div>
      )}
      {ev.notes && <div style={{ ...S.hoverRow, whiteSpace: "pre-line" }}>📝 {ev.notes}</div>}
      {ev.who && <div style={S.hoverRow}>👤 {ev.who}</div>}
      {ev.phone && (
        <div style={S.hoverRow}>📞 <a href={`tel:${ev.phone}`} style={S.mapLink}>{fmtPhone(ev.phone)}</a></div>
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
          <button type="button" onClick={onClose} style={S.modalClose} aria-label="Close">✕</button>
        </div>

        {mode === "view" ? (
          <div style={S.modalBody}>
            <div style={S.detailRow}><span style={S.detailIcon}>🗓</span><span>{dateLabel} · {timeRange}</span></div>
            <div style={S.detailRow}>
              <span style={S.detailIcon}>🏷</span>
              <span style={{ ...S.statusPill, background: `${color}1f`, color }}>{ev.status.replace("_", " ")}</span>
            </div>
            {ev.priceLabel && (
              <div style={S.detailRow}>
                <span style={S.detailIcon}>💰</span>
                <span><strong>{ev.priceLabel}</strong>{ev.service ? ` · ${ev.service}` : ""}</span>
              </div>
            )}
            <div style={S.detailRow}>
              <span style={S.detailIcon}>📍</span>
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
              <span style={S.detailIcon}>📝</span>
              {ev.notes ? <span style={{ whiteSpace: "pre-line" }}>{ev.notes}</span> : <span style={S.muted}>No notes</span>}
            </div>
            {ev.who && <div style={S.detailRow}><span style={S.detailIcon}>👤</span><span>{ev.who}</span></div>}
            {ev.phone && (
              <div style={S.detailRow}>
                <span style={S.detailIcon}>📞</span>
                <span><a href={`tel:${ev.phone}`} style={S.mapLink}>{fmtPhone(ev.phone)}</a></span>
              </div>
            )}

            <div style={S.modalActions}>
              <button type="button" onClick={onEdit} style={S.btnPrimary}>✎ Edit</button>
              {ev.customerProfileId && <Link href={`/owner/${ev.customerProfileId}`} style={S.btnGhost}>Open lead</Link>}
              {ev.phone && <a href={`tel:${ev.phone}`} style={S.btnGhost}>📞 Call</a>}
              <button
                type="button"
                onClick={() => (confirmDel ? onDelete(ev) : setConfirmDel(true))}
                style={S.btnDanger}
              >
                {confirmDel ? "Tap again to confirm" : "🗑 Delete"}
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
  legend: { display: "flex", flexWrap: "wrap", gap: 12, margin: "0 0 12px", fontSize: 12, color: "#3c414b" },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  legendDot: { width: 11, height: 11, borderRadius: 3, display: "inline-block", flexShrink: 0 },
  weekScroll: { overflowX: "auto", border: "1px solid var(--border)", borderRadius: 14, background: "var(--surface)", boxShadow: "var(--shadow-sm)" },
  weekInner: { minWidth: 724 },
  weekRow: { display: "flex" },
  axisCol: { flex: "0 0 52px", width: 52 },
  axisHour: { height: HOUR_PX, fontSize: 10, color: "#8a909c", textAlign: "right", paddingRight: 6, transform: "translateY(-6px)" },
  dayHeaderNum: { fontSize: 15, fontWeight: 700, color: "var(--ink)" },
  dayCol: { flex: "1 0 96px", position: "relative", height: TOTAL_PX, borderLeft: "1px solid var(--border)" },
  hourLine: { position: "absolute", left: 0, right: 0, height: 1, background: "#f1f2f5" },
  monthDow: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginTop: 4 },
  monthDowCell: { textAlign: "center", fontSize: 11, fontWeight: 700, color: "#8a909c", padding: "4px 0" },
  monthGrid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 },
  monthDayNum: { fontSize: 12, fontWeight: 700, marginBottom: 2 },
  monthChip: { fontSize: 9, padding: "1px 3px", borderRadius: 3, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#1e2026" },
  monthMore: { fontSize: 9, color: "#8a909c" },
  empty: { marginTop: 16, padding: "22px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", textAlign: "center", color: "var(--muted)" },
  agendaDay: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "#8a909c", textTransform: "uppercase", margin: "6px 0 8px" },
  agendaItem: { display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", marginBottom: 8, borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" },
  agendaTime: { fontSize: 13, fontWeight: 700, color: "var(--ink)", minWidth: 62 },
  agendaEnd: { fontSize: 11, fontWeight: 400, color: "#8a909c" },
  agendaWho: { fontSize: 13, color: "#3c414b", marginTop: 2 },
  miniSelect: { padding: "4px 6px", borderRadius: 7, border: "1px solid #d8dce3", fontSize: 11, background: "#fff" },
  miniBtn: { padding: "4px 8px", borderRadius: 7, border: "none", background: "#eceef2", color: "#1e2026", fontWeight: 600, fontSize: 11, cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(17,21,28,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 },
  modal: { background: "#fff", borderRadius: 16, width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", boxShadow: "var(--shadow-lg)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "#fff" },
  modalClose: { border: "none", background: "transparent", fontSize: 16, cursor: "pointer", color: "#8a909c", lineHeight: 1 },
  modalBody: { display: "flex", flexDirection: "column", gap: 12, padding: 16 },
  detailRow: { display: "flex", gap: 10, fontSize: 14, color: "#1e2026", alignItems: "flex-start", lineHeight: 1.45 },
  detailIcon: { width: 20, flexShrink: 0, textAlign: "center" },
  statusPill: { fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999, textTransform: "capitalize" },
  mapLink: { color: "var(--brand)", fontWeight: 600, textDecoration: "none" },
  muted: { color: "#8a909c" },
  modalActions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 },
  btnPrimary: { display: "inline-block", padding: "10px 14px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", textDecoration: "none", textAlign: "center" },
  btnGhost: { display: "inline-block", padding: "10px 14px", borderRadius: 10, border: "1px solid #d8dce3", background: "#fff", color: "#1e2026", fontWeight: 600, fontSize: 14, cursor: "pointer", textDecoration: "none", textAlign: "center" },
  formLabel: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 700, color: "#3c414b" },
  input: { padding: "9px 11px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit" },
  textarea: { padding: "9px 11px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  btnDanger: { display: "inline-block", padding: "10px 14px", borderRadius: 10, border: "1px solid #f1c4c4", background: "#fff", color: "#b23b3b", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  hoverCard: { position: "fixed", width: 272, maxWidth: "calc(100vw - 16px)", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: "10px 12px", fontSize: 12, lineHeight: 1.45, color: "#1e2026", zIndex: 900 },
  hoverRow: { marginTop: 3 },
  hoverHint: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #f1f2f5", fontSize: 11, color: "#8a909c" }
};
