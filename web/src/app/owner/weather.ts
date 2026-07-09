import type { WeatherSettings } from "@/server/business/settings";

// Free live forecast for the owner's area, keyed by local calendar day.
// Pipeline: zip → lat/lon (zippopotam.us) → NWS gridpoint → 7-day forecast
// (api.weather.gov — the National Weather Service; free, no API key, US-only).
// Each day gets a `bad` flag judged against the owner's weather cutoffs, so the
// calendar and the reply composer can steer bookings away from bad-weather days.
// Server-side only (called from server components); any failure returns {} and
// the app simply renders without weather.

export type DayWeather = {
  hi: number | null;      // daytime high °F
  lo: number | null;      // overnight low °F
  rain: number | null;    // chance of precipitation % (max of day/night)
  short: string;          // e.g. "Partly Sunny", "Rain Showers"
  bad: boolean;           // outside the owner's workable-weather window
  reason: string | null;  // plain-words why (e.g. "70% rain", "34° — too cold")
};

export type HourWeather = {
  temp: number | null;
  rain: number | null;
  short: string;
  bad: boolean; // this specific hour breaks the owner's cutoffs
};

export type WeatherByDay = Record<string, DayWeather>;   // key = YYYY-MM-DD (local to the business area)
export type WeatherByHour = Record<string, HourWeather>; // key = YYYY-MM-DDTHH

export type Forecast = { days: WeatherByDay; hours: WeatherByHour };

const NO_FORECAST: Forecast = { days: {}, hours: {} };
const UA = { "user-agent": "Snagly (hello@trysnagly.com)" };

type NwsPeriod = {
  startTime?: string;
  isDaytime?: boolean;
  temperature?: number;
  probabilityOfPrecipitation?: { value?: number | null };
  shortForecast?: string;
};

function severeLabel(short: string): string | null {
  if (/snow|sleet|ice|blizzard|freezing/i.test(short)) return short.toLowerCase();
  if (/thunder|storm/i.test(short)) return "storms";
  return null;
}

// Plain-English one-liner for "today" at the business's location — e.g.
// "Scattered thunderstorms around 2 PM — high 91°, 60% rain". Scans the hourly
// forecast for the first upcoming rain/storm hour so the owner knows WHEN, not
// just how likely.
export type TodayBlurb = { text: string; short: string; bad: boolean };

export function summarizeToday(forecast: Forecast, tz: string): TodayBlurb | null {
  const now = new Date();
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const day = forecast.days[todayKey];
  if (!day || (!day.short && day.hi === null)) return null;

  const currentHour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)
  ) % 24;

  // First upcoming hour (through 9 PM) that looks like rain/storms.
  let eventAt: number | null = null;
  let eventShort = "";
  for (let h = Math.max(6, currentHour); h <= 21; h++) {
    const wx = forecast.hours[`${todayKey}T${String(h).padStart(2, "0")}`];
    if (!wx) continue;
    const rainy = (wx.rain !== null && wx.rain >= 40) || /rain|shower|storm|thunder|drizzle/i.test(wx.short);
    if (rainy) {
      eventAt = h;
      eventShort = wx.short;
      break;
    }
  }

  const hi = day.hi !== null ? `high ${day.hi}°` : "";
  const rainPart = day.rain !== null && day.rain >= 30 ? `${day.rain}% rain` : "";
  const tail = [hi, rainPart].filter(Boolean).join(", ");

  let text: string;
  if (eventAt !== null) {
    const hourLabel = `${eventAt % 12 === 0 ? 12 : eventAt % 12} ${eventAt < 12 ? "AM" : "PM"}`;
    const what = (eventShort || day.short || "Rain").toLowerCase();
    text = `${what.charAt(0).toUpperCase()}${what.slice(1)} around ${hourLabel}${tail ? ` — ${tail}` : ""}`;
  } else {
    text = `${day.short || "Forecast"}${tail ? ` — ${tail}` : ""}`;
  }

  return { text, short: eventShort || day.short, bad: day.bad };
}

