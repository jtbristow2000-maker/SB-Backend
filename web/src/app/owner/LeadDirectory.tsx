"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";

import { fmtPhone } from "@/app/owner/format";

// Client-side searchable lead directory. Unlike Callbacks (open callbacks only),
// this lists EVERY lead, with name/number search + status filtering.

export type DirectoryLead = {
  id: string;
  display_name: string | null;
  phone_e164: string | null;
  status: string;
  last_contact_at: string | null;
  next_appointment: string | null;
};

const STATUS_FILTERS = ["all", "new", "contacted", "booked", "won", "lost"] as const;

function fmtWhen(iso: string | null, tz: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function fmtApptWhen(iso: string, tz: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: tz, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  });
}

type Handling = { icon: string; text: string; color: string };
// A short "how this lead has been handled" line — the pipeline state at a glance,
// so Leads reads as a CRM (where they stand) rather than another voicemail list.
function handlingSummary(lead: DirectoryLead, tz: string): Handling {
  if (lead.next_appointment) {
    return { icon: "📅", text: `Booked · ${fmtApptWhen(lead.next_appointment, tz)}`, color: "var(--brand)" };
  }
  const s = lead.status || "new";
  if (s === "won") return { icon: "🏆", text: "Won — job closed", color: "var(--positive)" };
  if (s === "lost") return { icon: "✕", text: "Lost", color: "#b23b3b" };
  if (s === "booked") return { icon: "📅", text: "Booked", color: "var(--brand)" };
  if (s === "contacted") {
    return { icon: "💬", text: lead.last_contact_at ? `Contacted · ${fmtWhen(lead.last_contact_at, tz)}` : "Contacted", color: "#c77d14" };
  }
  return { icon: "🆕", text: lead.last_contact_at ? `New · heard ${fmtWhen(lead.last_contact_at, tz)}` : "New lead", color: "#6b7280" };
}

// A booked appointment trumps a stale "contacted"/"new" status, so the badge,
// the handling line, and the status filter all agree.
function effectiveStatus(lead: DirectoryLead): string {
  return lead.next_appointment ? "booked" : (lead.status || "new");
}

const onlyDigits = (s: string): string => s.replace(/\D/g, "");

export function LeadDirectory({ leads, tz }: { leads: DirectoryLead[]; tz: string }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const needleDigits = onlyDigits(needle);
    return leads.filter((lead) => {
      if (status !== "all" && effectiveStatus(lead) !== status) return false;
      if (!needle) return true;
      const name = (lead.display_name || "").toLowerCase();
      const phone = (lead.phone_e164 || "").toLowerCase();
      return (
        name.includes(needle) ||
        phone.includes(needle) ||
        (needleDigits.length > 0 && onlyDigits(phone).includes(needleDigits))
      );
    });
  }, [leads, query, status]);

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
          </button>
        ))}
      </div>
      <div style={S.count}>
        {filtered.length} of {leads.length} {leads.length === 1 ? "lead" : "leads"}
      </div>
      {filtered.length === 0 ? (
        <div style={S.empty}>No leads match.</div>
      ) : (
        filtered.map((lead) => {
          const h = handlingSummary(lead, tz);
          return (
            <Link key={lead.id} href={`/owner/${lead.id}`} style={S.row}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ color: "#15171b", fontSize: 15 }}>
                  {lead.display_name || fmtPhone(lead.phone_e164)}
                </strong>
                <span style={statusBadge(effectiveStatus(lead))}>{effectiveStatus(lead)}</span>
              </div>
              <div style={{ ...S.handling, color: h.color }}>{h.icon} {h.text}</div>
              <div style={S.phoneMeta}>{fmtPhone(lead.phone_e164)}</div>
            </Link>
          );
        })
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  search: { width: "100%", padding: "11px 13px", borderRadius: 11, border: "1px solid #d8dce3", fontSize: 15, marginBottom: 10 },
  chips: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  count: { fontSize: 12, color: "#8a909c", marginBottom: 8 },
  empty: { marginTop: 8, padding: "22px 16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2", textAlign: "center", color: "#8a909c" },
  row: { display: "block", textDecoration: "none", padding: "13px 15px", marginBottom: 9, borderRadius: 13, background: "#fff", border: "1px solid #eceef2", boxShadow: "0 1px 3px rgba(17,21,28,0.05)" },
  handling: { fontSize: 13, fontWeight: 600, marginTop: 5 },
  phoneMeta: { color: "#8a909c", fontSize: 12.5, marginTop: 2 }
};

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: `1px solid ${active ? "var(--brand)" : "#d8dce3"}`,
    background: active ? "var(--brand)" : "#fff",
    color: active ? "#fff" : "#3c414b"
  };
}

function statusBadge(status: string): CSSProperties {
  const s = status || "new";
  const color =
    s === "won" ? "var(--positive)" : s === "booked" ? "var(--brand)" : s === "lost" ? "#b23b3b" : s === "contacted" ? "#c77d14" : "#8a909c";
  return {
    fontSize: 11,
    fontWeight: 700,
    color,
    background: `${color}1a`,
    padding: "3px 9px",
    borderRadius: 999,
    textTransform: "capitalize",
    whiteSpace: "nowrap"
  };
}
