"use client";

import { useTransition } from "react";
import type { CSSProperties } from "react";

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
      <a href={`tel:${phone}`} style={S.call} onClick={recordReachOut}>📞 Call back</a>
      <a href={`sms:${phone}`} style={S.text} onClick={recordReachOut}>💬 Text</a>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  row: { display: "flex", gap: 10, margin: "12px 0 4px" },
  call: { flex: 1, textAlign: "center", padding: "12px", borderRadius: 11, background: "var(--positive)", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" },
  text: { flex: 1, textAlign: "center", padding: "12px", borderRadius: 11, background: "#fff", border: "1px solid #d8dce3", color: "#1e2026", fontWeight: 700, fontSize: 15, textDecoration: "none" }
};