export async function getWeatherByZip(weather: WeatherSettings): Promise<Forecast> {
  if (!/^\d{5}$/.test(weather.zip)) return NO_FORECAST;
  try {
    // 1) zip → lat/lon (stable for a week)
    const zipRes = await fetch(`https://api.zippopotam.us/us/${weather.zip}`, {
      next: { revalidate: 604800 }
    });
    if (!zipRes.ok) return NO_FORECAST;
    const zipBody = (await zipRes.json()) as { places?: { latitude?: string; longitude?: string }[] };
    const lat = Number(zipBody.places?.[0]?.latitude);
    const lon = Number(zipBody.places?.[0]?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NO_FORECAST;

    // 2) lat/lon → NWS forecast URLs (stable for a day)
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: UA,
      next: { revalidate: 86400 }
    });
    if (!pointRes.ok) return NO_FORECAST;
    const pointBody = (await pointRes.json()) as { properties?: { forecast?: string; forecastHourly?: string } };
    const forecastUrl = pointBody.properties?.forecast;
    if (!forecastUrl) return NO_FORECAST;
    const hourlyUrl = pointBody.properties?.forecastHourly ?? null;

    // 3) the 7-day + hourly forecasts (refreshed every 30 min; hourly is optional)
    const [fcRes, hrRes] = await Promise.all([
      fetch(forecastUrl, { headers: UA, next: { revalidate: 1800 } }),
      hourlyUrl ? fetch(hourlyUrl, { headers: UA, next: { revalidate: 1800 } }).catch(() => null) : Promise.resolve(null)
    ]);
    if (!fcRes.ok) return NO_FORECAST;
    const fcBody = (await fcRes.json()) as { properties?: { periods?: NwsPeriod[] } };
    const periods = fcBody.properties?.periods ?? [];

    // Fold day/night periods into per-date entries. startTime carries the local
    // offset for the forecast area, so slicing the date keeps it local.
    const days: WeatherByDay = {};
    for (const p of periods) {
      const date = p.startTime?.slice(0, 10);
      if (!date) continue;
      const entry = (days[date] ??= { hi: null, lo: null, rain: null, short: "", bad: false, reason: null });
      const pop = typeof p.probabilityOfPrecipitation?.value === "number" ? p.probabilityOfPrecipitation.value : null;
      if (pop !== null) entry.rain = Math.max(entry.rain ?? 0, pop);
      if (p.isDaytime) {
        entry.hi = typeof p.temperature === "number" ? p.temperature : entry.hi;
        entry.short = p.shortForecast ?? entry.short;
      } else {
        entry.lo = typeof p.temperature === "number" ? p.temperature : entry.lo;
        if (!entry.short) entry.short = p.shortForecast ?? "";
      }
    }

    // Judge each day against the owner's cutoffs.
    for (const entry of Object.values(days)) {
      const reasons: string[] = [];
      const severe = severeLabel(entry.short);
      if (severe) reasons.push(severe);
      if (entry.rain !== null && entry.rain > weather.max_rain_chance) reasons.push(`${entry.rain}% rain`);
      if (entry.hi !== null && entry.hi < weather.min_temp_f) reasons.push(`${entry.hi}° — below your ${weather.min_temp_f}° cutoff`);
      if (entry.hi !== null && entry.hi > weather.max_temp_f) reasons.push(`${entry.hi}° — above your ${weather.max_temp_f}° cutoff`);
      entry.bad = reasons.length > 0;
      entry.reason = reasons.length > 0 ? reasons.join(" · ") : null;
    }

    // Hour-by-hour (used by the week grid) — each hour judged on its own.
    const hours: WeatherByHour = {};
    if (hrRes && hrRes.ok) {
      const hrBody = (await hrRes.json()) as { properties?: { periods?: NwsPeriod[] } };
      for (const p of hrBody.properties?.periods ?? []) {
        const key = p.startTime?.slice(0, 13); // YYYY-MM-DDTHH, local to the area
        if (!key) continue;
        const temp = typeof p.temperature === "number" ? p.temperature : null;
        const rain = typeof p.probabilityOfPrecipitation?.value === "number" ? p.probabilityOfPrecipitation.value : null;
        const short = p.shortForecast ?? "";
        const bad =
          severeLabel(short) !== null ||
          (rain !== null && rain > weather.max_rain_chance) ||
          (temp !== null && (temp < weather.min_temp_f || temp > weather.max_temp_f));
        hours[key] = { temp, rain, short, bad };
      }
    }

    return { days, hours };
  } catch {
    return NO_FORECAST;
  }
}
