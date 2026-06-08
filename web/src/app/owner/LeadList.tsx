"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { isLeadUnread, loadReadMap, markLeadRead, type ReadMap } from "./leadRead";
import type { LeadRundown } from "./leadRundown";

// Shared lead grid (Today's "Needs attention" + the Callbacks tab). Each lead is a
// self-contained info card: name + vehicle, a status pill, the owner-facing rundown
// (summary, what they want, the quote, when), and the voicemail snippet — the same
// detail that used to live in a hover, now shown inline so the dashboard reads at a
// glance. An unread dot + bold name marks leads the owner hasn't opened yet.

export type LeadListItem = {
  id: string;
  name: string;
  snippet: string;
  customerReplied: boolean;
  responded: boolean;
  lastActivity: string | null;
  rundown?: LeadRundown;
  callTimeLabel?: string | null;
  voicemailLabel?: string | null;
  status?: string;
};

export function LeadList({ items }: { items: LeadListItem[] }) {
  // null until mounted, so the server render shows everything "read" (no flash of dots).
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

  const open = (item: LeadListItem) => setReadMap(markLeadRead(item.id, item.lastActivity));

  return (
    <div style={S.grid}>
      {items.map((it) => {
        const unread = readMap ? isLeadUnread(readMap, it.id, it.lastActivity) : false;
        const r = it.rundown;
        return (
          <Link
            key={it.id}
            href={`/owner/${it.id}`}
            onClick={() => open(it)}
            className="card card-tap"
            style={cardStyle(unread)}
          >
            <div style={S.head}>
              <div style={S.nameWrap}>
                <span style={{ ...S.dot, opacity: unread ? 1 : 0 }} aria-hidden />
                <strong style={{ ...S.name, fontWeight: unread ? 800 : 700 }}>{it.name}</strong>
                {r?.vehicle && <span style={S.vehicle}>· {r.vehicle}</span>}
              </div>
              {statusPill(it)}
            </div>

            {r?.summary && <div className="clamp-2" style={S.summary}>{r.summary}</div>}

            {(r?.wants || r?.when || r?.quote) && (
              <div style={S.facts}>
                {r?.wants && <div style={S.fact}>🔧 <strong>Wants:</strong> {r.wants}</div>}
                {r?.when && <div style={S.fact}>📅 <strong>Asked for:</strong> {r.when}</div>}
                {r?.quote && <div style={S.fact}>💰 <strong>Quote:</strong> {r.quote}</div>}
              </div>
            )}

            {it.snippet && <div className="clamp-2" style={S.snippet}>{it.snippet}</div>}
          </Link>
        );
      })}
    </div>
  );
}

function statusPill(it: LeadListItem): ReactNode {
  if (it.customerReplied) return <span style={S.replied}>Replied</span>;
  const s = it.status || "new";
  if (s === "booked") return <span style={S.booked}>Booked</span>;
  if (s === "won") return <span style={S.won}>Won</span>;
  if (s === "contacted") return <span style={S.responded}>Responded</span>;
  if (s === "lost") return <span style={S.lost}>Lost</span>;
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
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, alignItems: "start" },
  head: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" },
  nameWrap: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  dot: { width: 7, height: 7, borderRadius: 999, background: "var(--brand)", flexShrink: 0 },
  name: { color: "var(--ink)", fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  vehicle: { color: "var(--muted)", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", textTransform: "capitalize" },
  summary: { fontSize: 13, color: "#3c414b", lineHeight: 1.42 },
  facts: { display: "flex", flexDirection: "column", gap: 3, fontSize: 12.5, color: "#3c414b" },
  fact: { lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  snippet: { fontSize: 12, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.4 },
  replied: { ...pill, color: "#9a6210", background: "rgba(199,125,20,0.15)" },
  responded: { ...pill, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.14)" },
  booked: { ...pill, color: "#3a3a9a", background: "rgba(var(--brand-rgb),0.13)" },
  won: { ...pill, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.16)" },
  fresh: { ...pill, color: "var(--brand)", background: "rgba(var(--brand-rgb),0.12)" },
  lost: { ...pill, color: "#8a909c", background: "rgba(138,144,156,0.16)" }
};
