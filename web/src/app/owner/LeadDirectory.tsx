"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarCheck2, MessageSquareText, Sparkle, Trophy, X, type LucideIcon } from "lucide-react";
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

type Handling = { Icon: LucideIcon; text: string; color: string };
// A short "how this lead has been handled" line — the pipeline state at a glance,
// so Leads reads as a CRM (where they stand) rather than another voicemail list.
function handlingSummary(lead: DirectoryLead, tz: string): Handling {
  if (lead.next_appointment) {
    return { Icon: CalendarCheck2, text: `Booked · ${fmtApptWhen(lead.next_appointment, tz)}`, color: "var(--brand)" };
  }
  const s = lead.status || "new";
  if (s === "won") return { Icon: Trophy, text: "Won — job closed", color: "var(--positive)" };
  if (s === "lost") return { Icon: X, text: "Lost", color: "#b23b3b" };
  if (s === "booked") return { Icon: CalendarCheck2, text: "Booked", color: "var(--brand)" };
  if (s === "contacted") {
    return { Icon: MessageSquareText, text: lead.last_contact_at ? `Contacted · ${fmtWhen(lead.last_contact_at, tz)}` : "Contacted", color: "#c77d14" };
  }
  return { Icon: Sparkle, text: lead.last_contact_at ? `New · heard ${fmtWhen(lead.last_contact_at, tz)}` : "New lead", color: "#6b7280" };
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
        className="input"
        style={S.search}
        autoComplete="off"
      />
      <div style={S.chips}>
        {STATUS_FILTERS.map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)} className="btn" style={chipStyle(s === status)}>
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
        filtered.map((lead) => {
          const h = handlingSummary(lead, tz);
          return (
            <Link key={lead.id} href={`/owner/${lead.id}`} className="card card-tap" style={S.row}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ color: "var(--ink)", fontSize: 15 }}>
                  {lead.display_name || fmtPhone(lead.phone_e164)}
                </strong>
                <span style={statusBadge(effectiveStatus(lead))}>{effectiveStatus(lead)}</span>
              </div>
              <div style={{ ...S.handling, color: h.color }}><h.Icon size={13} className="ico-inline" aria-hidden /> {h.text}</div>
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
  count: { fontSize: 12, color: "var(--muted)", marginBottom: 8 },
  empty: { marginTop: 8, padding: "22px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", textAlign: "center", color: "var(--muted)" },
  row: { display: "block", padding: "13px 15px", marginBottom: 9 },
  handling: { fontSize: 13, fontWeight: 600, marginTop: 5 },
  phoneMeta: { color: "var(--muted)", fontSize: 12.5, marginTop: 2 }
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
  // [text color, tint bg] — explicit rgba tints so brand/positive tokens render a
  // background (a `var(--brand)1a` string is invalid CSS and showed no fill before).
  const map: Record<string, [string, string]> = {
    won: ["var(--positive)", "rgba(var(--positive-rgb),0.16)"],
    booked: ["#3a3a9a", "rgba(var(--brand-rgb),0.14)"],
    lost: ["#b23b3b", "rgba(178,59,59,0.13)"],
    contacted: ["#9a6210", "rgba(199,125,20,0.15)"],
    new: ["#6b7280", "rgba(138,144,156,0.16)"]
  };
  const [color, background] = map[s] ?? map.new;
  return {
    fontSize: 11,
    fontWeight: 700,
    color,
    background,
    padding: "3px 9px",
    borderRadius: 999,
    textTransform: "capitalize",
    whiteSpace: "nowrap",
    letterSpacing: 0.2
  };
}
