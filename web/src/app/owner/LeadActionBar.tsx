"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

import { createAppointment, markCallbackDone, setProfileStatus } from "@/app/owner/actions";

// Compact secondary toolbar for a lead: status (auto-saves on change), mark-callback-done,
// and a Book button that reveals the booking fields on demand — so the page isn't cluttered
// with an always-open form. Primary contact actions (Call/Text) live above this.

const STATUSES = ["new", "contacted", "booked", "won", "lost"];

export function LeadActionBar({
  profileId,
  status,
  openTaskId,
  bookTitle,
  bookService,
  bookNotes
}: {
  profileId: string;
  status: string;
  openTaskId: string | null;
  bookTitle: string;
  bookService: string;
  bookNotes: string;
}) {
  const [booking, setBooking] = useState(false);

  return (
    <div style={S.wrap}>
      <div style={S.row}>
        <form action={setProfileStatus} style={S.inline}>
          <input type="hidden" name="profileId" value={profileId} />
          <select
            name="status"
            defaultValue={status}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            style={S.select}
            aria-label="Lead status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </form>

        {openTaskId && (
          <form action={markCallbackDone} style={S.inline}>
            <input type="hidden" name="taskId" value={openTaskId} />
            <input type="hidden" name="profileId" value={profileId} />
            <button type="submit" style={S.btn}>✓ Mark done</button>
          </form>
        )}

        <button type="button" onClick={() => setBooking((v) => !v)} style={booking ? S.btnOn : S.btn}>
          📅 Book{booking ? " ▾" : ""}
        </button>
      </div>

      {booking && (
        <form action={createAppointment} style={S.bookForm}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="title" value={bookTitle} />
          <input type="hidden" name="service" value={bookService} />
          <input type="hidden" name="notes" value={bookNotes} />
          <input name="start" type="datetime-local" required style={S.input} aria-label="Appointment time" />
          <select name="duration" defaultValue="60" style={S.input} aria-label="Duration">
            <option value="30">30m</option>
            <option value="60">1h</option>
            <option value="90">1.5h</option>
            <option value="120">2h</option>
            <option value="180">3h</option>
            <option value="240">4h</option>
          </select>
          <button type="submit" style={S.btnPrimary}>Add to schedule</button>
        </form>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { margin: "10px 0 2px" },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  inline: { display: "inline-flex" },
  select: { padding: "7px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13, background: "#fff", color: "#1e2026", cursor: "pointer" },
  btn: { padding: "7px 11px", borderRadius: 9, border: "1px solid #d8dce3", background: "#fff", color: "#3c414b", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btnOn: { padding: "7px 11px", borderRadius: 9, border: "1px solid var(--brand)", background: "rgba(var(--brand-rgb),0.1)", color: "#2a2a8a", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  bookForm: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#f6f7f9", border: "1px solid #eceef2" },
  input: { padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13, background: "#fff" },
  btnPrimary: { padding: "8px 13px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }
};
