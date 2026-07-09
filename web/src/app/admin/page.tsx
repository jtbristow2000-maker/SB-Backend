import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { ArrowRight, PhoneCall, ShieldCheck, Users } from "lucide-react";

import { openBusinessAsAdmin } from "@/app/admin/actions";
import { fmtPhone } from "@/app/owner/format";
import { listBusinessesForAdmin, requireAdminUser } from "@/server/admin/service";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Admin portal — every account at a glance, with one-click entry into any
// business's real owner dashboard (for live onboarding). Gated twice: this page
// checks the admin email, and the impersonation context re-checks per request.

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function numberLabel(status: string, twilio: string | null): string {
  if (twilio) return `${fmtPhone(twilio)} · ${status}`;
  return "keep-your-number";
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirectTo=/admin");
  const admin = await requireAdminUser();
  if (!admin) redirect("/owner/today");

  const businesses = await listBusinessesForAdmin();

  return (
    <main className="owner-page" style={S.page}>
      <div style={S.headRow}>
        <span style={S.badge}><ShieldCheck size={13} aria-hidden /> Admin</span>
      </div>
      <h1 style={S.h1}>Accounts</h1>
      <div style={S.sub}>
        {businesses.length} {businesses.length === 1 ? "business" : "businesses"} — open one to walk through their
        dashboard and settings with them, live.
      </div>

      <div style={S.list}>
        {businesses.map((b) => (
          <div key={b.id} className="card" style={S.row}>
            <div style={S.rowMain}>
              <div style={S.nameLine}>
                <span className="clamp-1" style={S.name}>{b.name}</span>
                <span style={S.created}>since {fmtDate(b.created_at)}</span>
              </div>
              <div style={S.metaLine}>
                {b.member_email && <span className="clamp-1" style={S.email}>{b.member_email}</span>}
                {b.business_phone_e164 && <span style={S.meta}>{fmtPhone(b.business_phone_e164)}</span>}
                <span style={S.meta}>{numberLabel(b.number_status, b.twilio_number_e164)}</span>
              </div>
            </div>
            <div style={S.counts}>
              <span style={S.count} title="Leads"><Users size={13} aria-hidden /> {b.lead_count}</span>
              <span style={S.count} title="Calls"><PhoneCall size={13} aria-hidden /> {b.call_count}</span>
            </div>
            <form action={openBusinessAsAdmin}>
              <input type="hidden" name="businessId" value={b.id} />
              <button type="submit" className="btn btn-primary" style={S.openBtn}>
                Open account <ArrowRight size={14} aria-hidden />
              </button>
            </form>
          </div>
        ))}
        {businesses.length === 0 && (
          <div className="card" style={S.empty}>No businesses yet — accounts appear here as people sign up.</div>
        )}
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 860 },
  headRow: { marginBottom: 6 },
  badge: { display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, color: "#8a5a0c", background: "rgba(199,125,20,0.14)", padding: "4px 11px", borderRadius: 999 },
  h1: { margin: "4px 0 2px", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" },
  sub: { color: "var(--muted)", fontSize: 13 },
  list: { marginTop: 18, display: "flex", flexDirection: "column", gap: 10 },
  row: { display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", flexWrap: "wrap" },
  rowMain: { flex: "1 1 260px", minWidth: 0 },
  nameLine: { display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 },
  name: { fontSize: 15.5, fontWeight: 700, color: "var(--ink)", minWidth: 0 },
  created: { fontSize: 11.5, color: "var(--faint)", whiteSpace: "nowrap", flexShrink: 0 },
  metaLine: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 3 },
  email: { fontSize: 12.5, color: "var(--muted)", minWidth: 0, maxWidth: 240 },
  meta: { fontSize: 12.5, color: "var(--muted)", whiteSpace: "nowrap" },
  counts: { display: "flex", gap: 12, flexShrink: 0 },
  count: { display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--text)" },
  openBtn: { padding: "9px 15px", fontSize: 13, flexShrink: 0 },
  empty: { padding: "26px 20px", textAlign: "center", color: "var(--muted)", fontSize: 13.5 }
};
