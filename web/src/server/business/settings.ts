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
  price_type?: string; // "range" (default, low–high) | "varies" (no fixed price, quoted on site)
};

export type AiReplySettings = {
  ai_pick_enabled: boolean;  // auto-match services from voicemail; false = owner picks manually
  sign_off: string;          // overrides business name at end of replies (e.g. "Mike")
  custom_note: string;       // appended to every draft (e.g. "Ask about our monthly plan!")
  formality: number;         // 0–4  (0 = professional, 4 = casual/relaxed)  default 2
  warmth: number;            // 0–4  (0 = brief/direct,  4 = warm/friendly)   default 2
  quote_style: string;       // "total" (default) | "itemized" — how multi-service quotes read
};

export type BusinessSettings = {
  brand_color: string;
  auto_text_message: string;
  business_hours: BusinessHoursSettings;
  quote_ranges: QuoteRangeSettings[];
  ai_reply: AiReplySettings;
};

export type BusinessSettingsUpdate = {
  brand_color?: string;
  auto_text_message?: string;
  business_hours?: Partial<BusinessHoursSettings>;
  quote_ranges?: QuoteRangeSettings[];
  ai_reply?: Partial<AiReplySettings>;
};

export const DEFAULT_MISSED_CALL_AUTO_TEXT =
  "Sorry we missed your call \u2014 reply here and we'll get right back to you. \u2014 {business_name}";

export const DEFAULT_AI_REPLY_SETTINGS: AiReplySettings = {
  ai_pick_enabled: true,
  sign_off: "",
  custom_note: "",
  formality: 2,
  warmth: 2,
  quote_style: "total"
};

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  brand_color: "#5b5bd6",
  auto_text_message: DEFAULT_MISSED_CALL_AUTO_TEXT,
  business_hours: {
    open: "09:00",
    close: "17:00",
    days: [1, 2, 3, 4, 5]
  },
  quote_ranges: [],
  ai_reply: DEFAULT_AI_REPLY_SETTINGS
};

type JsonObject = { [key: string]: JsonValue };

export function getBusinessSettings(
  business: Pick<BusinessRow, "settings_json"> | null | undefined
): BusinessSettings {
  const raw = asJsonObject(business?.settings_json);

  return {
    brand_color: readHexColor(raw.brand_color) ?? DEFAULT_BUSINESS_SETTINGS.brand_color,
    auto_text_message:
      readNonEmptyString(raw.auto_text_message) ??
      readNonEmptyString(raw.missed_call_auto_text) ??
      DEFAULT_BUSINESS_SETTINGS.auto_text_message,
    business_hours: readBusinessHours(raw.business_hours),
    quote_ranges: readQuoteRanges(raw.quote_ranges),
    ai_reply: readAiReplySettings(raw.ai_reply)
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

  if (partial.auto_text_message !== undefined) {
    merged.auto_text_message = partial.auto_text_message;
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

  if (partial.quote_ranges !== undefined) {
    merged.quote_ranges = partial.quote_ranges.map((range) => ({
      service: range.service,
      low: range.low,
      high: range.high,
      color: range.color ?? "#5b5bd6",
      on_calendar: range.on_calendar !== false,
      price_type: range.price_type === "varies" ? "varies" : "range"
    }));
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
      ...(u.quote_style !== undefined ? { quote_style: u.quote_style } : {})
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
  if ((substringMatch.price_type ?? "range") === "varies") return null;
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
    const price_type = raw.price_type === "varies" ? "varies" : "range";
    out.push({ service, low: raw.low, high: raw.high, color, on_calendar, price_type });
  }
  return out;
}

function normalizeServiceName(service: string | null | undefined): string | null {
  const normalized = service?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function quoteRangePriceLabel(range: QuoteRangeSettings): string {
  return range.high > range.low
    ? `${formatUsd(range.low)}\u2013${formatUsd(range.high)}`
    : formatUsd(range.low);
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
    quote_style: raw.quote_style === "itemized" ? "itemized" : "total"
  };
}

function readSlider(value: JsonValue | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  if (!Number.isFinite(n)) return 2;
  return Math.min(4, Math.max(0, Math.round(n)));
}
