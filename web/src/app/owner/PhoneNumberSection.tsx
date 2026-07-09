import type { CSSProperties } from "react";
import { CheckCircle2, PhoneForwarded, Smartphone } from "lucide-react";

import { saveOwnerNumber, savePortInfo, submitPort } from "@/app/owner/actions";
import { ActivateNumberForm } from "@/app/owner/ActivateNumberForm";
import { fmtPhone } from "@/app/owner/format";
import type { NumberStatus } from "@/server/db/schema";
import type { BusinessNumberReadModel } from "@/server/telephony/numberState";

// Owner Settings → "Phone number". Default path: KEEP YOUR NUMBER — save your
// cell, forward missed calls to the shared Snagly line, done (no purchase, no
// per-user verification). A separate dedicated business number remains available
// underneath (Activate w/ trial), along with the port-in form once one exists.

export function PhoneNumberSection({
  model,
  sharedNumber,
  businessPhone,
  hasCapturedCall
}: {
  model: BusinessNumberReadModel;
  sharedNumber: string | null;
  businessPhone: string | null;
  hasCapturedCall?: boolean;
}) {
  const { number_status, twilio_number_e164, trial, port_request_status } = model;
  const hasNumber = Boolean(twilio_number_e164);

  if ((number_status === "none" || !hasNumber) && sharedNumber) {
    const sharedPretty = fmtPhone(sharedNumber);
    const sharedDigits = sharedNumber.replace(/\D/g, "").replace(/^1/, "");
    return (
      <section style={S.section}>
        <div style={S.title}>Phone setup</div>
        <div style={S.hint}>Keep your own number — Snagly just catches the calls you miss.</div>

        {/* Step 1 — their cell (what forwarded calls are matched against) */}
        <div style={S.stepTitle}><Smartphone size={13} className="ico-inline" aria-hidden /> 1. Your cell number</div>
        <form action={saveOwnerNumber} style={S.cellForm}>
          <input
            name="owner_cell"
            type="tel"
            required
            defaultValue={businessPhone ? fmtPhone(businessPhone) : ""}
            placeholder="(404) 555-1234"
            className="input"
            style={S.cellInput}
            autoComplete="tel"
          />
          <button type="submit" className="btn" style={S.secondary}>{businessPhone ? "Update" : "Save"}</button>
        </form>
        {businessPhone && (
          <div style={S.savedNote}><CheckCircle2 size={12} className="ico-inline" aria-hidden /> Saved — calls forwarded from {fmtPhone(businessPhone)} route to your account.</div>
        )}

        {/* Step 2 — carrier forwarding to the shared line */}
        <div style={{ ...S.stepTitle, marginTop: 14 }}><PhoneForwarded size={13} className="ico-inline" aria-hidden /> 2. Forward missed calls</div>
        <div style={S.forward}>
          <div style={S.body}>
            On your phone, dial{" "}
            <a href={`tel:${encodeURIComponent(`*71${sharedDigits}`)}`} style={S.dialLink}>
              <code style={S.code}>*71 {sharedPretty}</code>
            </a>{" "}
            and tap call — that turns on &ldquo;forward when I don&apos;t answer.&rdquo; That&apos;s the whole setup.
          </div>
          <details style={S.carrierDetails}>
            <summary style={S.carrierSummary}>My carrier&apos;s code is different</summary>
            <div style={S.body}>
              <strong>Verizon:</strong> <code style={S.code}>*71{sharedDigits}</code> · <strong>T-Mobile:</strong>{" "}
              <code style={S.code}>**61*1{sharedDigits}#</code> · <strong>AT&amp;T:</strong>{" "}
              <code style={S.code}>**61*1{sharedDigits}*11*25#</code>
              <br />
              To turn it off later: Verizon <code style={S.code}>*73</code> · T-Mobile/AT&amp;T <code style={S.code}>##61#</code>
            </div>
          </details>
        </div>

        {/* Step 3 — prove it works */}
        <div style={{ ...S.stepTitle, marginTop: 14 }}>3. Test it</div>
        <div style={S.body}>
          {hasCapturedCall ? (
            <span style={S.savedNote}><CheckCircle2 size={13} className="ico-inline" aria-hidden /> Working — calls are flowing into your dashboard.</span>
          ) : (
            <>Call your number from another phone and let it ring out. Your test shows up on <strong>Today</strong> within a minute — voicemail, transcript, and all.</>
          )}
        </div>

        {/* The separate-line option, tucked away */}
        <details style={S.details}>
          <summary style={S.summary}>Want a separate business number instead?</summary>
          <div style={S.body}>
            Get a dedicated Snagly line — full business/personal separation, and it unlocks call recording later. Comes
            with a <strong>14-day free trial</strong>.
          </div>
          <ActivateNumberForm />
        </details>
      </section>
    );
  }

  if (number_status === "none" || !hasNumber) {
    return (
      <section style={S.section}>
        <div style={S.title}>Phone number</div>
        <div style={S.hint}>The number your missed calls run through.</div>
        <div style={S.body}>
          You don&apos;t have a number connected yet. Activate one to start catching missed calls — it comes with a{" "}
          <strong>14-day free trial</strong>.
        </div>
        <ActivateNumberForm />
      </section>
    );
  }

  const number = fmtPhone(twilio_number_e164);
  const showForwarding = number_status === "trial" || number_status === "active";

  return (
    <section style={S.section}>
      <div style={S.title}>Phone number</div>
      <div style={S.numberRow}>
        <span style={S.number}>{number}</span>
        <span style={badgeStyle(number_status, trial?.expired)}>{statusLabel(number_status, trial)}</span>
      </div>

      {showForwarding && (
        <div style={S.forward}>
          <div style={S.forwardTitle}><PhoneForwarded size={13} className="ico-inline" aria-hidden /> Connect your business line</div>
          <div style={S.body}>
            On the phone that rings for your business, turn on{" "}
            <strong>&ldquo;forward when busy / unanswered&rdquo;</strong> to this number. On most U.S. carriers you can
            dial <code style={S.code}>*71</code> then {number} — or set it in your carrier&apos;s app. Missed calls then
            flow into your dashboard and the AI texts the caller back.
          </div>
        </div>
      )}

      {number_status === "porting" && (
        <div style={S.body}>Your real number is being ported in — keep forwarding on until it completes.</div>
      )}
      {number_status === "ported" && (
        <div style={S.body}><CheckCircle2 size={13} className="ico-inline" aria-hidden /> Your own number is fully connected — no forwarding needed.</div>
      )}

      {number_status !== "ported" && (
        <details style={S.details}>
          <summary style={S.summary}>Make this your real number (port it in)</summary>
          <div style={S.body}>
            Move your existing business number onto the system so you can drop the forwarding step. We collect the
            details, then submit the port (it takes a couple of weeks).
            {port_request_status ? <strong> Status: {portStatusLabel(port_request_status)}.</strong> : null}
          </div>
          <form action={savePortInfo} style={S.form}>
            <input className="input" name="current_number_e164" required placeholder="Your real business number" style={S.input} autoComplete="off" />
            <input className="input" name="current_carrier" placeholder="Current carrier (e.g. Verizon)" style={S.input} autoComplete="off" />
            <input className="input" name="account_number" placeholder="Account number with that carrier" style={S.input} autoComplete="off" />
            <input className="input" name="account_pin" placeholder="Account PIN / transfer passcode" style={S.input} autoComplete="off" />
            <input className="input" name="billing_name" placeholder="Name on the account" style={S.input} autoComplete="off" />
            <input className="input" name="billing_address" placeholder="Billing address on the account" style={S.input} autoComplete="off" />
            <button type="submit" className="btn" style={S.secondary}>Save porting info</button>
          </form>
          {(port_request_status === "collecting" || port_request_status === "rejected") && (
            <form action={submitPort} style={{ marginTop: 8 }}>
              <button type="submit" className="btn" style={S.primary}>Submit port request</button>
            </form>
          )}
        </details>
      )}
    </section>
  );
}

