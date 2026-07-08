import type { CSSProperties } from "react";

// Shared skeleton primitives for the owner loading screens. Pure CSS shimmer
// (see .skeleton in styles.css); shapes only, no text — mirrors each page's
// layout closely enough that the content swap doesn't jump.

export function Bar({ w, h = 14, style }: { w: number | string; h?: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width: w, height: h, ...style }} />;
}

export function CardBlock({ h, style }: { h: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ height: h, borderRadius: "var(--radius-lg)", ...style }} />;
}

export function CardRow({ count, h, minW = 160 }: { count: number; h: number; minW?: number }) {
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {Array.from({ length: count }, (_, i) => (
        <CardBlock key={i} h={h} style={{ flex: `1 1 ${minW}px`, minWidth: minW }} />
      ))}
    </div>
  );
}
