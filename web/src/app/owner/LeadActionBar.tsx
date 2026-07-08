"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { CalendarCheck2, CalendarPlus, Check, ChevronDown, Trophy } from "lucide-react";

import { createAppointment, markCallbackDone, markLeadWon, setProfileStatus } from "@/app/owner/actions";

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
  bookNotes,
  prefilledStart,
  confirmedLabel
}: {
  profileId: string;
  status: string;
  openTaskId: string | null;
  bookTitle: string;
  bookService: string;
  bookNotes: string;
  prefilledStart?: string;   // datetime-local value when customer confirmed a time
  confirmedLabel?: string;   // human-readable label for the confirmed slot
}) {
  const [booking, setBooking] = useState(() => Boolean(prefilledStart));

  return (
    <div style={S.wrap}>
      <div style={S.row}>
        <form action={setProfileStatus} style={S.inline}>
          <input type="hidden" name="profileId" value={profileId} />
          <select
            name="status"
            defaultValue={status}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="input"
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
            <button type="submit" className="btn" style={S.btn}><Check size={14} aria-hidden /> Mark done</button>
          </form>
        )}

        <button type="button" onClick={() => setBooking((v) => !v)} className="btn" style={booking ? S.btnOn : S.btnBook}>
          <CalendarPlus size={14} aria-hidden /> {confirmedLabel ? `Book — ${confirmedLabel}` : "Book the job"}{booking ? <ChevronDown size={13} aria-hidden /> : null}
        </button>

        <span style={S.spacer} />

        <form action={markLeadWon} style={S.inline}>
          <input type="hidden" name="profileId" value={profileId} />
          <button type="submit" className="btn" style={S.btnWon} title="Job done — marks the lead won and completes its appointments"><Trophy size={14} aria-hidden /> Won</button>
        </form>
        <form action={setProfileStatus} style={S.inline}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="status" value="lost" />
          <button type="submit" className="btn" style={S.btnLost}>Lost</button>
        </form>
      </div>

      {confirmedLabel && !booking && (
        <div style={S.confirmedBanner}>
          <CalendarCheck2 size={14} className="ico-inline" aria-hidden /> Customer confirmed <strong>{confirmedLabel}</strong> — tap <em>Book</em> above to lock it in.
        </div>
      )}

      {booking && (
        <form action={createAppointment} style={S.bookForm}>
          <input type="hidden" name="profileId" value={profileId} />
          <input type="hidden" name="title" value={bookTitle} />
          <input type="hidden" name="service" value={bookService} />
          <input type="hidden" name="notes" value={bookNotes} />
          <input name="start" type="datetime-local" required defaultValue={prefilledStart ?? ""} className="input" style={S.input} aria-label="Appointment time" />
          <select name="duration" defaultValue="60" className="input" style={S.input} aria-label="Duration">
            <option value="30">30m</option>
            <option value="60">1h</option>
            <option value="90">1.5h</option>
            <option value="120">2h</option>
            <option value="180">3h</option>
            <option value="240">4h</option>
          </select>
          <button type="submit" className="btn" style={S.btnPrimary}>Add to schedule</button>
        </form>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  wrap: { margin: "10px 0 2px" },
  row: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  inline: { display: "inline-flex" },
  select: { padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13, background: "#fff", color: "#1e2026", cursor: "pointer", fontWeight: 600 },
  btn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 9, border: "1px solid #d8dce3", background: "#fff", color: "var(--text)", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  btnBook: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "1px solid rgba(var(--brand-rgb),0.4)", background: "rgba(var(--brand-rgb),0.08)", color: "#2a2a8a", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnOn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 9, border: "1px solid var(--brand)", background: "rgba(var(--brand-rgb),0.12)", color: "#2a2a8a", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  spacer: { flex: 1 },
  bookForm: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "#f6f7f9", border: "1px solid var(--border)" },
  input: { padding: "8px 10px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13, background: "#fff" },
  btnPrimary: { padding: "8px 13px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnWon: { display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 11px", borderRadius: 9, border: "1px solid rgba(var(--positive-rgb),0.4)", background: "rgba(var(--positive-rgb),0.12)", color: "#1d6b4f", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  btnLost: { padding: "7px 11px", borderRadius: 9, border: "1px solid #e7c6c6", background: "#fff", color: "#b23b3b", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  confirmedBanner: { marginTop: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(var(--positive-rgb),0.1)", border: "1px solid rgba(var(--positive-rgb),0.2)", color: "#1d6b4f", fontSize: 13, lineHeight: 1.4 }
};
