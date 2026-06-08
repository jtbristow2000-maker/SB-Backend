"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { isLeadUnread, loadReadMap, markLeadRead, type ReadMap } from "./leadRead";
import type { LeadRundown } from "./leadRundown";

// Shared triage list (Today's "Needs attention" + the Callbacks tab). Decorates each
// lead with an unread dot/bold (until opened), a "Replied" cue when the customer is
// waiting on the owner, and a "Responded" pill once the owner has reached out. Hovering
// a row shows an owner-facing rundown (what they want, the quote, when).

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
  const [hover, setHover] = useState<{ item: LeadListItem; left: number; top: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  const showHover = (item: LeadListItem, rect: DOMRect) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const vw = typeof window !== "undefined" ? window.innerWidth : 360;
    setHover({ item, left: Math.min(Math.max(rect.left, 8), vw - 300), top: rect.bottom + 6 });
  };
  const queueHide = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHover(null), 150);
  };
  const cancelHide = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  return (
    <div>
      {items.map((it) => {
        const unread = readMap ? isLeadUnread(readMap, it.id, it.lastActivity) : false;
        return (
          <Link
            key={it.id}
            href={`/owner/${it.id}`}
            onClick={() => open(it)}
            onMouseEnter={(e) => showHover(it, e.currentTarget.getBoundingClientRect())}
            onMouseLeave={queueHide}
            style={rowStyle(unread)}
          >
            <div style={S.top}>
              <div style={S.nameWrap}>
                <span style={{ ...S.dot, opacity: unread ? 1 : 0 }} aria-hidden />
                <strong style={{ ...S.name, fontWeight: unread ? 800 : 600 }}>{it.name}</strong>
                {it.rundown?.vehicle && <span style={S.vehicle}>· {it.rundown.vehicle}</span>}
              </div>
              {statusPill(it)}
            </div>
            <div style={S.need}>{needLine(it)}</div>
          </Link>
        );
      })}

      {hover && (
        <RundownCard
          item={hover.item}
          left={hover.left}
          top={hover.top}
          onEnter={cancelHide}
          onLeave={queueHide}
        />
      )}
    </div>
  );
}

function RundownCard({
  item,
  left,
  top,
  onEnter,
  onLeave
}: {
  item: LeadListItem;
  left: number;
  top: number;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const r = item.rundown;
  return (
    <div style={{ ...S.hoverCard, left, top }} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div style={S.hoverName}>
        {item.name}
        {item.rundown?.vehicle ? <span style={S.vehicle}>· {item.rundown.vehicle}</span> : null}
        {statusPill(item)}
      </div>
      {r?.summary && <div style={S.hoverRow}>{r.summary}</div>}
      {r?.wants && <div style={S.hoverRow}>🔧 <strong>Wants:</strong> {r.wants}</div>}
      {r?.quote && <div style={S.hoverRow}>💰 <strong>Quote:</strong> {r.quote}</div>}
      {r?.when && <div style={S.hoverRow}>📅 <strong>Asked for:</strong> {r.when}</div>}
      {(item.voicemailLabel || item.callTimeLabel) && (
        <div style={S.hoverRow}>🎙️ {[item.voicemailLabel, item.callTimeLabel].filter(Boolean).join(" · ")}</div>
      )}
      {item.snippet && <div style={S.hoverMuted}>“{item.snippet}”</div>}
      <div style={S.hoverHint}>Click to open</div>
    </div>
  );
}

function needLine(it: LeadListItem): string {
  const r = it.rundown;
  if (r?.wants) return r.when ? `${r.wants} · ${r.when}` : r.wants;
  if (r?.summary) return r.summary;
  return it.snippet;
}

function statusPill(it: LeadListItem): ReactNode {
  if (it.customerReplied) return <span style={S.replied}>Replied</span>;
  const s = it.status || "new";
  if (s === "booked") return <span style={S.booked}>Booked</span>;
  if (s === "won") return <span style={S.won}>Won</span>;
  if (s === "contacted") return <span style={S.responded}>Responded</span>;
  return null;
}

function rowStyle(unread: boolean): CSSProperties {
  return {
    display: "block",
    textDecoration: "none",
    padding: "10px 13px",
    marginBottom: 7,
    borderRadius: 11,
    background: unread ? "rgba(var(--brand-rgb),0.05)" : "#fff",
    border: "1px solid #eceef2",
    borderLeft: `3px solid ${unread ? "var(--brand)" : "#e3e6ec"}`,
    boxShadow: "0 1px 3px rgba(17,21,28,0.05)"
  };
}

const S: Record<string, CSSProperties> = {
  top: { display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" },
  nameWrap: { display: "flex", alignItems: "center", gap: 8, minWidth: 0 },
  dot: { width: 8, height: 8, borderRadius: 999, background: "var(--brand)", flexShrink: 0 },
  name: { color: "#15171b", fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  pills: { display: "flex", gap: 6, flexShrink: 0 },
  replied: { fontSize: 11, fontWeight: 700, color: "#9a6210", background: "rgba(199,125,20,0.14)", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  responded: { fontSize: 11, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.14)", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  meta: { color: "#3c414b", fontSize: 13, marginTop: 3 },
  subMeta: { color: "#9aa0b3", fontSize: 11.5, marginTop: 3 },
  vehicle: { color: "#8a909c", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", textTransform: "capitalize" },
  need: { color: "#3c414b", fontSize: 12.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  booked: { fontSize: 11, fontWeight: 700, color: "#3a3a9a", background: "rgba(var(--brand-rgb),0.12)", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  won: { fontSize: 11, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.14)", padding: "2px 9px", borderRadius: 999, whiteSpace: "nowrap" },
  hoverCard: { position: "fixed", width: 288, maxWidth: "calc(100vw - 16px)", background: "#fff", border: "1px solid #e3e6ec", borderRadius: 12, boxShadow: "0 8px 28px rgba(17,21,28,0.18)", padding: "11px 13px", fontSize: 13, lineHeight: 1.45, color: "#1e2026", zIndex: 900 },
  hoverName: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontWeight: 700, fontSize: 14, marginBottom: 5 },
  hoverRow: { marginTop: 3 },
  hoverMuted: { marginTop: 3, color: "#3c414b", fontStyle: "italic" },
  hoverHint: { marginTop: 8, paddingTop: 6, borderTop: "1px solid #f1f2f5", fontSize: 11, color: "#8a909c" }
};
