import type { BusinessRow, JsonValue } from "@/server/db/schema";

export type BusinessHoursSettings = {
  open: string;
  close: string;
  days: number[];
};

export type QuoteRangeSettings = {
  service: string;
  low: number;
  high: number;
  color?: string;
  on_calendar?: boolean;
  duration_minutes?: number; // how long this job takes; drives how many time slots fit. Unset = default.
};

// Weekly targets the owner sets on the Stats screen. 0 = no goal set.
export type GoalsSettings = {
  weekly_calls: number;
  weekly_leads: number;
  weekly_booked: number;
};

export type AiReplySettings = {
  ai_pick_enabled: boolean;  // auto-match services from voicemail; false = owner picks manually
  sign_off: string;          // overrides business name at end of replies (e.g. "Mike")
  custom_note: string;       // appended to every draft (e.g. "Ask about our monthly plan!")
  formality: number;         // 0–4  (0 = professional, 4 = casual/relaxed)  default 2
  warmth: number;            // 0–4  (0 = brief/direct,  4 = warm/friendly)   default 2
  quote_style: string;       // "total" (default) | "itemized" — how multi-service quotes read
  auto_reply_level: number;  // 0 off/template · 1 personal · 2 assistant · 3 full-auto
};

export type BusinessSettings = {
  brand_color: string;
  logo_url: string;
  auto_text_message: string;
  auto_text_delay_seconds: number; // seconds to wait before the missed-call auto-text fires (0 = instant)
  voicemail_greeting: string;
  forward_calls: boolean;
  business_hours: BusinessHoursSettings;
  travel_buffer_minutes: number; // padding kept around booked jobs so back-to-back slots leave drive time
  quote_ranges: QuoteRangeSettings[];
  ai_reply: AiReplySettings;
  goals: GoalsSettings;
};

export type BusinessSettingsUpdate = {
  brand_color?: string;
  logo_url?: string;
  auto_text_message?: string;
  auto_text_delay_seconds?: number;
  voicemail_greeting?: string;
  forward_calls?: boolean;
  business_hours?: Partial<BusinessHoursSettings>;
  travel_buffer_minutes?: number;
  quote_ranges?: QuoteRangeSettings[];
  ai_reply?: Partial<AiReplySettings>;
  goals?: Partial<GoalsSettings>;
};

export const DEFAULT_MISSED_CALL_AUTO_TEXT =
  "Sorry we missed your call \u2014 reply here and we'll get right back to you. \u2014 {business_name}";

// Spoken to callers before they leave a voicemail (Twilio <Say>). Empty setting =
// use this. Shared so the Settings placeholder and the server TwiML agree.
export const DEFAULT_VOICEMAIL_GREETING =
  "Sorry we missed your call. Please leave a message after the beep.";

// Fallback job length (minutes) for a service with no duration set, and the
// default drive-time padding between jobs. Shared so the reply composer and the
// Settings UI agree on the numbers.
export const DEFAULT_SERVICE_MINUTES = 120;
export const DEFAULT_TRAVEL_BUFFER_MINUTES = 30;

// Seconds to wait before sending the missed-call auto-text. A short delay feels
// less robotic without losing the speed-to-lead benefit. 0 = send instantly.
export const DEFAULT_AUTO_TEXT_DELAY_SECONDS = 10;

export const DEFAULT_GOALS_SETTINGS: GoalsSettings = {
  weekly_calls: 0,
  weekly_leads: 0,
  weekly_booked: 0
};

export const DEFAULT_AI_REPLY_SETTINGS: AiReplySettings = {
  ai_pick_enabled: true,
  sign_off: "",
  custom_note: "",
  formality: 2,
  warmth: 2,
  quote_style: "total",
  auto_reply_level: 0
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  brand_color: "#5b5bd6",
  logo_url: "",
  auto_text_message: DEFAULT_MISSED_CALL_AUTO_TEXT,
  auto_text_delay_seconds: DEFAULT_AUTO_TEXT_DELAY_SECONDS,
  voicemail_greeting: "",
  forward_calls: true,
  business_hours: {
    open: "09:00",
    close: "17:00",
    days: [1, 2, 3, 4, 5]
  },
  travel_buffer_minutes: DEFAULT_TRAVEL_BUFFER_MINUTES,
  quote_ranges: [],
  ai_reply: DEFAULT_AI_REPLY_SETTINGS,
  goals: DEFAULT_GOALS_SETTINGS
};

