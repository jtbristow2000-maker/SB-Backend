"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

// Owner control for how much the AI writes the missed-call reply, from a plain
// template (no AI) up to a fully auto-sent, personalized reply. The backend
// reads `ai_auto_reply_level` and generates/sends accordingly (waiting for the
// caller's voicemail first so it feels human and knows the request).

const LEVELS = [
  { name: "Off — template only", desc: "Sends your saved message as-is. No AI, nothing personalized." },
  { name: "Personal", desc: "Greets them by name in your tone and acknowledges they called. No prices or commitments." },
  { name: "Assistant", desc: "Adds the service they asked about and a couple of open times. Prices only if you've set a quote range." },
  { name: "Full Auto", desc: "Writes the whole reply — name, service, prices, and open times — and sends it automatically. Fully hands-off." }
];

export function AutoReplyLevelSlider({ initial }: { initial: number }) {
  const [level, setLevel] = useState(Math.min(3, Math.max(0, Math.round(initial || 0))));
  const cur = LEVELS[level];

  return (
    <div>
      <div style={S.track}>
        <span style={S.end}>No AI</span>
        <input
          type="range"
          name="ai_auto_reply_level"
          min={0}
          max={3}
          step={1}
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
          style={S.slider}
          aria-label="Auto-reply AI level"
        />
        <span style={S.end}>Full AI</span>
      </div>
      <div style={S.box}>
        <strong style={S.curName}>{level} · {cur.name}</strong>
        <span style={S.curDesc}>{cur.desc}</span>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  track: { display: "flex", alignItems: "center", gap: 10 },
  end: { fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap", minWidth: 46 },
  slider: { flex: 1, accentColor: "var(--brand)" },
  box: { marginTop: 8, padding: "10px 12px", borderRadius: 10, background: "rgba(var(--brand-rgb),0.07)" },
  curName: { display: "block", fontSize: 13, fontWeight: 700, color: "#3a3a9a", marginBottom: 2 },
  curDesc: { fontSize: 12.5, color: "var(--text)", lineHeight: 1.45 }
};
