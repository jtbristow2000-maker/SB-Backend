"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, PartyPopper, TriangleAlert, X } from "lucide-react";
import type { CSSProperties } from "react";

// Interactive setup checklist shown on Today. Each step's "done" state is computed
// server-side from real data (number connected, services added, first lead in), so it
// ticks itself off as the owner sets things up. Dismissible (localStorage); once
// dismissed it stays hidden in that browser.

const DISMISS_KEY = "snagly_onboarding_dismissed_v1";

export type OnboardingStep = {
  key: string;
  title: string;
  desc: string;
  note?: string; // an important callout (e.g. the voicemail-timing step)
  done: boolean;
  href: string;
  cta: string;
};

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (!mounted || dismissed || steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="card" style={S.card}>
      <div style={S.header}>
        <div style={{ minWidth: 0 }}>
          <div style={S.title}>{allDone ? <><PartyPopper size={15} className="ico-inline" aria-hidden /> You&apos;re all set!</> : "Get set up"}</div>
          <div style={S.sub}>
            {allDone
              ? "Your assistant is ready to catch every missed job. You can close this."
              : `${doneCount} of ${steps.length} done — finish setup so Snagly can catch every job.`}
          </div>
        </div>
        <button type="button" onClick={dismiss} className="btn" style={S.dismiss} aria-label="Dismiss setup checklist"><X size={15} aria-hidden /></button>
      </div>

      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <div style={S.steps}>
        {steps.map((s, i) => (
          <div key={s.key} style={S.step}>
            <div style={s.done ? S.checkDone : S.checkTodo}>{s.done ? <Check size={13} strokeWidth={3} aria-hidden /> : i + 1}</div>
            <div style={S.stepBody}>
              <div style={{ ...S.stepTitle, ...(s.done ? S.stepTitleDone : null) }}>{s.title}</div>
              {!s.done && <div style={S.stepDesc}>{s.desc}</div>}
              {!s.done && s.note && <div style={S.note}><TriangleAlert size={12} className="ico-inline" aria-hidden /> {s.note}</div>}
            </div>
            {!s.done && (
              <Link href={s.href} style={S.stepCta}>{s.cta}</Link>
            )}
          </div>
        ))}
      </div>

      {!allDone && (
        <Link href="/owner/settings" style={S.polish}>
          Then make it yours — add your logo and tune your reply tone in Settings →
        </Link>
      )}
      {allDone && (
        <button type="button" onClick={dismiss} className="btn" style={S.doneBtn}>Got it — hide this</button>
      )}
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  card: { padding: "18px 18px 16px", marginTop: 22 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 },
  title: { fontSize: 16, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.3px" },
  sub: { fontSize: 12.5, color: "var(--muted)", marginTop: 2, lineHeight: 1.4 },
  dismiss: { border: "none", background: "transparent", color: "var(--muted)", fontSize: 15, cursor: "pointer", lineHeight: 1, padding: 4, flexShrink: 0 },
  progressTrack: { height: 6, background: "rgba(var(--brand-rgb),0.12)", borderRadius: 999, margin: "12px 0 14px", overflow: "hidden" },
  progressFill: { height: "100%", background: "var(--brand)", borderRadius: 999, transition: "width .3s ease" },
  steps: { display: "flex", flexDirection: "column", gap: 11 },
  step: { display: "flex", gap: 11, alignItems: "flex-start" },
  checkDone: { width: 22, height: 22, borderRadius: 999, background: "var(--positive)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  checkTodo: { width: 22, height: 22, borderRadius: 999, background: "rgba(var(--brand-rgb),0.12)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 },
  stepBody: { flex: 1, minWidth: 0 },
  stepTitle: { fontSize: 14, fontWeight: 700, color: "var(--ink)" },
  stepTitleDone: { color: "var(--muted)", textDecoration: "line-through" },
  stepDesc: { fontSize: 12.5, color: "#3c414b", lineHeight: 1.45, marginTop: 2 },
  note: { fontSize: 12, color: "#8a5a0c", background: "rgba(199,125,20,0.1)", padding: "6px 9px", borderRadius: 8, marginTop: 6, lineHeight: 1.4 },
  stepCta: { flexShrink: 0, alignSelf: "center", padding: "6px 11px", borderRadius: 8, background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" },
  polish: { display: "inline-block", marginTop: 14, color: "var(--brand)", fontWeight: 600, fontSize: 12.5, textDecoration: "none" },
  doneBtn: { marginTop: 14, padding: "9px 14px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }
};