type JsonObject = { [key: string]: JsonValue };

export function getBusinessSettings(
  business: Pick<BusinessRow, "settings_json"> | null | undefined
): BusinessSettings {
  const raw = asJsonObject(business?.settings_json);

  return {
    brand_color: readHexColor(raw.brand_color) ?? DEFAULT_BUSINESS_SETTINGS.brand_color,
    logo_url: typeof raw.logo_url === "string" ? raw.logo_url.trim() : DEFAULT_BUSINESS_SETTINGS.logo_url,
    auto_text_message:
      readNonEmptyString(raw.auto_text_message) ??
      readNonEmptyString(raw.missed_call_auto_text) ??
      DEFAULT_BUSINESS_SETTINGS.auto_text_message,
    auto_text_delay_seconds: readAutoTextDelay(raw.auto_text_delay_seconds),
    voicemail_greeting:
      typeof raw.voicemail_greeting === "string"
        ? raw.voicemail_greeting.trim()
        : DEFAULT_BUSINESS_SETTINGS.voicemail_greeting,
    forward_calls:
      typeof raw.forward_calls === "boolean" ? raw.forward_calls : DEFAULT_BUSINESS_SETTINGS.forward_calls,
    business_hours: readBusinessHours(raw.business_hours),
    travel_buffer_minutes: readTravelBuffer(raw.travel_buffer_minutes),
    quote_ranges: readQuoteRanges(raw.quote_ranges),
    ai_reply: readAiReplySettings(raw.ai_reply),
    goals: readGoals(raw.goals)
  };
}

export function mergeBusinessSettingsJson(
  existing: JsonValue,
  partial: BusinessSettingsUpdate
): JsonValue {
  const merged: JsonObject = { ...asJsonObject(existing) };

  if (partial.brand_color !== undefined) {
    merged.brand_color = partial.brand_color;
  }
  if (partial.logo_url !== undefined) {
    merged.logo_url = partial.logo_url;
  }

  if (partial.auto_text_message !== undefined) {
    merged.auto_text_message = partial.auto_text_message;
  }

  if (partial.auto_text_delay_seconds !== undefined) {
    merged.auto_text_delay_seconds = partial.auto_text_delay_seconds;
  }

  if (partial.voicemail_greeting !== undefined) {
    merged.voicemail_greeting = partial.voicemail_greeting;
  }

  if (partial.forward_calls !== undefined) {
    merged.forward_calls = partial.forward_calls;
  }

  if (partial.business_hours !== undefined) {
    const hours: JsonObject = { ...asJsonObject(merged.business_hours) };
    if (partial.business_hours.open !== undefined) {
      hours.open = partial.business_hours.open;
    }
    if (partial.business_hours.close !== undefined) {
      hours.close = partial.business_hours.close;
    }
    if (partial.business_hours.days !== undefined) {
      hours.days = [...partial.business_hours.days];
    }
    merged.business_hours = hours;
  }

  if (partial.travel_buffer_minutes !== undefined) {
    merged.travel_buffer_minutes = partial.travel_buffer_minutes;
  }

  if (partial.quote_ranges !== undefined) {
    merged.quote_ranges = partial.quote_ranges.map((range) => ({
      service: range.service,
      low: range.low,
      high: range.high,
      color: range.color ?? "#5b5bd6",
      on_calendar: range.on_calendar !== false,
      ...(typeof range.duration_minutes === "number" && range.duration_minutes > 0
        ? { duration_minutes: range.duration_minutes }
        : {})
    }));
  }

  if (partial.goals !== undefined) {
    const existingGoals = asJsonObject(merged.goals);
    const g = partial.goals;
    merged.goals = {
      ...existingGoals,
      ...(g.weekly_calls !== undefined ? { weekly_calls: g.weekly_calls } : {}),
      ...(g.weekly_leads !== undefined ? { weekly_leads: g.weekly_leads } : {}),
      ...(g.weekly_booked !== undefined ? { weekly_booked: g.weekly_booked } : {})
    };
  }

  if (partial.ai_reply !== undefined) {
    const existingAi = asJsonObject(merged.ai_reply);
    const u = partial.ai_reply;
    merged.ai_reply = {
      ...existingAi,
      ...(u.ai_pick_enabled !== undefined ? { ai_pick_enabled: u.ai_pick_enabled } : {}),
      ...(u.sign_off !== undefined ? { sign_off: u.sign_off } : {}),
      ...(u.custom_note !== undefined ? { custom_note: u.custom_note } : {}),
      ...(u.formality !== undefined ? { formality: u.formality } : {}),
      ...(u.warmth !== undefined ? { warmth: u.warmth } : {}),
      ...(u.quote_style !== undefined ? { quote_style: u.quote_style } : {}),
      ...(u.auto_reply_level !== undefined ? { auto_reply_level: u.auto_reply_level } : {})
    };
  }

  return merged;
}

