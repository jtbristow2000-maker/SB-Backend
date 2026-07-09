import type { CSSProperties } from "react";

import { CalendarViews, type CalendarEvent } from "@/app/owner/CalendarViews";
import { fmtPhone } from "@/app/owner/format";
import { getWeatherByZip } from "@/app/owner/weather";
import { WeatherBlurb } from "@/app/owner/WeatherBlurb";
import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings, quotePriceLabel, quoteServiceColor, isServiceOnCalendar } from "@/server/business/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner screen — Schedule. Booking happens right on the calendar (click or drag
// an empty slot, or the + Book button), Google-style; CalendarViews owns all of
// the interaction as a client island.

export default async function CalendarPage() {
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const [appointments, profiles] = rt ? await Promise.all([
    rt.appointmentRepository.list(),
    rt.customerProfileRepository.list()
  ]) : [[], []];
  const settings = getBusinessSettings(business);
  const forecast = await getWeatherByZip(settings.weather);
  const nameById = new Map(
    profiles.map((p) => [p.id, p.display_name || (p.phone_e164 ? fmtPhone(p.phone_e164) : "")])
  );
  const phoneById = new Map(profiles.map((p) => [p.id, p.phone_e164]));

  const events: CalendarEvent[] = appointments
    .filter((a) => (!business || a.business_id === business.id) && isServiceOnCalendar(a.service_requested, settings.quote_ranges))
    .map((a) => ({
      id: a.id,
      title: a.title,
      start: a.scheduled_start_at,
      end: a.scheduled_end_at,
      status: a.status,
      who: (a.customer_profile_id ? nameById.get(a.customer_profile_id) : null) || a.service_requested || "",
      customerProfileId: a.customer_profile_id,
      service: a.service_requested,
      location: a.location,
      notes: a.notes,
      phone: a.customer_profile_id ? phoneById.get(a.customer_profile_id) ?? null : null,
      priceLabel: quotePriceLabel(a.service_requested, settings.quote_ranges),
      serviceColor: quoteServiceColor(a.service_requested, settings.quote_ranges)
    }));

  return (
    <main className="owner-page" style={S.page}>
      <div style={S.narrow}>
        <h1 style={S.h1}>Schedule</h1>
        <div style={S.sub}>Double-click an empty slot (or drag across one) to book it — and drag any booking to move it.</div>
        <WeatherBlurb forecast={forecast} tz={business?.timezone || "America/New_York"} />
      </div>

      <CalendarViews events={events} weather={forecast.days} weatherHours={forecast.hours} />
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  // The page itself is uncapped so the calendar can fill wide screens; the
  // header stays at a readable width.
  page: { maxWidth: "none" },
  narrow: { maxWidth: 760, margin: "0 auto", width: "100%" },
  h1: { margin: "4px 0 2px", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" },
  sub: { color: "var(--muted)", fontSize: 13 }
};
