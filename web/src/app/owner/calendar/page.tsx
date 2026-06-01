import type { CSSProperties } from "react";

import { createAppointment, setAppointmentStatus } from "@/app/owner/actions";
import { getIntakeRuntime } from "@/server/intake/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner screen — Schedule: an agenda of upcoming appointments grouped by day,
// a quick "book an appointment" form, and per-item status. Times in business tz.

const FALLBACK_TZ = "America/New_York";
const STATUS_OPTIONS = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;

function dayKey(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}
function dayLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: tz, weekday: "long", month: "short", day: "numeric" });
}
function timeLabel(iso: string, tz: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
}
function fmtPhone(p: string | null): string {
  if (!p) return "";
  const m = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(p);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : p;
}
function statusBadge(status: string): CSSProperties {
  const color =
    status === "completed" ? "#1f9d6b" : status === "cancelled" || status === "no_show" ? "#b23b3b" : status === "confirmed" ? "#5b5bd6" : "#c77d14";
  return { fontSize: 11, fontWeight: 700, color, background: `${color}1a`, padding: "2px 8px", borderRadius: 999, textTransform: "capitalize", whiteSpace: "nowrap" };
}

export default async function CalendarPage() {
  const rt = await getIntakeRuntime();
  const [businesses, appointments, profiles] = await Promise.all([
    rt.businessRepository.list(),
    rt.appointmentRepository.list(),
    rt.customerProfileRepository.list()
  ]);
  const business = businesses[0] ?? null;
  const tz = business?.timezone || FALLBACK_TZ;
  const nameById = new Map(profiles.map((p) => [p.id, p.display_name || fmtPhone(p.phone_e164)]));

  const todayKey = dayKey(new Date().toISOString(), tz);
  const upcoming = appointments
    .filter((a) => (!business || a.business_id === business.id) && dayKey(a.scheduled_start_at, tz) >= todayKey)
    .sort((a, b) => (a.scheduled_start_at < b.scheduled_start_at ? -1 : 1));

  const groups: { key: string; label: string; items: typeof upcoming }[] = [];
  for (const appt of upcoming) {
    const key = dayKey(appt.scheduled_start_at, tz);
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, label: dayLabel(appt.scheduled_start_at, tz), items: [] };
      groups.push(group);
    }
    group.items.push(appt);
  }

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Schedule</h1>
      <div style={S.sub}>Upcoming appointments, in your timezone.</div>

      <form action={createAppointment} style={S.bookForm}>
        <div style={S.bookTitle}>+ Book an appointment</div>
        <input name="title" placeholder="What & who (e.g. Full detail — Sarah's SUV)" style={S.input} autoComplete="off" />
        <input name="start" type="datetime-local" required style={S.input} />
        <button type="submit" style={S.btnPrimary}>Add to schedule</button>
      </form>

      {groups.length === 0 ? (
        <div style={S.empty}>No upcoming appointments. Book one above, or from a lead&apos;s page.</div>
      ) : (
        groups.map((g) => (
          <div key={g.key} style={{ marginTop: 18 }}>
            <div style={S.dayLabel}>{g.label}</div>
            {g.items.map((a) => (
              <div key={a.id} style={S.appt}>
                <div style={S.apptTime}>{timeLabel(a.scheduled_start_at, tz)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.apptTitle}>{a.title}</div>
                  {(a.customer_profile_id && nameById.get(a.customer_profile_id)) || a.service_requested ? (
                    <div style={S.apptMeta}>
                      {(a.customer_profile_id && nameById.get(a.customer_profile_id)) || a.service_requested}
                    </div>
                  ) : null}
                </div>
                <div style={S.apptRight}>
                  <span style={statusBadge(a.status)}>{a.status.replace("_", " ")}</span>
                  <form action={setAppointmentStatus} style={{ display: "flex", gap: 4 }}>
                    <input type="hidden" name="appointmentId" value={a.id} />
                    <select name="status" defaultValue={a.status} style={S.miniSelect}>
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                    <button type="submit" style={S.miniBtn}>Save</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ))
      )}
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 720, margin: "0 auto", padding: "26px 20px 48px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  sub: { color: "#8a909c", fontSize: 13 },
  bookForm: { display: "flex", flexDirection: "column", gap: 8, marginTop: 16, padding: "14px", borderRadius: 12, background: "#fff", border: "1px solid #eceef2" },
  bookTitle: { fontSize: 13, fontWeight: 700, color: "#3a3a9a" },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14 },
  btnPrimary: { padding: "10px 13px", borderRadius: 10, border: "none", background: "#5b5bd6", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  empty: { marginTop: 20, padding: "24px 16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", textAlign: "center", color: "#8a909c" },
  dayLabel: { fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: "#8a909c", textTransform: "uppercase", margin: "6px 0 8px" },
  appt: { display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px", marginBottom: 8, borderRadius: 12, background: "#fff", border: "1px solid #eceef2", boxShadow: "0 1px 3px rgba(17,21,28,0.05)" },
  apptTime: { fontSize: 13, fontWeight: 700, color: "#15171b", minWidth: 62 },
  apptTitle: { fontSize: 14, fontWeight: 600, color: "#15171b" },
  apptMeta: { fontSize: 13, color: "#3c414b", marginTop: 2 },
  apptRight: { display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" },
  miniSelect: { padding: "4px 6px", borderRadius: 7, border: "1px solid #d8dce3", fontSize: 11, background: "#fff" },
  miniBtn: { padding: "4px 8px", borderRadius: 7, border: "none", background: "#eceef2", color: "#1e2026", fontWeight: 600, fontSize: 11, cursor: "pointer" }
};
