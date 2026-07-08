"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import type { CSSProperties } from "react";

import { setVoicemailGreetingAudio } from "@/server/voicemailGreetings/actions";

// Record a voicemail greeting in the browser, downsample to 8 kHz mono WAV (phone
// quality — small + a format Twilio <Play> accepts), and save it via the server
// action. Twilio plays this recording over the configured text greeting. Saving is
// immediate (its own action), independent of the Settings "Save changes" button.

const MAX_SECONDS = 30;

export function VoicemailRecorder({ businessId }: { businessId: string }) {
  const [phase, setPhase] = useState<"idle" | "recording" | "preview" | "saving">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [hasExisting, setHasExisting] = useState<boolean | null>(null);
  const [version, setVersion] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const wavRef = useRef<Blob | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const stopRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const audioUrl = `/api/voicemail-greeting/${businessId}?v=${version}`;

  // Probe whether a greeting already exists (the public route 404s when there's none).
  useEffect(() => {
    let cancelled = false;
    fetch(audioUrl, { cache: "no-store" })
      .then((r) => { if (!cancelled) setHasExisting(r.ok); })
      .catch(() => { if (!cancelled) setHasExisting(false); });
    return () => { cancelled = true; };
  }, [audioUrl]);

  useEffect(() => () => cleanup(), []);

  function cleanup() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopRef.current) clearTimeout(stopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }

  async function startRecording() {
    setErr(null);
    setMsg(null);
    if (previewUrl) { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }
    wavRef.current = null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => { void processRecording(); };
      recorderRef.current = recorder;
      recorder.start();
      setPhase("recording");
      setElapsed(0);
      tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      stopRef.current = setTimeout(() => stopRecording(), MAX_SECONDS * 1000);
    } catch {
      setErr("Couldn't access your microphone. Check your browser's mic permission and try again.");
      setPhase("idle");
    }
  }

  function stopRecording() {
    if (tickRef.current) clearInterval(tickRef.current);
    if (stopRef.current) clearTimeout(stopRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPhase("preview");
  }

  async function processRecording() {
    try {
      const raw = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || "audio/webm" });
      const arrayBuffer = await raw.arrayBuffer();
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      await ctx.close();
      const samples = downsampleMono(decoded, 8000);
      const wav = encodeWav(samples, 8000);
      wavRef.current = wav;
      setPreviewUrl(URL.createObjectURL(wav));
    } catch {
      setErr("Couldn't process that recording. Try again.");
      setPhase("idle");
    }
  }

  async function save() {
    if (!wavRef.current) return;
    setPhase("saving");
    setErr(null);
    try {
      const base64 = await blobToBase64(wavRef.current);
      const result = await setVoicemailGreetingAudio(businessId, base64);
      if (result.status === "saved") {
        setMsg("Greeting saved — callers will hear this.");
        setHasExisting(true);
        setVersion((v) => v + 1);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        wavRef.current = null;
        setPhase("idle");
      } else if (result.status === "invalid_audio") {
        setErr(result.error === "file_too_large" ? "That recording is too long — keep it under 30 seconds." : "That recording couldn't be saved. Try again.");
        setPhase("preview");
      } else {
        setErr("Couldn't save the greeting. Try again.");
        setPhase("preview");
      }
    } catch {
      setErr("Couldn't save the greeting. Try again.");
      setPhase("preview");
    }
  }

  async function removeGreeting() {
    setErr(null);
    setMsg(null);
    try {
      await setVoicemailGreetingAudio(businessId, null);
      setHasExisting(false);
      setVersion((v) => v + 1);
      setMsg("Recording removed.");
    } catch {
      setErr("Couldn't remove the greeting. Try again.");
    }
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    wavRef.current = null;
    setPhase("idle");
  }

  return (
    <div style={S.wrap}>
      {hasExisting && phase !== "preview" && (
        <div style={S.current}>
          <span style={S.currentLabel}><Mic size={13} className="ico-inline" aria-hidden /> Your recording</span>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={audioUrl} style={S.audio} />
          <button type="button" onClick={removeGreeting} className="btn" style={S.remove}>Remove</button>
        </div>
      )}

      {phase === "idle" && (
        <button type="button" onClick={startRecording} className="btn" style={S.record}>
          <Mic size={15} aria-hidden /> {hasExisting ? "Record a new greeting" : "Record greeting"}
        </button>
      )}

      {phase === "recording" && (
        <div style={S.recRow}>
          <span style={S.recDot} />
          <span style={S.recTime}>Recording… {fmt(elapsed)} / {fmt(MAX_SECONDS)}</span>
          <button type="button" onClick={stopRecording} className="btn" style={S.stop}><Square size={13} aria-hidden /> Stop</button>
        </div>
      )}

      {phase === "preview" && previewUrl && (
        <div style={S.previewBox}>
          <div style={S.currentLabel}>Preview</div>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={previewUrl} style={S.audio} />
          <div style={S.previewBtns}>
            <button type="button" onClick={save} className="btn" style={S.save}>Save greeting</button>
            <button type="button" onClick={discard} className="btn" style={S.discard}>Re-record</button>
          </div>
        </div>
      )}

      {phase === "preview" && !previewUrl && <div style={S.muted}>Processing…</div>}
      {phase === "saving" && <div style={S.muted}>Saving…</div>}
      {msg && <div style={S.ok}>{msg}</div>}
      {err && <div style={S.err}>{err}</div>}
    </div>
  );
}

function fmt(s: number): string {
  return `0:${String(s).padStart(2, "0")}`;
}

function downsampleMono(buffer: AudioBuffer, targetRate: number): Float32Array {
  const channels = buffer.numberOfChannels;
  const len = buffer.length;
  const mono = new Float32Array(len);
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += data[i] / channels;
  }
  if (buffer.sampleRate === targetRate) return mono;
  const ratio = buffer.sampleRate / targetRate;
  const outLen = Math.floor(mono.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, mono.length - 1);
    const frac = idx - i0;
    out[i] = mono[i0] * (1 - frac) + mono[i1] * frac;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    offset += 2;
  }
  return new Blob([view], { type: "audio/wav" });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
}

const S: Record<string, CSSProperties> = {
  wrap: { display: "flex", flexDirection: "column", gap: 10, marginTop: 6 },
  current: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  currentLabel: { fontSize: 12.5, fontWeight: 700, color: "var(--ink)" },
  audio: { height: 34, maxWidth: "100%" },
  record: { alignSelf: "flex-start", padding: "9px 14px", borderRadius: 10, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "#b23b3b", fontWeight: 700, fontSize: 13.5, cursor: "pointer" },
  recRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  recDot: { width: 11, height: 11, borderRadius: 999, background: "#dc2626", animation: "pulse 1s infinite" },
  recTime: { fontSize: 13, fontWeight: 600, color: "#3c414b" },
  stop: { padding: "8px 13px", borderRadius: 9, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  previewBox: { display: "flex", flexDirection: "column", gap: 8 },
  previewBtns: { display: "flex", gap: 8, flexWrap: "wrap" },
  save: { padding: "9px 14px", borderRadius: 9, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" },
  discard: { padding: "9px 14px", borderRadius: 9, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "#3c414b", fontWeight: 600, fontSize: 13, cursor: "pointer" },
  remove: { padding: "6px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "#b23b3b", fontWeight: 600, fontSize: 12, cursor: "pointer" },
  muted: { fontSize: 12.5, color: "var(--muted)" },
  ok: { fontSize: 12.5, color: "#1d6b4f", fontWeight: 600 },
  err: { fontSize: 12.5, color: "#b23b3b" }
};
