// Parses inbound customer messages for date/time confirmations so the owner
// can auto-book and so the reply composer can detect slot conflicts.
// Pure TypeScript — no DOM, usable on both server and client.

type Busy = { start: string; end: string | null };

// ---------------------------------------------------------------- day helpers
const DAY_WORDS: [RegExp, number][] = [
  [/\bsunday|sun\b/i, 0],
  [/\bmonday|mon\b/i, 1],
  [/\btuesday|tues?|tue\b/i, 2],
  [/\bwednesday|wednes|wed\b/i, 3],
  [/\bthursday|thurs?|thu\b/i, 4],
  [/\bfriday|fri\b/i, 5],
  [/\bsaturday|sat\b/i, 6]
];

function nextWeekday(dayOfWeek: number, from: Date): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

// ---------------------------------------------------------------- time helpers
function parseHhMm(text: string): { h: number; m: number } | null {
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const match = re.exec(text);
  if (!match) return null;
  let h = Number(match[1]);
  const m = match[2] ? Number(match[2]) : 0;
  const ampm = match[3]?.toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  // Ambiguous (no am/pm): treat 1–6 as PM (1pm–6pm is far more likely for service calls)
  if (!ampm && h >= 1 && h <= 6) h += 12;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function toDatetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function friendlySlotLabel(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

// ---------------------------------------------------------------- confirmation signals
// Returns true if the message reads as a positive response / time acceptance.
function hasConfirmationSignal(text: string): boolean {
  return /\b(works|perfect|sounds good|great|good for me|confirmed|yes|yep|yeah|sure|that works|i'?ll? take|book|sounds? great|that'?s? (fine|great|good|perfect|works)|see you|deal|perfect|let'?s? do|sign me up|put me down)\b/i
    .test(text);
}

// ---------------------------------------------------------------- main export

export type InboundConfirmation = {
  date: Date;
  label: string;              // "Thu, Jun 12, 10:00 AM"
  datetimeLocal: string;      // "2026-06-12T10:00"  (for input[type=datetime-local])
  isConflict: boolean;        // true when that slot is already booked
};

/**
 * Returns true if a message body appears to reference a specific slot date/time.
 * Used to find other leads who were offered the same slot when a booking is made.
 * Checks for the day-of-week name AND a matching hour reference.
 */
export function containsSlotReference(messageText: string, slotDate: Date): boolean {
  const t = messageText.toLowerCase();
  const dayNames = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  const dayName = dayNames[slotDate.getDay()];
  const h24 = slotDate.getHours();
  const h12 = h24 > 12 ? h24 - 12 : h24 === 0 ? 12 : h24;
  const ampm = h24 >= 12 ? "pm" : "am";
  const min = slotDate.getMinutes();
  const minStr = min === 0 ? "" : `:${String(min).padStart(2, "0")}`;

  const hasDayRef =
    t.includes(dayName) ||
    t.includes(dayName.slice(0, 3)); // "tue", "wed", etc.

  const hasTimeRef = [
    `${h12}${ampm}`,
    `${h12} ${ampm}`,
    `${h12}:00`,
    `${h12}${minStr}`,
    // formatted slot label style: "2:00 PM", "10:00 AM"
    `${h12}:${String(min).padStart(2, "0")} ${ampm.toUpperCase()}`,
    `${h12}:00 ${ampm.toUpperCase()}`
  ].some((p) => t.includes(p));

  return hasDayRef && hasTimeRef;
}

/**
 * Tries to parse a customer's inbound message as a date/time confirmation.
 * Returns null when no confirmation signal or no recognisable date/time.
 * Pass `busy` (current appointments) so conflict detection can run immediately.
 */
export function parseInboundConfirmation(
  text: string,
  busy: Busy[],
  now: Date = new Date()
): InboundConfirmation | null {
  if (!hasConfirmationSignal(text)) return null;

  const hasExplicitTime = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(text);
  const hasDayWord = DAY_WORDS.some(([re]) => re.test(text));
  const hasTomorrow = /\btomorrow\b/i.test(text);

  // Need at least a day cue or an explicit time to do anything useful
  if (!hasExplicitTime && !hasDayWord && !hasTomorrow) return null;

  // Resolve the date part
  let date = new Date(now);
  if (hasTomorrow) {
    date.setDate(date.getDate() + 1);
  } else {
    for (const [re, dayNum] of DAY_WORDS) {
      if (re.test(text)) {
        date = nextWeekday(dayNum, now);
        break;
      }
    }
  }

  // Resolve the time part (default 10am if only day given)
  const t = parseHhMm(text);
  date.setHours(t ? t.h : 10, t ? t.m : 0, 0, 0);

  // Conflict check: does any existing appointment overlap this 2-hour slot?
  const startMs = date.getTime();
  const endMs = startMs + 2 * 3_600_000;
  const isConflict = busy.some(({ start, end }) => {
    const bs = new Date(start).getTime();
    const be = end ? new Date(end).getTime() : bs + 3_600_000;
    return bs < endMs && be > startMs;
  });

  return {
    date,
    label: friendlySlotLabel(date),
    datetimeLocal: toDatetimeLocal(date),
    isConflict
  };
}
