"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Brush, CalendarClock, MessageSquareText, Phone, Sparkles, Voicemail, type LucideIcon } from "lucide-react";

import { SettingsSaveBar } from "@/app/owner/SettingsSaveBar";
import { UnsavedChangesGuard } from "@/app/owner/UnsavedChangesGuard";

// Tabbed shell for Settings. Sections are grouped into sub-menus so the page
// isn't one long scroll — but everything stays inside ONE form: inactive tabs
// are hidden with display:none (their fields still submit + the unsaved-changes
// guard and sticky save bar keep seeing the whole form).

type TabId = "phone" | "ai" | "voicemail" | "business" | "booking" | "services";

const TABS: ReadonlyArray<{ id: TabId; label: string; Icon: LucideIcon }> = [
  { id: "phone", label: "Phone", Icon: Phone },
  { id: "ai", label: "AI & Replies", Icon: Sparkles },
  { id: "voicemail", label: "Voicemail", Icon: Voicemail },
  { id: "business", label: "Business", Icon: Brush },
  { id: "booking", label: "Hours & Weather", Icon: CalendarClock },
  { id: "services", label: "Services", Icon: MessageSquareText }
];

export function SettingsShell({
  action,
  phone,
  ai,
  voicemail,
  business,
  booking,
  services
}: {
  action: (formData: FormData) => Promise<void>;
  phone: ReactNode;
  ai: ReactNode;
  voicemail: ReactNode;
  business: ReactNode;
  booking: ReactNode;
  services: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("phone");
  const show = (id: TabId): CSSProperties => (id === tab ? {} : { display: "none" });

  return (
    <div>
      <div className="scroll-soft" style={S.tabRow} role="tablist" aria-label="Settings sections">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === tab}
            onClick={() => setTab(id)}
            className="btn"
            style={tabBtn(id === tab)}
          >
            <Icon size={14} aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {/* Phone setup lives outside the settings form (it has its own forms). */}
      <div style={{ ...show("phone"), marginTop: 14 }}>{phone}</div>

      <form id="settings-form" action={action} style={S.form}>
        <UnsavedChangesGuard formId="settings-form" />
        <div style={show("ai")}>{ai}</div>
        <div style={show("voicemail")}>{voicemail}</div>
        <div style={show("business")}>{business}</div>
        <div style={show("booking")}>{booking}</div>
        <div style={show("services")}>{services}</div>
        {tab !== "phone" && (
          <button type="submit" className="btn" style={S.save}>Save settings</button>
        )}
        <SettingsSaveBar formId="settings-form" />
      </form>
    </div>
  );
}

function tabBtn(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 14px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: 650,
    whiteSpace: "nowrap",
    cursor: "pointer",
    flexShrink: 0,
    border: `1px solid ${active ? "var(--brand)" : "var(--border-strong)"}`,
    background: active ? "var(--brand)" : "var(--surface)",
    color: active ? "#fff" : "var(--text)",
    boxShadow: active ? "0 2px 8px rgba(var(--brand-rgb),0.3)" : "var(--shadow-xs)"
  };
}

const S: Record<string, CSSProperties> = {
  tabRow: { display: "flex", gap: 6, marginTop: 14, overflowX: "auto", paddingBottom: 4 },
  form: { marginTop: 14, display: "flex", flexDirection: "column", gap: 14 },
  save: { alignSelf: "flex-start", padding: "11px 18px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }
};
