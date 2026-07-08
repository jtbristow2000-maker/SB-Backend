"use client";

import { useTransition } from "react";
import type { CSSProperties } from "react";
import { MessageSquareText, Phone } from "lucide-react";

import { markContacted } from "@/app/owner/actions";

// Contact-header quick actions, Messages-style: circular icon buttons with a tiny
// label. Tapping either opens the phone's dialer or Messages app (tel:/sms:) AND
// records that the owner reached out, so the lead flips to "Responded" on the
// dashboards. The status write fires in the background; navigation is never blocked.
export function ContactButtons({ phone, profileId }: { phone: string; profileId: string }) {
  const [, startTransition] = useTransition();

  const recordReachOut = () => {
    const fd = new FormData();
    fd.set("profileId", profileId);
    startTransition(() => {
      void markContacted(fd);
    });
  };

  return (
    <div style={S.row}>
      <a href={`tel:${phone}`} onClick={recordReachOut} style={S.action} title="Call them from your own phone">
        <span className="btn" style={{ ...S.circle, background: "var(--positive)", color: "#fff", boxShadow: "0 2px 8px rgba(var(--positive-rgb),0.35)" }}>
          <Phone size={18} aria-hidden />
        </span>
        <span style={S.label}>Call</span>
      </a>
      <a href={`sms:${phone}`} onClick={recordReachOut} style={S.action} title="Text them from your own phone">
        <span className="btn" style={{ ...S.circle, background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-strong)", boxShadow: "var(--shadow-xs)" }}>
          <MessageSquareText size={18} aria-hidden />
        </span>
        <span style={S.label}>Text</span>
      </a>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  row: { display: "flex", gap: 14, flexShrink: 0 },
  action: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, textDecoration: "none" },
  circle: { width: 44, height: 44, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  label: { fontSize: 10.5, fontWeight: 600, color: "var(--muted)" }
};
