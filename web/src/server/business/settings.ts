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
};

export type BusinessSettings = {
  brand_color: string;
  auto_text_message: string;
  business_hours: BusinessHoursSettings;
  quote_ranges: QuoteRangeSettings[];
};

export type BusinessSettingsUpdate = {
  brand_color?: string;
  auto_text_message?: string;
  business_hours?: Partial<BusinessHoursSettings>;
  quote_ranges?: QuoteRangeSettings[];
};

export const DEFAULT_MISSED_CALL_AUTO_TEXT =
  "Sorry we missed your call \u2014 reply here and we'll get right back to you. \u2014 {business_name}";

export const DEFAULT_BUSINESS_SETTINGS: BusinessSettings = {
  brand_color: "#5b5bd6",
  auto_text_message: DEFAULT_MISSED_CALL_AUTO_TEXT,
  business_hours: {
    open: "09:00",
    close: "17:00",
    days: [1, 2, 3, 4, 5]
  },
  quote_ranges: []
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
    quote_ranges: readQuoteRanges(raw.quote_ranges)
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
      high: range.high
    }));
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

  return substringMatch ? quoteRangePriceLabel(substringMatch) : null;
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

  return value.flatMap((entry) => {
    const raw = asJsonObject(entry);
    const service = readNonEmptyString(raw.service);
    if (!service || typeof raw.low !== "number" || typeof raw.high !== "number") {
      return [];
    }

    return Number.isFinite(raw.low) && Number.isFinite(raw.high)
      ? [{ service, low: raw.low, high: raw.high }]
      : [];
  });
}

function normalizeServiceName(service: string | null | undefined): string | null {
  const normalized = service?.trim().toLowerCase();
  return normalized ? normalized : null;
}

function quoteRangePriceLabel(range: QuoteRangeSettings): string {
  return range.low === range.high
    ? formatUsd(range.low)
    : `${formatUsd(range.low)}\u2013${formatUsd(range.high)}`;
}

function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}
