import Link from "next/link";
import type { CSSProperties } from "react";

import { simulateLead } from "@/app/owner/actions";
import { getAppConfig } from "@/server/config";
import { getBusinessSettings } from "@/server/business/settings";
import { getIntakeRuntime } from "@/server/intake/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Owner-side test tool: spawn a fake lead (unique number + pre-filled AI details)
// so the quote / suggested-reply tool can be exercised across scenarios without
// juggling real phone numbers. Gated by SIMULATOR_ENABLED (on by default).

export default async function SimulatorPage() {
  if (!getAppConfig().simulatorEnabled) {
    return (
      <main style={S.page}>
        <h1 style={S.h1}>Simulator</h1>
        <div style={S.note}>The simulator is turned off for this account.</div>
      </main>
    );
  }

  const rt = await getIntakeRuntime();
  const business = (await rt.businessRepository.list())[0] ?? null;
  const settings = getBusinessSettings(business);
  const quotedServices = settings.quote_ranges.map((q) => q.service).filter(Boolean);
  const suggestions = Array.from(
    new Set([...quotedServices, "Full detail", "Interior detail", "Wash & wax", "Ceramic coating"])
  );

  return (
    <main style={S.page}>
      <h1 style={S.h1}>Simulator</h1>
      <div style={S.sub}>
        Create a pretend missed call to test your replies. Each one becomes a brand-new customer with
        its own number — so you can try the quote tool against different services as many times as you like.
      </div>

      <div style={S.tip}>
        💡 To see a <strong>price range</strong> appear in the suggested reply, type a service that matches
        one of your quote ranges
        {quotedServices.length
          ? <>: <strong>{quotedServices.join(", ")}</strong>.</>
          : <>. You haven&apos;t set any yet — add them in <Link href="/owner/settings" style={S.inlineLink}>Settings</Link>.</>}
      </div>

      <form action={simulateLead} style={S.form}>
        <label style={S.field}>
          <span style={S.label}>Caller name</span>
          <input name="name" placeholder="e.g. Sarah Miller" style={S.input} autoComplete="off" />
        </label>

        <label style={S.field}>
          <span style={S.label}>Service they asked for</span>
          <input name="service" list="sim-services" placeholder="e.g. Full detail" style={S.input} autoComplete="off" />
          <datalist id="sim-services">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <span style={S.hint}>Matches a quote range → the reply includes your price.</span>
        </label>

        <label style={S.field}>
          <span style={S.label}>When they want it</span>
          <input name="requested_datetime" placeholder="e.g. this Saturday afternoon" style={S.input} autoComplete="off" />
        </label>

        <label style={S.field}>
          <span style={S.label}>Voicemail message <span style={S.optional}>(optional)</span></span>
          <textarea name="voicemail" rows={3} placeholder="Leave blank to auto-generate one from the details above." style={S.textarea} />
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
  tip: { marginTop: 14, padding: "11px 13px", borderRadius: 11, background: "rgba(var(--brand-rgb),0.08)", color: "#3a3a9a", fontSize: 13, lineHeight: 1.5 },
  note: { marginTop: 16, padding: "20px 16px", borderRadius: 12, background: "#fff", border: "1px solid #eceef2", color: "#3c414b", textAlign: "center" },
  form: { marginTop: 16, display: "flex", flexDirection: "column", gap: 14, padding: "16px", borderRadius: 14, background: "#fff", border: "1px solid #eceef2" },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { fontSize: 13, fontWeight: 700, color: "#15171b" },
  optional: { fontWeight: 400, color: "#8a909c" },
  hint: { fontSize: 11, color: "#8a909c" },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14 },
  textarea: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14, fontFamily: "inherit", resize: "vertical", boxSizing: "border-box" },
  submit: { alignSelf: "flex-start", padding: "11px 18px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  inlineLink: { color: "var(--brand)", fontWeight: 600 },
  footer: { marginTop: 16, color: "#8a909c", fontSize: 12, lineHeight: 1.5 }
};
