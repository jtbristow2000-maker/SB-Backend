"use client";

import { useEffect, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { BadgeDollarSign, CalendarClock, Check, ChevronRight, ShieldCheck, Sparkles, Wrench, X, type LucideIcon } from "lucide-react";

import { saveCustomerDetails, setLeadPersonal } from "@/app/owner/actions";

// The lead's identity, iMessage-style: avatar + name up top, and tapping it opens
// a contact card (modal) with what they asked for (AI-read facts), the editable
// customer details, and job history. Replaces the old orphaned "Customer details"
// accordion at the bottom of the page.

export type PastJob = { id: string; title: string; when: string; done: boolean };
export type ContactFact = { label: string; value: string };

const FACT_ICONS: Record<string, LucideIcon> = {
  Service: Wrench,
  "Asked for": CalendarClock,
  Ballpark: BadgeDollarSign
};

export function LeadContactCard({
  profileId,
  name,
  phoneLabel,
  lastHeard,
  replied,
  firstTime,
  vehiclesValue,
  poBox,
  contactValue,
  referral,
  autoFilled,
  facts = [],
  pastJobs,
  isPersonal = false
}: {
  profileId: string;
  name: string;
  phoneLabel: string;
  lastHeard: string | null;
  replied: boolean;
  firstTime: boolean;
  vehiclesValue: string;
  poBox: string;
  contactValue: string;
  referral: string;
  autoFilled: boolean;
  facts?: ContactFact[];
  pastJobs: PastJob[];
  isPersonal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [personal, setPersonal] = useState(isPersonal);
  const [, startTransition] = useTransition();
  const togglePersonal = () => {
    const next = !personal;
    setPersonal(next); // optimistic
    const fd = new FormData();
    fd.set("profileId", profileId);
    fd.set("personal", next ? "1" : "0");
    startTransition(async () => {
      await setLeadPersonal(fd);
    });
  };

  // Esc closes; lock body scroll while the card is up.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "#";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn" style={S.trigger} aria-haspopup="dialog">
        <span style={S.avatar}>{initials}</span>
        <span style={S.id}>
          <span style={S.nameRow}>
            <span className="clamp-1" style={S.name}>{name}</span>
            <ChevronRight size={16} style={S.chev} aria-hidden />
            {firstTime && <span style={S.firstTime}>First-time</span>}
            {replied && <span style={S.replied}>Replied</span>}
          </span>
          <span style={S.sub}>
            {phoneLabel}
            {lastHeard ? ` · ${lastHeard}` : ""}
          </span>
        </span>
      </button>

      {open && (
        <div style={S.overlay} onClick={() => setOpen(false)} role="presentation">
          <div style={S.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Customer details">
            <div style={S.sheetHead}>
              <span style={{ ...S.avatar, width: 52, height: 52, fontSize: 19, borderRadius: 999 }}>{initials}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ ...S.name, fontSize: 18 }}>{name}</div>
                <div style={S.sub}>{phoneLabel}</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="btn" style={S.close} aria-label="Close">
                <X size={17} aria-hidden />
              </button>
            </div>

            <button type="button" onClick={togglePersonal} className="btn" style={personalBtn(personal)}>
              <ShieldCheck size={14} aria-hidden />
              {personal ? "Personal contact — no auto-texts" : "Mark as personal (friend/family)"}
            </button>
            {personal && (
              <div style={S.personalHint}>They&apos;ll never get business texts, and their calls stay out of your leads.</div>
            )}

            {facts.length > 0 && (
              <div style={S.factsBox}>
                {facts.map((f) => {
                  const Icon = FACT_ICONS[f.label];
                  return (
                    <div key={f.label} style={S.factRow}>
                      {Icon ? <Icon size={14} style={{ color: "var(--muted)", flexShrink: 0 }} aria-hidden /> : null}
                      <span style={S.factLabel}>{f.label}</span>
                      <span className="clamp-1" style={S.factValue}>{f.value}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <form action={saveCustomerDetails} style={S.form}>
              <input type="hidden" name="profileId" value={profileId} />
              {autoFilled && (
                <div style={S.autoHint}>
                  <Sparkles size={12} className="ico-inline" aria-hidden /> Filled in from their voicemail — hit Save to keep it.
                </div>
              )}
              <label style={S.fieldLabel}>Vehicle(s)
                <input name="vehicles" defaultValue={vehiclesValue} placeholder="e.g. 2019 Tahoe; wife's Civic" className="input" style={S.fieldInput} autoComplete="off" />
              </label>
              <label style={S.fieldLabel}>Address / PO box
                <input name="po_box" defaultValue={poBox} placeholder="123 Main St / PO Box 45" className="input" style={S.fieldInput} autoComplete="off" />
              </label>
              <label style={S.fieldLabel}>Preferred contact
                <select name="preferred_contact" defaultValue={contactValue} className="input" style={S.fieldInput}>
                  <option value="">No preference</option>
                  <option value="call">Call</option>
                  <option value="text">Text</option>
                  <option value="email">Email</option>
                </select>
              </label>
              <label style={S.fieldLabel}>How did they hear about you?
                <input name="referral_source" defaultValue={referral} placeholder="e.g. Google, referral, truck sign" className="input" style={S.fieldInput} autoComplete="off" />
              </label>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }}>Save</button>
            </form>

            {pastJobs.length > 0 && (
              <div style={S.history}>
                <div style={S.historyTitle}>Job history</div>
                {pastJobs.map((j) => (
                  <div key={j.id} style={S.historyRow}>
                    <span className="clamp-1" style={{ minWidth: 0 }}>{j.title}</span>
                    <span style={S.historyWhen}>
                      {j.when}
                      {j.done && <Check size={12} className="ico-inline" style={{ color: "var(--positive)", marginLeft: 4 }} aria-hidden />}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function personalBtn(on: boolean): CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 12,
    padding: "8px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 650, cursor: "pointer",
    border: `1px solid ${on ? "rgba(var(--positive-rgb),0.5)" : "var(--border-strong)"}`,
    background: on ? "rgba(var(--positive-rgb),0.12)" : "var(--surface)",
    color: on ? "#1d6b4f" : "var(--text)"
  };
}

const S: Record<string, CSSProperties> = {
  trigger: { display: "flex", alignItems: "center", gap: 12, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0, font: "inherit" },
  personalHint: { fontSize: 12, color: "var(--muted)", margin: "-6px 0 12px", lineHeight: 1.4 },
  avatar: {
    width: 46, height: 46, borderRadius: 999, flexShrink: 0,
    background: "linear-gradient(135deg, var(--brand), var(--brand-strong))",
    color: "#fff", fontWeight: 700, fontSize: 17, letterSpacing: 0.3,
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 2px 8px rgba(var(--brand-rgb),0.3)"
  },
  id: { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 },
  nameRow: { display: "flex", alignItems: "center", gap: 6, minWidth: 0 },
  name: { fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.4px", minWidth: 0 },
  chev: { color: "var(--faint)", flexShrink: 0 },
  sub: { color: "var(--muted)", fontSize: 13 },
  firstTime: { fontSize: 10.5, fontWeight: 700, color: "#8a5a0c", background: "rgba(199,125,20,0.14)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 },
  replied: { fontSize: 10.5, fontWeight: 700, color: "var(--positive)", background: "rgba(var(--positive-rgb),0.12)", padding: "2px 8px", borderRadius: 999, whiteSpace: "nowrap", flexShrink: 0 },

  overlay: { position: "fixed", inset: 0, zIndex: 50, background: "rgba(15,17,22,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(2px)" },
  sheet: { width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto", background: "var(--surface)", borderRadius: 20, boxShadow: "var(--shadow-lg)", padding: "20px 20px 22px" },
  sheetHead: { display: "flex", alignItems: "center", gap: 14, marginBottom: 16 },
  factsBox: { display: "flex", flexDirection: "column", gap: 7, padding: "11px 13px", borderRadius: 12, background: "#f6f7f9", border: "1px solid var(--border)", marginBottom: 14 },
  factRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, minWidth: 0 },
  factLabel: { fontWeight: 700, color: "var(--text)", width: 72, flexShrink: 0 },
  factValue: { color: "var(--ink)", minWidth: 0, textTransform: "capitalize" },
  close: { marginLeft: "auto", width: 34, height: 34, borderRadius: 999, border: "none", background: "#f1f2f5", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  form: { display: "flex", flexDirection: "column", gap: 11 },
  autoHint: { fontSize: 12.5, color: "#3a3a9a", background: "rgba(var(--brand-rgb),0.08)", padding: "8px 11px", borderRadius: 9, lineHeight: 1.4 },
  fieldLabel: { display: "flex", flexDirection: "column", gap: 5, fontSize: 12.5, fontWeight: 700, color: "var(--text)" },
  fieldInput: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit" },
  history: { marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 },
  historyTitle: { fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 },
  historyRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 13.5, color: "var(--ink)", borderBottom: "1px solid var(--border)" },
  historyWhen: { color: "var(--muted)", fontSize: 12.5, whiteSpace: "nowrap", flexShrink: 0 }
};
