import type { CSSProperties } from "react";
import { Cloud, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";

import { summarizeToday, type Forecast } from "@/app/owner/weather";

// One-line "today's weather" blurb for page headers (Schedule, Today) — the
// plain-words companion to the hourly stamps: what's coming and when.

function icon(short: string): LucideIcon {
  const s = short.toLowerCase();
  if (/thunder|storm/.test(s)) return CloudLightning;
  if (/snow|sleet|ice|blizzard|flurr|freezing/.test(s)) return CloudSnow;
  if (/rain|shower|drizzle/.test(s)) return CloudRain;
  if (/partly|mostly sunny/.test(s)) return CloudSun;
  if (/cloud|overcast|fog|haze/.test(s)) return Cloud;
  return Sun;
}

export function WeatherBlurb({ forecast, tz, style }: { forecast: Forecast; tz: string; style?: CSSProperties }) {
  const blurb = summarizeToday(forecast, tz);
  if (!blurb) return null;
  const Icon = icon(blurb.short);
  return (
    <div style={{ ...S.wrap, color: blurb.bad ? "#8a5a0c" : "var(--muted)", background: blurb.bad ? "rgba(199,125,20,0.1)" : "var(--surface)", ...style }}>
      <Icon size={14} style={{ flexShrink: 0, color: blurb.bad ? "#b06f12" : "#3a7bd0" }} aria-hidden />
      <span><strong style={{ fontWeight: 700 }}>Today:</strong> {blurb.text}</span>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    marginTop: 10,
    padding: "7px 12px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    boxShadow: "var(--shadow-xs)",
    fontSize: 12.5,
    fontWeight: 600,
    lineHeight: 1.4
  }
};
