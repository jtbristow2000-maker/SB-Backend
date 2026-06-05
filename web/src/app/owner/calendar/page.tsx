import type { CSSProperties } from "react";

import { createAppointment } from "@/app/owner/actions";
import { CalendarViews, type CalendarEvent } from "@/app/owner/CalendarViews";
import { fmtPhone } from "@/app/owner/format";
import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings, quotePriceLabel, quoteServiceColor, isServiceOnCalendar } from "@/server/business/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner screen — Schedule: a Week / Month / Agenda calendar of appointments,
// plus a quick "book an appointment" form. Calendar rendering + navigation is
// the CalendarViews client island; booking is a server action.

export default async function CalendarPage() {
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const [appointments, profiles] = rt ? await Promise.all([
    rt.appointmentRepository.list(),
    rt.customerProfileRepository.list()
  ]) : [[], []];
  const settings = getBusinessSettings(business);
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
    <main style={S.page}>
      <h1 style={S.h1}>Schedule</h1>
      <div style={S.sub}>Your appointments — switch between Week, Month, and Agenda.</div>

      <form action={createAppointment} style={S.bookForm}>
        <div style={S.bookTitle}>+ Book an appointment</div>
        <input name="title" placeholder="What & who (e.g. Full detail — Sarah's SUV)" style={S.input} autoComplete="off" />
        <input name="service" placeholder="Service for the quote (e.g. Full Detail SUV)" style={S.input} autoComplete="off" />
        <input name="start" type="datetime-local" required style={S.input} />
        <select name="duration" defaultValue="60" style={S.input} aria-label="Duration">
          <option value="30">30 minutes</option>
          <option value="60">1 hour</option>
          <option value="90">1.5 hours</option>
          <option value="120">2 hours</option>
          <option value="180">3 hours</option>
          <option value="240">4 hours</option>
        </select>
        <input name="location" placeholder="Address (optional — for directions)" style={S.input} autoComplete="off" />
        <input name="notes" placeholder="Notes (optional — gate code, etc.)" style={S.input} autoComplete="off" />
        <button type="submit" style={S.btnPrimary}>Add to schedule</button>
      </form>

      <CalendarViews events={events} legend={settings.quote_ranges.filter((r) => r.on_calendar !== false).map((r) => ({ service: r.service, color: r.color ?? "#5b5bd6" }))} />
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 760, margin: "0 auto", padding: "26px 20px 48px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  sub: { color: "#8a909c", fontSize: 13 },
  bookForm: { display: "flex", flexDirection: "column", gap: 8, marginTop: 16, padding: "14px", borderRadius: 12, background: "#fff", border: "1px solid #eceef2" },
  bookTitle: { fontSize: 13, fontWeight: 700, color: "#3a3a9a" },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14 },
  btnPrimary: { padding: "10px 13px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }
};
