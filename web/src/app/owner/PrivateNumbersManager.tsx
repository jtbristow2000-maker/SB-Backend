"use client";

import { useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { BookUser, Check, Plus, Upload, X } from "lucide-react";

import { addPrivateNumbers, removePrivateNumber } from "@/app/owner/actions";
import { fmtPhone } from "@/app/owner/format";
import type { PrivateNumberEntry } from "@/server/business/settings";

// Manages the "private numbers" list (Settings → Privacy). Three ways in:
// type/paste one, import a contacts file (.vcf — parsed right here in the
// browser, nothing uploaded), or the native contact picker where the browser
// supports it (Android Chrome). Buttons call server actions directly (no <form>
// — this sits inside the big settings form, and forms can't nest).

type Candidate = { name: string; phone: string; checked: boolean };

function parseVcf(text: string): { name: string; phone: string }[] {
  const out: { name: string; phone: string }[] = [];
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  for (const card of cards) {
    const nameMatch = /(?:^|\n)FN[^:]*:(.+)/i.exec(card);
    const name = nameMatch ? nameMatch[1].trim().replace(/\r$/, "") : "";
    const telRegex = /(?:^|\n)TEL[^:]*:([+\d()\-. ]{7,})/gi;
    let m: RegExpExecArray | null;
    while ((m = telRegex.exec(card)) !== null) {
      const phone = m[1].trim();
      if (phone) out.push({ name, phone });
    }
  }
  return out;
}

type ContactPickerResult = { name?: string[]; tel?: string[] };
type ContactsApi = { select: (props: string[], opts: { multiple: boolean }) => Promise<ContactPickerResult[]> };

function getContactsApi(): ContactsApi | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsApi };
  return nav.contacts && typeof nav.contacts.select === "function" ? nav.contacts : null;
}

