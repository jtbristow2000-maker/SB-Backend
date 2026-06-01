"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

import { isLeadUnread, loadReadMap, markLeadRead, type ReadMap } from "./leadRead";

// Shared triage list (Today's "Needs attention" + the Callbacks tab). Decorates each
// lead with an unread dot/bold (until opened), a "Replied" cue when the customer is
// waiting on the owner, and a "Responded" pill once the owner has reached out.

export type LeadListItem = {
  id: string;
  name: string;
  snippet: string;
  customerReplied: boolean;
  responded: boolean;
  lastActivity: string | null;
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
    <div>
      {items.map((it) => {
        const unread = readMap ? isLeadUnread(readMap, it.id, it.lastActivity) : false;
        return (
          <Link key={it.id} href={`/owner/${it.id}`} onClick={() => open(it)} style={rowStyle(unread)}>
            <div style={S.top}>
              <div style={S.nameWrap}>
                <span style={{ ...S.dot, opacity: unread ? 1 : 0 }} aria-hidden />
                <strong style={{ ...S.name, fontWeight: unread ? 800 : 600 }}>{it.name}</strong>
              </div>
              <div style={S.pills}>
                {it.customerReplied && <span style={S.replied}>Replied</span>}
                {it.responded && <span style={S.responded}>Responded</span>}
              </div>
            </div>
            <div style={S.meta}>{it.snippet}</div>
          </Link>
        );
      })}
    </div>
  );
}

function rowStyle(unread: boolean): CSSProperties {
  return {
    display: "block",
    textDecoration: "none",
    padding: "13px 15px",
    marginBottom: 9,
    borderRadius: 13,
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
  meta: { color: "#3c414b", fontSize: 13, marginTop: 3 }
};
