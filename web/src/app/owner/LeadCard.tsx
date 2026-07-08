"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { BadgeDollarSign, CalendarCheck2, CalendarClock, Wrench } from "lucide-react";

import { isLeadUnread, loadReadMap, markLeadRead, type ReadMap } from "./leadRead";
import type { LeadRundown } from "./leadRundown";

// The shared lead info card — used by Today's "Needs attention" grid and the Leads
// pipeline so both read identically. Each card shows name + vehicle, a status pill,
// the owner-facing rundown (summary, what they want, the quote, when), an optional
// booking line, and the voicemail snippet. An unread dot + bold name marks leads the
// owner hasn't opened; once viewed, a brand-"New" lead flips to an "Opened" pill.

export type LeadCardItem = {
  id: string;
  name: string;
  snippet: string;
  customerReplied: boolean;
  lastActivity: string | null;
  status?: string;
  rundown?: LeadRundown;
  booking?: string | null;
};

// Shared read/unread tracking for the lead grids (localStorage-backed). readMap is
// null until mounted, so the server render shows everything "read" (no flash of dots).
export function useReadMap() {
  const [readMap, setReadMap] = useState<ReadMap | null>(null);
  useEffect(() => {
    setReadMap(loadReadMap());
    const refresh = () => setReadMap(loadReadMap());
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  const markRead = (id: string, activity: string | null) => setReadMap(markLeadRead(id, activity));
  return { readMap, markRead };
}

export const leadGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 12,
  alignItems: "start"
};

export function LeadCard({
  item,
  readMap,
  onOpen
}: {
  item: LeadCardItem;
  readMap: ReadMap | null;
  onOpen?: () => void;
}) {
  const mounted = readMap !== null;
  const unread = mounted ? isLeadUnread(readMap, item.id, item.lastActivity) : false;
  const opened = mounted && !unread; // owner has viewed this lead at least once
  const r = item.rundown;
  return (
    <Link href={`/owner/${item.id}`} onClick={onOpen} className="card card-tap" style={cardStyle(unread)}>
      <div style={S.head}>
        <div style={S.nameWrap}>
          <span style={{ ...S.dot, opacity: unread ? 1 : 0 }} aria-hidden />
          <strong style={{ ...S.name, fontWeight: unread ? 800 : 700 }}>{item.name}</strong>
          {r?.vehicle && <span style={S.vehicle}>· {r.vehicle}</span>}
        </div>
        {statusPill(item, opened)}
      </div>

      {r?.summary && <div className="clamp-2" style={S.summary}>{r.summary}</div>}

      {(r?.wants || r?.when || r?.quote) && (
        <div style={S.facts}>
          {r?.wants && <div style={S.fact}><Wrench size={12.5} className="ico-inline" style={S.factIco} aria-hidden /> <strong>Wants:</strong> {r.wants}</div>}
          {r?.when && <div style={S.fact}><CalendarClock size={12.5} className="ico-inline" style={S.factIco} aria-hidden /> <strong>Asked for:</strong> {r.when}</div>}
          {r?.quote && <div style={S.fact}><BadgeDollarSign size={12.5} className="ico-inline" style={S.factIco} aria-hidden /> <strong>Quote:</strong> {r.quote}</div>}
        </div>
      )}

      {item.booking && <div style={S.booking}><CalendarCheck2 size={13} className="ico-inline" aria-hidden /> {item.booking}</div>}

      {item.snippet && <div className="clamp-2" style={S.snippet}>{item.snippet}</div>}
    </Link>
  );
}

function statusPill(item: LeadCardItem, opened: boolean): ReactNode {
  if (item.customerReplied) return <span style={S.replied}>Replied</span>;
  const s = item.status || "new";
  if (s === "booked") return <span style={S.booked}>Booked</span>;
  if (s === "won") return <span style={S.won}>Won</span>;
  if (s === "contacted") return <span style={S.responded}>Responded</span>;
  if (s === "lost") return <span style={S.lost}>Lost</span>;
  if (opened) return <span style={S.opened}>Opened</span>;
  return <span style={S.fresh}>New</span>;
}

function cardStyle(unread: boolean): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    gap: 7,
    padding: "13px 15px",
    background: unread ? "rgba(var(--brand-rgb),0.05)" : "var(--surface)",
    borderLeft: `3px solid ${unread ? "var(--brand)" : "transparent"}`
  };
}

const pill: CSSProperties = { fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: 999, whiteSpace: "nowrap", letterSpacing: 0.2, flexShrink: 0 };
const S: Record<string, CSSProperties> = {
  head: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" },
  nameWrap: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  dot: { width: 7, height: 7, borderRadius: 999, background: "var(--brand)", flexShrink: 0 },
  name: { color: "var(--ink)", fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  vehicle: { color: "var(--muted)", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", textTransform: "capitalize" },
  summary: { fontSize: 13, color: "var(--text)", lineHeight: 1.42 },
  facts: { display: "flex", flexDirection: "column", gap: 3, fontSize: 12.5, color: "var(--text)" },
  fact: { lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  factIco: { color: "var(--muted)" },
  booking: { fontSize: 12.5, fontWeight: 700, color: "var(--positive)" },
  snippet: { fontSize: 12, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.4 },
  replied: { ...pill, color: "#9a6210", background: "rgba(199,125,20,0.15)" },
  responded: { ...pill, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.14)" },
  booked: { ...pill, color: "#3a3a9a", background: "rgba(var(--brand-rgb),0.13)" },
  won: { ...pill, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.16)" },
  fresh: { ...pill, color: "var(--brand)", background: "rgba(var(--brand-rgb),0.12)" },
  opened: { ...pill, color: "#3a7bd0", background: "rgba(58,123,208,0.14)" },
  lost: { ...pill, color: "var(--muted)", background: "rgba(138,144,156,0.16)" }
};
