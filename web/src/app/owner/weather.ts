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

export type WeatherByDay = Record<string, DayWeather>; // key = YYYY-MM-DD (local to the business area)

const UA = { "user-agent": "Snagly (hello@trysnagly.com)" };

type NwsPeriod = {
  startTime?: string;
  isDaytime?: boolean;
  temperature?: number;
  probabilityOfPrecipitation?: { value?: number | null };
  shortForecast?: string;
};

export async function getWeatherByZip(weather: WeatherSettings): Promise<WeatherByDay> {
  if (!/^\d{5}$/.test(weather.zip)) return {};
  try {
    // 1) zip → lat/lon (stable for a week)
    const zipRes = await fetch(`https://api.zippopotam.us/us/${weather.zip}`, {
      next: { revalidate: 604800 }
    });
    if (!zipRes.ok) return {};
    const zipBody = (await zipRes.json()) as { places?: { latitude?: string; longitude?: string }[] };
    const lat = Number(zipBody.places?.[0]?.latitude);
    const lon = Number(zipBody.places?.[0]?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return {};

    // 2) lat/lon → NWS forecast URL (stable for a day)
    const pointRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
      headers: UA,
      next: { revalidate: 86400 }
    });
    if (!pointRes.ok) return {};
    const pointBody = (await pointRes.json()) as { properties?: { forecast?: string } };
    const forecastUrl = pointBody.properties?.forecast;
    if (!forecastUrl) return {};

    // 3) the 7-day forecast itself (refreshed every 30 min)
    const fcRes = await fetch(forecastUrl, { headers: UA, next: { revalidate: 1800 } });
    if (!fcRes.ok) return {};
    const fcBody = (await fcRes.json()) as { properties?: { periods?: NwsPeriod[] } };
    const periods = fcBody.properties?.periods ?? [];

    // Fold day/night periods into per-date entries. startTime carries the local
    // offset for the forecast area, so slicing the date keeps it local.
    const out: WeatherByDay = {};
    for (const p of periods) {
      const date = p.startTime?.slice(0, 10);
      if (!date) continue;
      const entry = (out[date] ??= { hi: null, lo: null, rain: null, short: "", bad: false, reason: null });
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
    for (const entry of Object.values(out)) {
      const reasons: string[] = [];
      if (/snow|sleet|ice|blizzard|freezing/i.test(entry.short)) reasons.push(entry.short.toLowerCase());
      else if (/thunder|storm/i.test(entry.short)) reasons.push("storms");
      if (entry.rain !== null && entry.rain > weather.max_rain_chance) reasons.push(`${entry.rain}% rain`);
      if (entry.hi !== null && entry.hi < weather.min_temp_f) reasons.push(`${entry.hi}° — below your ${weather.min_temp_f}° cutoff`);
      if (entry.hi !== null && entry.hi > weather.max_temp_f) reasons.push(`${entry.hi}° — above your ${weather.max_temp_f}° cutoff`);
      entry.bad = reasons.length > 0;
      entry.reason = reasons.length > 0 ? reasons.join(" · ") : null;
    }
    return out;
  } catch {
    return {};
  }
}
