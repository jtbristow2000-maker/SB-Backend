import type { CSSProperties } from "react";

import { saveSettings } from "@/app/owner/actions";
import { PhoneNumberSection } from "@/app/owner/PhoneNumberSection";
import { QuoteRangesEditor } from "@/app/owner/QuoteRangesEditor";
import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings } from "@/server/business/settings";
import { buildBusinessNumberReadModel, type BusinessNumberReadModel } from "@/server/telephony/numberState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
];

export default async function SettingsPage() {
  const context = await getOwnerBusinessContext();
  const business = context?.business ?? null;
  const settings = getBusinessSettings(business);
  let numberModel: BusinessNumberReadModel | null = null;
  if (context?.rt && business) {
    const portRequest = await context.rt.numberPortRequestRepository
      .findLatestByBusinessId(business.id)
      .catch(() => null);
    numberModel = buildBusinessNumberReadModel(business, portRequest);
  }

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Settings</h1>
      <div style={S.sub}>Customize how your assistant looks and replies. Saved changes apply right away.</div>

      {numberModel && (
        <div style={{ marginTop: 16 }}>
          <PhoneNumberSection model={numberModel} />
        </div>
      )}

      <form action={saveSettings} style={S.form}>
        <section style={S.section}>
          <div style={S.sectionTitle}>Business name</div>
          <div style={S.sectionHint}>Shown across your dashboard and used wherever {"{business_name}"} appears in replies.</div>
          <input
            name="business_name"
            defaultValue={business?.name ?? ""}
            placeholder="e.g. Riverside Auto Detailing"
            autoComplete="organization"
            style={S.textInput}
          />
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Brand color</div>
          <div style={S.sectionHint}>Used across buttons, highlights, and your logo.</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="color" name="brand_color" defaultValue={settings.brand_color} style={S.color} aria-label="Brand color" />
            <span style={S.mono}>{settings.brand_color}</span>
          </div>
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Missed-call auto-text</div>
          <div style={S.sectionHint}>Texted to a caller you miss. Use {"{business_name}"} to insert your name.</div>
          <textarea name="auto_text_message" defaultValue={settings.auto_text_message} rows={3} style={S.textarea} />
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Business hours</div>
          <div style={S.sectionHint}>Used to suggest open appointment times in replies.</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <label style={S.inlineLabel}>
              Open <input type="time" name="hours_open" defaultValue={settings.business_hours.open} style={S.time} />
            </label>
            <label style={S.inlineLabel}>
              Close <input type="time" name="hours_close" defaultValue={settings.business_hours.close} style={S.time} />
            </label>
          </div>
          <div style={S.days}>
            {DAYS.map((d) => (
              <label key={d.value} style={S.dayChip}>
                <input type="checkbox" name="days" value={d.value} defaultChecked={settings.business_hours.days.includes(d.value)} />{" "}
                {d.label}
              </label>
            ))}
          </div>
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Quote ranges</div>
          <div style={S.sectionHint}>Optional. A suggested reply can include a price range when a service matches.</div>
          <QuoteRangesEditor initial={settings.quote_ranges} />
        </section>

        <button type="submit" style={S.save}>Save settings</button>
      </form>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 640, margin: "0 auto", padding: "26px 20px 64px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  sub: { color: "#8a909c", fontSize: 13 },
  form: { marginTop: 18, display: "flex", flexDirection: "column", gap: 14 },
  section: { padding: "14px 16px", borderRadius: 12, background: "#fff", border: "1px solid #eceef2" },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "#15171b" },
  sectionHint: { fontSize: 12, color: "#8a909c", margin: "2px 0 10px" },
  color: { width: 52, height: 36, padding: 0, border: "1px solid #d8dce3", borderRadius: 8, background: "#fff", cursor: "pointer" },
  textInput: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, boxSizing: "border-box" },
  mono: { fontFamily: "ui-monospace, monospace", fontSize: 13, color: "#3c414b" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  inlineLabel: { fontSize: 13, color: "#3c414b", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  time: { padding: "7px 9px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  days: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 },
  dayChip: { display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#3c414b", fontWeight: 600 },
  save: { alignSelf: "flex-start", padding: "11px 18px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }
};
