import type { CSSProperties } from "react";

import { createAppointment } from "@/app/owner/actions";
import { CalendarViews, type CalendarEvent } from "@/app/owner/CalendarViews";
import { getIntakeRuntime } from "@/server/intake/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner screen — Schedule: a Week / Month / Agenda calendar of appointments,
// plus a quick "book an appointment" form. Calendar rendering + navigation is
// the CalendarViews client island; booking is a server action.

function fmtPhone(p: string | null): string {
  if (!p) return "";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}

export default async function CalendarPage() {
  const rt = await getIntakeRuntime();
  const [businesses, appointments, profiles] = await Promise.all([
    rt.businessRepository.list(),
    rt.appointmentRepository.list(),
    rt.customerProfileRepository.list()
  ]);
  const business = businesses[0] ?? null;
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name || fmtPhone(p.phone_e164)]));

  const events: CalendarEvent[] = appointments
    .filter((a) => !business || a.business_id === business.id)
    .map((a) => ({
      id: a.id,
      title: a.title,
      start: a.scheduled_start_at,
      end: a.scheduled_end_at,
      status: a.status,
      who: (a.customer_profile_id ? nameById.get(a.customer_profile_id) : null) || a.service_requested || "",
      customerProfileId: a.customer_profile_id
    }));

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Schedule</h1>
      <div style={S.sub}>Your appointments — switch between Week, Month, and Agenda.</div>

      <form action={createAppointment} style={S.bookForm}>
        <div style={S.bookTitle}>+ Book an appointment</div>
        <input name="title" placeholder="What & who (e.g. Full detail — Sarah's SUV)" style={S.input} autoComplete="off" />
        <input name="start" type="datetime-local" required style={S.input} />
        <button type="submit" style={S.btnPrimary}>Add to schedule</button>
      </form>

      <CalendarViews events={events} />
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
  btnPrimary: { padding: "10px 13px", borderRadius: 10, border: "none", background: "#5b5bd6", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }
};
