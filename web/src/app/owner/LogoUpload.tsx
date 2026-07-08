"use client";

import { useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";

// Drag-and-drop (or click-to-choose) logo upload. The image is shrunk in the browser
// to a small PNG data URL and stored in the existing `logo_url` setting — so there's
// no file storage/backend involved; it round-trips through saveSettings like any other
// field. SVGs are kept as-is (vector); pasting an image URL still works as a fallback.

const MAX_DIM = 256;

export function LogoUpload({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setErr(null);
    if (!file.type.startsWith("image/")) {
      setErr("Please choose an image file (PNG, JPG, SVG…).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErr("That image is over 8 MB — try a smaller one.");
      return;
    }
    setBusy(true);
    try {
      setValue(await toLogoDataUrl(file, MAX_DIM));
    } catch {
      setErr("Couldn't read that image. Try a different file.");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const isData = value.startsWith("data:");

  return (
    <div>
      {/* The value actually submitted with the settings form. */}
      <input type="hidden" name="logo_url" value={value} />

      <div
        role="button"
        tabIndex={0}
        onClick={() => fileRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileRef.current?.click(); }}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{ ...S.zone, ...(dragOver ? S.zoneOver : null) }}
      >
        {value ? (
          <img src={value} alt="Logo preview" style={S.preview} />
        ) : (
          <div style={S.placeholder}>
            <div style={{ fontSize: 22 }}>📷</div>
            <div><strong>Drop your logo here</strong> or click to choose a file</div>
            <div style={S.hint}>PNG, JPG, or SVG · shrunk automatically</div>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
      />

      <div style={S.row}>
        {busy && <span style={S.muted}>Processing…</span>}
        {!busy && value && <button type="button" onClick={() => { setValue(""); setErr(null); }} style={S.remove}>Remove logo</button>}
        {!busy && value && <span style={S.muted}>Hit “Save changes” below to keep it.</span>}
      </div>

      {err && <div style={S.err}>{err}</div>}

      <details style={S.urlDetails}>
        <summary style={S.urlSummary}>Or paste an image URL</summary>
        <input
          value={isData ? "" : value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://…/logo.png"
          style={S.urlInput}
          autoComplete="off"
        />
      </details>
    </div>
  );
}

// Shrink a chosen image to a small PNG data URL (keeps SVGs as vector data URLs).
async function toLogoDataUrl(file: File, max: number): Promise<string> {
  const src = await readAsDataUrl(file);
  if (file.type === "image/svg+xml") return src;
  const img = await loadImage(src);
  const longest = Math.max(img.width || max, img.height || max);
  const scale = Math.min(1, max / longest);
  const w = Math.max(1, Math.round((img.width || max) * scale));
  const h = Math.max(1, Math.round((img.height || max) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("load failed"));
    img.src = src;
  });
}

const S: Record<string, CSSProperties> = {
  zone: { display: "flex", alignItems: "center", justifyContent: "center", minHeight: 100, padding: 14, border: "1.5px dashed var(--border-strong)", borderRadius: 12, background: "var(--surface)", cursor: "pointer", textAlign: "center", transition: "border-color .15s ease, background .15s ease" },
  zoneOver: { borderColor: "var(--brand)", background: "rgba(var(--brand-rgb),0.05)" },
  placeholder: { display: "flex", flexDirection: "column", gap: 3, color: "var(--text)", fontSize: 13, lineHeight: 1.4 },
  hint: { fontSize: 11.5, color: "var(--muted)" },
  preview: { maxHeight: 76, maxWidth: "100%", objectFit: "contain", borderRadius: 8 },
  row: { display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap", minHeight: 18 },
  muted: { fontSize: 12, color: "var(--muted)" },
  remove: { padding: "6px 11px", borderRadius: 8, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "#b23b3b", fontWeight: 600, fontSize: 12.5, cursor: "pointer" },
  err: { marginTop: 8, fontSize: 12.5, color: "#b23b3b" },
  urlDetails: { marginTop: 10 },
  urlSummary: { fontSize: 12.5, color: "var(--brand)", cursor: "pointer", fontWeight: 600 },
  urlInput: { width: "100%", padding: "9px 11px", borderRadius: 9, border: "1px solid var(--border-strong)", fontSize: 14, marginTop: 8, boxSizing: "border-box" }
};
