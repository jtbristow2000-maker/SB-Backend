import type { CSSProperties } from "react";

import { saveSettings } from "@/app/owner/actions";
import { PhoneNumberSection } from "@/app/owner/PhoneNumberSection";
import { AutoReplyLevelSlider } from "@/app/owner/AutoReplyLevelSlider";
import { QuoteRangesEditor } from "@/app/owner/QuoteRangesEditor";
import { LogoUpload } from "@/app/owner/LogoUpload";
import { SettingsSaveBar } from "@/app/owner/SettingsSaveBar";
import { UnsavedChangesGuard } from "@/app/owner/UnsavedChangesGuard";
import { VoicemailRecorder } from "@/app/owner/VoicemailRecorder";
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
    <main className="owner-page" style={S.page}>
      <h1 style={S.h1}>Settings</h1>
      <div style={S.sub}>Customize how your assistant looks and replies. Saved changes apply right away.</div>

      {numberModel && (
        <div style={{ marginTop: 16 }}>
          <PhoneNumberSection model={numberModel} />
        </div>
      )}

      <form id="settings-form" action={saveSettings} style={S.form}>
        <UnsavedChangesGuard formId="settings-form" />
        <section style={S.section}>
          <div style={S.sectionTitle}>AI &amp; Replies</div>
          <div style={S.sectionHint}>Customize how the AI drafts and personalizes your suggested replies. Each business sets their own.</div>

          <div style={{ marginTop: 12 }}>
            <div style={S.sectionTitle}>Missed-call auto-text</div>
            <div style={S.sectionHint}>Texted to a caller you miss. Use {"{business_name}"} to insert your name.</div>
            <textarea name="auto_text_message" defaultValue={settings.auto_text_message} rows={3} className="input" style={S.textarea} />
            <label style={{ ...S.inlineLabel, marginTop: 10 }}>
              Send delay
              <select name="auto_text_delay_seconds" defaultValue={String(settings.auto_text_delay_seconds)} className="input" style={S.time}>
                <option value="0">Instant</option>
                <option value="5">5 seconds</option>
                <option value="10">10 seconds</option>
                <option value="15">15 seconds</option>
                <option value="30">30 seconds</option>
              </select>
            </label>
            <div style={{ ...S.sectionHint, marginTop: 6 }}>A short pause so the text doesn&apos;t feel robotic — still fast enough to catch the lead.</div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={S.sliderLabel}>Auto-reply to missed calls</div>
            <div style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 8px", lineHeight: 1.45 }}>
              How much the AI writes the reply for you. It waits for the caller&apos;s voicemail first — so it feels human and knows what they asked for. Higher = the more it says on its own.
            </div>
            <AutoReplyLevelSlider initial={settings.ai_reply.auto_reply_level} />
            <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 8 }}>Takes effect once AI + texting are switched on.</div>
          </div>

          <label style={S.checkRow}>
            <input type="checkbox" name="ai_pick_enabled" defaultChecked={settings.ai_reply.ai_pick_enabled} style={{ marginTop: 2 }} />
            <span>
              <span style={S.checkLabel}>AI auto-picks services</span>
              <span style={S.checkHint}>Reads the voicemail and pre-selects the matching services. Uncheck to always pick manually.</span>
            </span>
          </label>

          <div style={{ marginTop: 16 }}>
            <div style={S.sliderLabel}>Tone</div>
            <div style={S.sliderTrack}>
              <span style={S.sliderEnd}>Professional</span>
              <input type="range" name="ai_formality" min={0} max={4} step={1} defaultValue={settings.ai_reply.formality} style={S.slider} />
              <span style={S.sliderEnd}>Relaxed</span>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={S.sliderLabel}>Warmth</div>
            <div style={S.sliderTrack}>
              <span style={S.sliderEnd}>Brief</span>
              <input type="range" name="ai_warmth" min={0} max={4} step={1} defaultValue={settings.ai_reply.warmth} style={S.slider} />
              <span style={S.sliderEnd}>Friendly</span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={S.sliderLabel}>Quote style (when several services apply)</div>
            <label style={S.radioRow}>
              <input type="radio" name="ai_quote_style" value="total" defaultChecked={settings.ai_reply.quote_style !== "itemized"} />
              <span><strong>Total only</strong> &mdash; &ldquo;&hellip;you&apos;re looking at about $450 altogether.&rdquo;</span>
            </label>
            <label style={S.radioRow}>
              <input type="radio" name="ai_quote_style" value="itemized" defaultChecked={settings.ai_reply.quote_style === "itemized"} />
              <span><strong>Itemized</strong> &mdash; &ldquo;full detail $300, ceramic $150 &mdash; $450 altogether.&rdquo;</span>
            </label>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={S.sectionTitle}>Signature <span style={{ fontWeight: 400, fontSize: 12, color: "var(--faint)" }}>(optional)</span></div>
            <div style={S.sectionHint}>Overrides &ldquo;{business?.name ?? "your business name"}&rdquo; at the end of replies. e.g. just &ldquo;Mike&rdquo; for a personal touch.</div>
            <input name="ai_sign_off" defaultValue={settings.ai_reply.sign_off} placeholder={`e.g. Mike or Mike's Detailing`} className="input" style={S.textInput} autoComplete="off" />
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={S.sectionTitle}>Custom note <span style={{ fontWeight: 400, fontSize: 12, color: "var(--faint)" }}>(optional)</span></div>
            <div style={S.sectionHint}>Added to every draft before the signature. e.g. &ldquo;Ask about our monthly maintenance plan!&rdquo;</div>
            <input name="ai_custom_note" defaultValue={settings.ai_reply.custom_note} placeholder="e.g. Ask about our monthly maintenance plan!" className="input" style={S.textInput} autoComplete="off" />
          </div>
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Calls &amp; voicemail</div>
          <label style={S.checkRow}>
            <input type="checkbox" name="forward_calls" defaultChecked={settings.forward_calls} style={{ marginTop: 2 }} />
            <span>
              <span style={S.checkLabel}>Ring my phone first</span>
              <span style={S.checkHint}>On: callers ring your phone, then voicemail if you miss it. Off: callers go straight to voicemail.</span>
            </span>
          </label>
          <div style={{ ...S.sectionHint, marginTop: 12 }}>Greeting — what callers hear before leaving a message. Record your own voice (callers hear that); the typed version is read aloud only when there&apos;s no recording.</div>
          {business && <VoicemailRecorder businessId={business.id} />}
          <div style={{ ...S.sectionHint, marginTop: 14, marginBottom: 6 }}>Typed fallback (used when there&apos;s no recording)</div>
          <textarea name="voicemail_greeting" defaultValue={settings.voicemail_greeting} rows={2} placeholder="Sorry we missed your call. Please leave a message after the beep." className="input" style={S.textarea} />
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Business name</div>
          <div style={S.sectionHint}>Shown across your dashboard and used wherever {"{business_name}"} appears in replies.</div>
          <input
            name="business_name"
            defaultValue={business?.name ?? ""}
            placeholder="e.g. Riverside Auto Detailing"
            autoComplete="organization"
            className="input"
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
          <div style={S.sectionTitle}>Brand logo <span style={{ fontWeight: 400, fontSize: 12, color: "var(--faint)" }}>(optional)</span></div>
          <div style={S.sectionHint}>Drag in a logo file (or paste a URL) — it shows in your dashboard header. Leave blank to use your initial.</div>
          <LogoUpload initial={settings.logo_url} />
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Business hours</div>
          <div style={S.sectionHint}>Used to suggest open appointment times in replies.</div>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <label style={S.inlineLabel}>
              Open <input type="time" name="hours_open" defaultValue={settings.business_hours.open} className="input" style={S.time} />
            </label>
            <label style={S.inlineLabel}>
              Close <input type="time" name="hours_close" defaultValue={settings.business_hours.close} className="input" style={S.time} />
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
          <label style={{ ...S.inlineLabel, marginTop: 16 }}>
            Travel buffer between jobs
            <select name="travel_buffer_minutes" defaultValue={String(settings.travel_buffer_minutes)} className="input" style={S.time}>
              <option value="0">None</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hr</option>
            </select>
          </label>
          <div style={{ ...S.sectionHint, marginTop: 6 }}>Drive time kept clear around booked jobs, so back-to-back appointments aren&apos;t offered too tight.</div>
        </section>

        <section style={S.section}>
          <div style={S.sectionTitle}>Quote ranges</div>
          <div style={S.sectionHint}>Optional. A suggested reply can include a price range when a service matches.</div>
          <QuoteRangesEditor initial={settings.quote_ranges} />
        </section>

        <button type="submit" className="btn" style={S.save}>Save settings</button>
        <SettingsSaveBar formId="settings-form" />
      </form>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 640 },
  h1: { margin: "4px 0 2px", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px" },
  sub: { color: "var(--muted)", fontSize: 13 },
  form: { marginTop: 18, display: "flex", flexDirection: "column", gap: 14 },
  section: { padding: "16px 18px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: "var(--ink)" },
  sectionHint: { fontSize: 12, color: "var(--muted)", margin: "2px 0 10px" },
  color: { width: 52, height: 36, padding: 0, border: "1px solid #d8dce3", borderRadius: 8, background: "#fff", cursor: "pointer" },
  textInput: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, boxSizing: "border-box" },
  mono: { fontFamily: "ui-monospace, monospace", fontSize: 13, color: "var(--text)" },
  textarea: { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  inlineLabel: { fontSize: 13, color: "var(--text)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 },
  time: { padding: "7px 9px", borderRadius: 9, border: "1px solid #d8dce3", fontSize: 13 },
  days: { display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 },
  dayChip: { display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--text)", fontWeight: 600 },
  save: { alignSelf: "flex-start", padding: "11px 18px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  checkRow: { display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, marginBottom: 4 },
  checkLabel: { display: "block", fontWeight: 700, color: "var(--ink)", marginBottom: 2 },
  checkHint: { display: "block", fontSize: 12, color: "var(--muted)" },
  sliderLabel: { fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 6 },
  sliderTrack: { display: "flex", alignItems: "center", gap: 10 },
  sliderEnd: { fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" as const, minWidth: 82 },
  slider: { flex: 1, accentColor: "var(--brand)" },
  radioRow: { display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--text)", lineHeight: 1.4, marginTop: 6 }
};