function statusLabel(status: NumberStatus, trial: BusinessNumberReadModel["trial"]): string {
  switch (status) {
    case "trial": {
      if (trial?.expired) return "Trial ended";
      const days = trial?.daysLeft ?? 0;
      return `Trial · ${days} day${days === 1 ? "" : "s"} left`;
    }
    case "active":
      return "Active";
    case "porting":
      return "Porting in progress";
    case "ported":
      return "Your number";
    default:
      return "";
  }
}

function portStatusLabel(status: NonNullable<BusinessNumberReadModel["port_request_status"]>): string {
  switch (status) {
    case "collecting":
      return "info saved, not submitted yet";
    case "submitted":
      return "submitted — porting underway";
    case "completed":
      return "ported";
    case "rejected":
      return "rejected — check the details";
    default:
      return status;
  }
}

function badgeStyle(status: NumberStatus, expired?: boolean): CSSProperties {
  const base: CSSProperties = { fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999 };
  if (status === "ported") return { ...base, background: "rgba(var(--positive-rgb),0.14)", color: "#1d6b4f" };
  if (status === "porting") return { ...base, background: "rgba(58,123,208,0.14)", color: "#2b5f9e" };
  if (status === "trial" && expired) return { ...base, background: "rgba(199,125,20,0.14)", color: "#8a5a0c" };
  if (status === "trial") return { ...base, background: "rgba(var(--brand-rgb),0.12)", color: "#3a3a9a" };
  return { ...base, background: "rgba(var(--positive-rgb),0.14)", color: "#1d6b4f" };
}

