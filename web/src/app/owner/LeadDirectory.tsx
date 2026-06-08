"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { LeadCard, leadGrid, useReadMap, type LeadCardItem } from "./LeadCard";
import type { LeadRundown } from "./leadRundown";

// Leads = the full pipeline. Searchable, filterable by stage, and rendered with the
// same glanceable info cards as Today's Needs Attention. Replaces the old standalone
// Callbacks screen — Today triages what needs you; Leads is where everything lives.

export type DirectoryLead = {
  id: string;
  name: string;
  phone_e164: string | null;
  status: string;
  next_appointment: string | null;
  lastActivity: string | null;
  snippet: string;
  rundown: LeadRundown;
  bookingLabel: string | null;
};

const STATUS_FILTERS = ["all", "new", "contacted", "booked", "won", "lost"] as const;

// A booked appointment trumps a stale "contacted"/"new" status, so the pill, the card,
// and the status filter all agree.
function effectiveStatus(lead: DirectoryLead): string {
  return lead.next_appointment ? "booked" : (lead.status || "new");
}

const onlyDigits = (s: string): string => s.replace(/\D/g, "");

export function LeadDirectory({ leads }: { leads: DirectoryLead[] }) {
  const { readMap, markRead } = useReadMap();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const needleDigits = onlyDigits(needle);
    return leads.filter((lead) => {
      if (status !== "all" && effectiveStatus(lead) !== status) return false;
      if (!needle) return true;
      const name = lead.name.toLowerCase();
      const phone = (lead.phone_e164 || "").toLowerCase();
      return (
        name.includes(needle) ||
        phone.includes(needle) ||
        (needleDigits.length > 0 && onlyDigits(phone).includes(needleDigits))
      );
    });
  }, [leads, query, status]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: leads.length, new: 0, contacted: 0, booked: 0, won: 0, lost: 0 };
    for (const l of leads) {
      const s = effectiveStatus(l);
      m[s] = (m[s] ?? 0) + 1;
    }
    return m;
  }, [leads]);

  if (leads.length === 0) {
    return <div style={S.empty}>No leads yet. New callers and texters will appear here automatically.</div>;
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or number…"
        style={S.search}
        autoComplete="off"
      />
      <div style={S.chips}>
        {STATUS_FILTERS.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} style={chipStyle(s === status)}>
            {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
            <span style={{ opacity: 0.7, marginLeft: 5 }}>{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>
      <div style={S.count}>
        {filtered.length} of {leads.length} {leads.length === 1 ? "lead" : "leads"}
      </div>
      {filtered.length === 0 ? (
        <div style={S.empty}>No leads match.</div>
      ) : (
        <div style={leadGrid}>
          {filtered.map((lead) => {
            const item: LeadCardItem = {
              id: lead.id,
              name: lead.name,
              snippet: lead.snippet,
              customerReplied: false,
              lastActivity: lead.lastActivity,
              status: effectiveStatus(lead),
              rundown: lead.rundown,
              booking: lead.bookingLabel
            };
            return (
              <LeadCard
                key={lead.id}
                item={item}
                readMap={readMap}
                onOpen={() => markRead(lead.id, lead.lastActivity)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${active ? "var(--brand)" : "var(--border-strong)"}`,
    background: active ? "var(--brand)" : "var(--surface)",
    color: active ? "#fff" : "#3c414b"
  };
}

const S: Record<string, CSSProperties> = {
  search: { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid var(--border-strong)", fontSize: 15, marginBottom: 10, boxSizing: "border-box" },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  count: { fontSize: 12, color: "var(--muted)", marginBottom: 10 },
  empty: { marginTop: 8, padding: "22px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", textAlign: "center", color: "var(--muted)" }
};