export function quotePriceLabel(
  service: string | null,
  ranges: QuoteRangeSettings[]
): string | null {
  const normalizedService = normalizeServiceName(service);
  if (!normalizedService || ranges.length === 0) {
    return null;
  }

  const exactMatch = ranges.find(
    (range) => normalizeServiceName(range.service) === normalizedService
  );
  const substringMatch =
    exactMatch ??
    ranges.find((range) => {
      const normalizedRangeService = normalizeServiceName(range.service);
      return (
        normalizedRangeService !== null &&
        (normalizedService.includes(normalizedRangeService) ||
          normalizedRangeService.includes(normalizedService))
      );
    });

  if (!substringMatch) return null;
  // No price entered (both blank/zero) → quote on site, so no label.
  if ((substringMatch.low ?? 0) <= 0 && (substringMatch.high ?? 0) <= 0) return null;
  return quoteRangePriceLabel(substringMatch);
}

const SERVICE_PALETTE = [
  "#5b5bd6", "#16a34a", "#ea580c", "#0ea5e9", "#db2777",
  "#ca8a04", "#0d9488", "#7c3aed", "#dc2626", "#2563eb"
];

export function defaultServiceColor(index: number): string {
  const len = SERVICE_PALETTE.length;
  return SERVICE_PALETTE[((index % len) + len) % len];
}

// Matches an appointment's service to a configured quote range and returns its
// color, so the calendar can colour-code jobs by type. Falls back to the brand.
export function quoteServiceColor(
  service: string | null,
  ranges: QuoteRangeSettings[],
  fallback = "#5b5bd6"
): string {
  const normalizedService = normalizeServiceName(service);
  if (!normalizedService || ranges.length === 0) return fallback;
  const exact = ranges.find((r) => normalizeServiceName(r.service) === normalizedService);
  const match =
    exact ??
    ranges.find((r) => {
      const rs = normalizeServiceName(r.service);
      return rs !== null && (normalizedService.includes(rs) || rs.includes(normalizedService));
    });
  return match?.color ?? fallback;
}

// True unless the appointment's service matches a quote range explicitly flagged
// off-calendar (e.g. add-ons), so the calendar can skip non-standalone jobs.
export function isServiceOnCalendar(service: string | null, ranges: QuoteRangeSettings[]): boolean {
  const normalizedService = normalizeServiceName(service);
  if (!normalizedService || ranges.length === 0) return true;
  const exact = ranges.find((r) => normalizeServiceName(r.service) === normalizedService);
  const match =
    exact ??
    ranges.find((r) => {
      const rs = normalizeServiceName(r.service);
      return rs !== null && (normalizedService.includes(rs) || rs.includes(normalizedService));
    });
  return match ? match.on_calendar !== false : true;
}

function asJsonObject(value: JsonValue | undefined): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : {};
}

