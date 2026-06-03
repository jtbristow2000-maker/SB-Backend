import Link from "next/link";
import type { CSSProperties } from "react";

import { simulateLead } from "@/app/owner/actions";
import { getAppConfig } from "@/server/config";
import { getOwnerBusinessContext } from "@/server/business/current";
import { getBusinessSettings } from "@/server/business/settings";
import { hasConfiguredExtractionProvider } from "@/server/intake/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner-side test tool: spawn a fake voicemail and run it through the SAME AI
// extraction the real pipeline uses, so the transcript → name/service/time →
// suggested-reply path can be exercised end-to-end. Gated by SIMULATOR_ENABLED.

export default async function SimulatorPage() {
  if (!getAppConfig().simulatorEnabled) {
    return (
      <main style={S.page}>
        <h1 style={S.h1}>Simulator</h1>
        <div style={S.note}>The simulator is turned off for this account.</div>
      </main>
    );
  }

  const context = await getOwnerBusinessContext();
  const business = context?.business ?? null;
  const settings = getBusinessSettings(business);
  const aiOn = hasConfiguredExtractionProvider(getAppConfig());
  const quotedServices = settings.quote_ranges.map((q) => q.service).filter(Boolean);
  const suggestions = Array.from(
    new Set([...quotedServices, "Full detail", "Interior detail", "Wash & wax", "Ceramic coating"])
  );

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Simulator</h1>
      <div style={S.sub}>
        Paste a pretend voicemail and we&apos;ll run it through the <strong>same AI</strong> your real
        missed calls use — it reads the caller&apos;s name, service, and timing from the transcript, then
        drafts a suggested reply. Each one becomes a brand-new customer with its own number.
      </div>

      <div style={aiOn ? S.aiOk : S.aiWarn}>
        {aiOn ? (
          <>✓ AI reading is <strong>on</strong> — a voicemail-only test will parse the transcript.</>
        ) : (
          <>⚠ AI reading is <strong>off</strong>, so a voicemail alone won&apos;t be parsed. Turn on
            {" "}<code>AI_EXTRACTION_ENABLED</code> + a key, or fill the optional fields below to force a scenario.</>
        )}
      </div>

      <div style={S.tip}>
        💡 To see a <strong>price range</strong> in the reply, the voicemail&apos;s service needs to match
        one of your quote ranges
        {quotedServices.length
          ? <>: <strong>{quotedServices.join(", ")}</strong>.</>
          : <>. You haven&apos;t set any yet — add them in <Link href="/owner/settings" style={S.inlineLink}>Settings</Link>.</>}
      </div>

      <form action={simulateLead} style={S.form}>
        <label style={S.field}>
          <span style={S.label}>Voicemail message</span>
          <span style={S.hint}>What the caller said. Leave the fields below blank so the AI reads it.</span>
          <textarea
            name="voicemail"
            rows={5}
            placeholder="Hi, this is Marcus — I've got a sedan I'd like fully detailed, hoping for Thursday morning. Give me a call back, thanks!"
            style={S.textarea}
          />
        </label>

        <div style={S.divider}>Optional — force a specific scenario (skips the AI)</div>

        <label style={S.field}>
          <span style={S.label}>Caller name</span>
          <input name="name" placeholder="Leave blank to let the AI read it" style={S.input} autoComplete="off" />
        </label>

        <label style={S.field}>
          <span style={S.label}>Service</span>
          <input name="service" list="sim-services" placeholder="Leave blank to let the AI read it" style={S.input} autoComplete="off" />
          <datalist id="sim-services">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <span style={S.hint}>Filling this forces the quote and skips the AI.</span>
        </label>

        <label style={S.field}>
          <span style={S.label}>When they want it</span>
          <input name="requested_datetime" placeholder="Leave blank to let the AI read it" style={S.input} autoComplete="off" />
        </label>

        <button type="submit" style={S.submit}>Create test lead →</button>
      </form>

      <div style={S.footer}>
        You&apos;ll land on the new lead&apos;s page with its AI summary and a suggested reply ready to tweak.
        Done testing? Open the lead and set its status to <strong>Lost</strong> to clear it out of your callbacks.
      </div>
    </main>
  );
}

const S: Record<string, CSSProperties> = {
  page: { maxWidth: 640, margin: "0 auto", padding: "26px 20px 64px", fontFamily: "Segoe UI, system-ui, sans-serif", color: "#1e2026" },
  h1: { margin: "4px 0 2px", fontSize: 26 },
  sub: { color: "#8a909c", fontSize: 13, lineHeight: 1.5 },
  aiOk: { marginTop: 12, padding: "9px 12px", borderRadius: 10, background: "rgba(var(--positive-rgb),0.12)", color: "#1d6b4f", fontSize: 12, fontWeight: 600 },
  aiWarn: { marginTop: 12, padding: "9px 12px", borderRadius: 10, background: "rgba(199,125,20,0.12)", color: "#8a5a0c", fontSize: 12, fontWeight: 600, lineHeight: 1.5 },
  tip: { marginTop: 10, padding: "11px 13px", borderRadius: 11, background: "rgba(var(--brand-rgb),0.08)", color: "#3a3a9a", fontSize: 13, lineHeight: 1.5 },
  note: { marginTop: 16, padding: "20px 16px", borderRadius: 12, background: "#fff", border: "1px solid #eceef2", color: "#3c414b", textAlign: "center" },
  form: { marginTop: 16, display: "flex", flexDirection: "column", gap: 14, padding: "16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 13, fontWeight: 700, color: "#15171b" },
  divider: { fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: "#8a909c", textTransform: "uppercase", borderTop: "1px solid #eceef2", paddingTop: 12, marginTop: 2 },
  hint: { fontSize: 11, color: "#8a909c" },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14 },
  textarea: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  submit: { alignSelf: "flex-start", padding: "11px 18px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  inlineLink: { color: "var(--brand)", fontWeight: 600 },
  footer: { marginTop: 16, color: "#8a909c", fontSize: 12, lineHeight: 1.5 }
};
