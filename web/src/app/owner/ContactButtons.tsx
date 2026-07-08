"use client";

import { useTransition } from "react";
import type { CSSProperties } from "react";
import { MessageSquareText, Phone } from "lucide-react";

import { markContacted } from "@/app/owner/actions";

// Call / Text quick actions. Tapping either opens the phone's dialer or Messages
// app (tel:/sms:) AND records that the owner reached out, so the lead flips to
// "Responded" on the dashboards. The status write fires in the background; the
// link navigation is never blocked.
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
      <a href={`tel:${phone}`} className="btn" style={S.call} onClick={recordReachOut}>
        <Phone size={16} aria-hidden /> Call back
      </a>
      <a href={`sms:${phone}`} className="btn" style={S.text} onClick={recordReachOut}>
        <MessageSquareText size={16} aria-hidden /> Text
      </a>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  row: { display: "flex", gap: 10, margin: "12px 0 4px" },
  call: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: "var(--radius)", background: "var(--positive)", color: "#fff", fontWeight: 700, fontSize: 15 },
  text: { flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", borderRadius: "var(--radius)", background: "var(--surface)", border: "1px solid var(--border-strong)", color: "var(--ink)", fontWeight: 700, fontSize: 15 }
};