function readNonEmptyString(value: JsonValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readHexColor(value: JsonValue | undefined): string | null {
  const text = readNonEmptyString(value);
  return text && /^#[0-9a-f]{6}$/i.test(text) ? text : null;
}

function readBusinessHours(value: JsonValue | undefined): BusinessHoursSettings {
  const raw = asJsonObject(value);
  const days =
    Array.isArray(raw.days)
      ? raw.days.filter(
          (day): day is number =>
            typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6
        )
      : DEFAULT_BUSINESS_SETTINGS.business_hours.days;

  return {
    open: readNonEmptyString(raw.open) ?? DEFAULT_BUSINESS_SETTINGS.business_hours.open,
    close: readNonEmptyString(raw.close) ?? DEFAULT_BUSINESS_SETTINGS.business_hours.close,
    days: days.length ? days : DEFAULT_BUSINESS_SETTINGS.business_hours.days
  };
}

function readQuoteRanges(value: JsonValue | undefined): QuoteRangeSettings[] {
  if (!Array.isArray(value)) {
    return DEFAULT_BUSINESS_SETTINGS.quote_ranges;
  }

  const out: QuoteRangeSettings[] = [];
  for (const entry of value) {
    const raw = asJsonObject(entry);
    const service = readNonEmptyString(raw.service);
    if (!service || typeof raw.low !== "number" || typeof raw.high !== "number") continue;
    if (!Number.isFinite(raw.low) || !Number.isFinite(raw.high)) continue;
    const color = readHexColor(raw.color) ?? defaultServiceColor(out.length);
    const on_calendar = typeof raw.on_calendar === "boolean" ? raw.on_calendar : true;
    const duration_minutes = readDurationMinutes(raw.duration_minutes);
    out.push({
      service,
      low: raw.low,
      high: raw.high,
      color,
      on_calendar,
      ...(duration_minutes !== undefined ? { duration_minutes } : {})
    });
  }
  return out;
}

// A service's job length, clamped to a sane window (15 min – 12 hr). Returns
// undefined when nothing valid is stored, so callers fall back to the default.
function readDurationMinutes(value: JsonValue | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return undefined;
  return Math.min(720, Math.max(15, Math.round(value)));
}

// Drive-time padding between jobs, clamped to 0–4 hr. Default when unset.
function readTravelBuffer(value: JsonValue | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return DEFAULT_TRAVEL_BUFFER_MINUTES;
  }
  return Math.min(240, Math.round(value));
}

// Weekly goal targets, clamped 0–999 (0 = no goal set).
function readGoals(value: JsonValue | undefined): GoalsSettings {
  const raw = asJsonObject(value);
  const read = (v: JsonValue | undefined): number =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.min(999, Math.round(v)) : 0;
  return {
    weekly_calls: read(raw.weekly_calls),
    weekly_leads: read(raw.weekly_leads),
    weekly_booked: read(raw.weekly_booked)
  };
}

// Delay (seconds) before the missed-call auto-text fires, clamped 0–300. 0 = instant.
function readAutoTextDelay(value: JsonValue | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return DEFAULT_AUTO_TEXT_DELAY_SECONDS;
  }
  return Math.min(300, Math.round(value));
}

function normalizeServiceName(service: string | null | undefined): string | null {
  const normalized = service?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function quoteRangePriceLabel(range: QuoteRangeSettings): string {
  const low = range.low > 0 ? range.low : 0;
  const high = range.high > 0 ? range.high : 0;
  if (low > 0 && high > 0) {
    return high > low ? `${formatUsd(low)}\u2013${formatUsd(high)}` : formatUsd(low);
  }
  return formatUsd(low > 0 ? low : high);
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

function readAiReplySettings(value: JsonValue | undefined): AiReplySettings {
  const raw = asJsonObject(value);
  return {
    ai_pick_enabled: typeof raw.ai_pick_enabled === "boolean" ? raw.ai_pick_enabled : DEFAULT_AI_REPLY_SETTINGS.ai_pick_enabled,
    sign_off: typeof raw.sign_off === "string" ? raw.sign_off.trim() : DEFAULT_AI_REPLY_SETTINGS.sign_off,
    custom_note: typeof raw.custom_note === "string" ? raw.custom_note.trim() : DEFAULT_AI_REPLY_SETTINGS.custom_note,
    formality: readSlider(raw.formality),
    warmth: readSlider(raw.warmth),
    quote_style: raw.quote_style === "itemized" ? "itemized" : "total",
    auto_reply_level: typeof raw.auto_reply_level === "number" ? Math.min(3, Math.max(0, Math.round(raw.auto_reply_level))) : 0
  };
}

function readSlider(value: JsonValue | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return 2;
  return Math.min(4, Math.max(0, Math.round(n)));
}