export function PrivateNumbersManager({ initial }: { initial: PrivateNumberEntry[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pickerAvailable = getContactsApi() !== null;

  const submitEntries = (entries: { name: string; phone: string }[]) => {
    if (entries.length === 0) return;
    const fd = new FormData();
    fd.set("payload", JSON.stringify(entries));
    startTransition(async () => {
      await addPrivateNumbers(fd);
      setNote(`Added ${entries.length} ${entries.length === 1 ? "number" : "numbers"}.`);
      setTimeout(() => setNote(null), 2500);
    });
  };

  const addManual = () => {
    if (!phone.trim()) return;
    submitEntries([{ name: name.trim(), phone: phone.trim() }]);
    setName("");
    setPhone("");
  };

  const remove = (p: string) => {
    const fd = new FormData();
    fd.set("phone", p);
    startTransition(async () => {
      await removePrivateNumber(fd);
    });
  };

  const onFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseVcf(text);
    if (parsed.length === 0) {
      setNote("Couldn't find any numbers in that file.");
      setTimeout(() => setNote(null), 3000);
      return;
    }
    setCandidates(parsed.map((p) => ({ ...p, checked: false })));
  };

  const openPicker = async () => {
    const api = getContactsApi();
    if (!api) return;
    try {
      const picked = await api.select(["name", "tel"], { multiple: true });
      const entries = picked.flatMap((c) =>
        (c.tel ?? []).map((t) => ({ name: c.name?.[0] ?? "", phone: t }))
      );
      if (entries.length > 0) submitEntries(entries);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div>
      {/* Manual add */}
      <div style={S.addRow}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Mom)"
          className="input"
          style={S.nameInput}
          autoComplete="off"
        />
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }}
          placeholder="(404) 555-1234"
          type="tel"
          className="input"
          style={S.phoneInput}
          autoComplete="off"
        />
        <button type="button" onClick={addManual} disabled={pending || !phone.trim()} className="btn" style={S.addBtn}>
          <Plus size={14} aria-hidden /> Add
        </button>
      </div>

      {/* Bulk imports */}
      <div style={S.importRow}>
        <button type="button" onClick={() => fileRef.current?.click()} className="btn" style={S.importBtn}>
          <Upload size={13} aria-hidden /> Import contacts file (.vcf)
        </button>
        {pickerAvailable && (
          <button type="button" onClick={openPicker} className="btn" style={S.importBtn}>
            <BookUser size={13} aria-hidden /> Pick from contacts
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".vcf,text/vcard,text/x-vcard"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      <div style={S.privacyNote}>Your contacts are read on your phone, not uploaded — only the numbers you check get saved.</div>
      {note && <div style={S.note}>{note}</div>}

      {/* The saved list */}
      {initial.length > 0 && (
        <div style={S.list}>
          {initial.map((p) => (
            <div key={p.phone} style={S.row}>
              <span className="clamp-1" style={S.rowName}>{p.name || "—"}</span>
              <span style={S.rowPhone}>{fmtPhone(p.phone)}</span>
              <button type="button" onClick={() => remove(p.phone)} disabled={pending} className="btn" style={S.removeBtn} aria-label={`Remove ${p.name || p.phone}`}>
                <X size={13} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Import checklist */}
      {candidates && (
        <div style={S.overlay} onClick={() => setCandidates(null)} role="presentation">
          <div style={S.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose private contacts">
            <div style={S.sheetHead}>
              <strong style={{ fontSize: 15 }}>Tap everyone who&apos;s personal</strong>
              <button type="button" onClick={() => setCandidates(null)} className="btn" style={S.closeBtn} aria-label="Close"><X size={15} aria-hidden /></button>
            </div>
            <div style={S.sheetHint}>{candidates.filter((c) => c.checked).length} selected of {candidates.length}</div>
            <div className="scroll-soft" style={S.candList}>
              {candidates.map((c, i) => (
                <button
                  key={`${c.phone}-${i}`}
                  type="button"
                  onClick={() => setCandidates((prev) => prev?.map((x, j) => (j === i ? { ...x, checked: !x.checked } : x)) ?? null)}
                  className="btn"
                  style={candRow(c.checked)}
                >
                  <span style={candCheck(c.checked)}>{c.checked ? <Check size={12} strokeWidth={3} aria-hidden /> : null}</span>
                  <span className="clamp-1" style={{ minWidth: 0, flex: 1, textAlign: "left" }}>{c.name || "No name"}</span>
                  <span style={S.candPhone}>{c.phone}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={pending || candidates.every((c) => !c.checked)}
              onClick={() => {
                submitEntries(candidates.filter((c) => c.checked).map(({ name: n, phone: p }) => ({ name: n, phone: p })));
                setCandidates(null);
              }}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 12 }}
            >
              Add {candidates.filter((c) => c.checked).length || ""} to private list
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function candRow(on: boolean): CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    padding: "9px 11px", borderRadius: 10, cursor: "pointer", font: "inherit", fontSize: 13.5,
    border: `1px solid ${on ? "var(--brand)" : "var(--border)"}`,
    background: on ? "rgba(var(--brand-rgb),0.07)" : "var(--surface)",
    color: "var(--ink)", marginBottom: 6, textAlign: "left"
  };
}
function candCheck(on: boolean): CSSProperties {
  return {
    width: 20, height: 20, borderRadius: 6, flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: `1.5px solid ${on ? "var(--brand)" : "var(--border-strong)"}`,
    background: on ? "var(--brand)" : "transparent", color: "#fff"
  };
}

const S: Record<string, CSSProperties> = {
  addRow: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  nameInput: { flex: "1 1 130px", maxWidth: 180, padding: "9px 11px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 13.5 },
  phoneInput: { flex: "1 1 150px", maxWidth: 200, padding: "9px 11px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 13.5 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 14px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  importRow: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 },
  importBtn: { display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 13px", borderRadius: 999, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  privacyNote: { marginTop: 8, fontSize: 11.5, color: "var(--faint)", lineHeight: 1.4 },
  note: { marginTop: 8, fontSize: 12.5, fontWeight: 600, color: "var(--positive)" },
  list: { marginTop: 12, borderTop: "1px solid var(--border)" },
  row: { display: "flex", alignItems: "center", gap: 10, padding: "9px 2px", borderBottom: "1px solid var(--border)" },
  rowName: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: "var(--ink)" },
  rowPhone: { fontSize: 13, color: "var(--muted)", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap" },
  removeBtn: { width: 28, height: 28, borderRadius: 999, border: "none", background: "#f1f2f5", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },

  overlay: { position: "fixed", inset: 0, zIndex: 60, background: "rgba(15,17,22,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(2px)" },
  sheet: { width: "100%", maxWidth: 440, maxHeight: "82vh", display: "flex", flexDirection: "column", background: "var(--surface)", borderRadius: 18, boxShadow: "var(--shadow-lg)", padding: "18px 18px 16px" },
  sheetHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sheetHint: { fontSize: 12, color: "var(--muted)", margin: "4px 0 10px" },
  closeBtn: { width: 30, height: 30, borderRadius: 999, border: "none", background: "#f1f2f5", color: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 },
  candList: { overflowY: "auto", minHeight: 0 },
  candPhone: { fontSize: 12, color: "var(--muted)", fontFamily: "ui-monospace, monospace", whiteSpace: "nowrap", flexShrink: 0 }
};