const S: Record<string, CSSProperties> = {
  section: { padding: "16px 18px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" },
  title: { fontSize: 14, fontWeight: 700, color: "var(--ink)" },
  hint: { fontSize: 12, color: "var(--muted)", margin: "2px 0 10px" },
  stepTitle: { fontSize: 13, fontWeight: 700, color: "var(--ink)", margin: "10px 0 6px" },
  cellForm: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
  cellInput: { flex: "1 1 170px", maxWidth: 230, padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14 },
  savedNote: { display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, fontSize: 12.5, fontWeight: 600, color: "#1d6b4f" },
  dialLink: { textDecoration: "none", color: "inherit" },
  carrierDetails: { marginTop: 6 },
  carrierSummary: { fontSize: 12, fontWeight: 600, color: "var(--brand)", cursor: "pointer" },
  body: { fontSize: 13, color: "var(--text)", lineHeight: 1.5, margin: "8px 0" },
  numberRow: { display: "flex", alignItems: "center", gap: 10, margin: "6px 0 2px", flexWrap: "wrap" },
  number: { fontSize: 18, fontWeight: 700, color: "var(--ink)", fontFamily: "ui-monospace, monospace" },
  forward: { marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(var(--brand-rgb),0.06)" },
  forwardTitle: { fontSize: 13, fontWeight: 700, color: "#3a3a9a" },
  code: { fontFamily: "ui-monospace, monospace", background: "#eef0f4", padding: "1px 5px", borderRadius: 5 },
  details: { marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 10 },
  summary: { fontSize: 13, fontWeight: 700, color: "var(--brand)", cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: 8, marginTop: 10 },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #d8dce3", fontSize: 14 },
  primary: { alignSelf: "flex-start", marginTop: 8, padding: "10px 16px", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  secondary: { alignSelf: "flex-start", padding: "9px 14px", borderRadius: 10, border: "1px solid #d8dce3", background: "#fff", color: "#1e2026", fontWeight: 700, fontSize: 13, cursor: "pointer" }
};
