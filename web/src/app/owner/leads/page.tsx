import type { CSSProperties } from "react";

import { getOwnerBusinessContext } from "@/server/business/current";

import { LeadDirectory, type DirectoryLead } from "../LeadDirectory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner screen 3 — Leads: a searchable directory of EVERY lead (not just open
// callbacks). Filtering/search is client-side (LeadDirectory island).

const FALLBACK_TZ = "America/New_York";

export default async function LeadsPage() {
  const context = await getOwnerBusinessContext();
  const rt = context?.rt ?? null;
  const business = context?.business ?? null;
  const profiles = rt ? await rt.customerProfileRepository.list() : [];
  const tz = business?.timezone || FALLBACK_TZ;

  const leads: DirectoryLead[] = profiles
    .filter((p) => !business || p.business_id === business.id)
    .map((p) => ({
      id: p.id,
      display_name: p.display_name,
      phone_e164: p.phone_e164,
      status: p.status,
      last_contact_at: p.last_contact_at
    }))
    .sort((a, b) => {
      const at = a.last_contact_at ?? "";
      const bt = b.last_contact_at ?? "";
      return at < bt ? 1 : at > bt ? -1 : 0; // most recently heard first
    });

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Leads</h1>
      <div style={S.sub}>Everyone who&apos;s contacted you — search by name or number, filter by status.</div>
      <div style={{ marginTop: 16 }}>
        <LeadDirectory leads={leads} tz={tz} />
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 720, margin: "0 auto", padding: "26px 20px 48px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  sub: { color: "#8a909c", fontSize: 13 }
};
