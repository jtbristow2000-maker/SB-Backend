import type { BusinessHoursSettings } from "@/server/business/settings";
import type { AppointmentRow } from "@/server/db/schema";

export type BusyInterval = {
  start: string;
  end: string | null;
};

const JOB_HOURS = 2;
const SLOT_LEN_MS = JOB_HOURS * 60 * 60 * 1000;
const DEFAULT_MAX_SLOTS = 2;

export function suggestOpenSlots(input: {
  appointments: AppointmentRow[] | BusyInterval[];
  businessId: string;
  hours: BusinessHoursSettings;
  requestedDatetime?: string | null;
  now?: Date;
  maxSlots?: number;
}): string[] {
  const intervals = input.appointments
    .filter((appointment) => !("business_id" in appointment) || appointment.business_id === input.businessId)
    .map((appointment) => {
      const start = new Date(
        "scheduled_start_at" in appointment ? appointment.scheduled_start_at : appointment.start
      ).getTime();
      const end = new Date(
        ("scheduled_end_at" in appointment ? appointment.scheduled_end_at : appointment.end) ??
          new Date(start + 60 * 60 * 1000).toISOString()
      ).getTime();
      return [start, end] as const;
    })
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start);
  const slotHours = candidateHours(input.hours);
  const workDays = input.hours.days?.length ? input.hours.days : [0, 1, 2, 3, 4, 5, 6];
  const out: string[] = [];
  const base = startOfDay(input.now ?? new Date());
  const startOffset = startOffsetFor(input.requestedDatetime ?? "");
  const maxSlots = input.maxSlots ?? DEFAULT_MAX_SLOTS;

  for (let offset = startOffset; offset <= startOffset + 24 && out.length < maxSlots; offset += 1) {
    const day = addDays(base, offset);
    if (!workDays.includes(day.getDay())) {
      continue;
    }

    for (const hour of slotHours) {
      if (out.length >= maxSlots) {
        break;
      }

      const start = new Date(day);
      start.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
      const startMs = start.getTime();
      const endMs = startMs + SLOT_LEN_MS;
      if (!intervals.some(([busyStart, busyEnd]) => busyStart < endMs && busyEnd > startMs)) {
        out.push(formatSlot(start));
      }
    }
  }

  return out;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseHour(hhmm: string, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) {
    return fallback;
  }

  const hour = Number(match[1]) + Number(match[2]) / 60;
  return Number.isFinite(hour) ? hour : fallback;
}

function candidateHours(hours: BusinessHoursSettings): number[] {
  const openHour = parseHour(hours.open, 9);
  const closeHour = parseHour(hours.close, 17);
  const latestStart = Math.max(openHour, closeHour - JOB_HOURS);
  const clamp = (hour: number) => Math.min(Math.max(hour, openHour), latestStart);
  const picks = [clamp(openHour + 1), clamp(14)];
  return picks.filter((hour, index) => picks.indexOf(hour) === index);
}

function startOffsetFor(requested: string): number {
  const text = requested.toLowerCase();
  if (/next week/.test(text)) {
    return 7;
  }

  if (/tomorrow/.test(text)) {
    return 1;
  }

  return 1;
}

function formatSlot(date: Date): string {
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}
