import { ImageResponse } from "next/og";

// Crisp PNG home-screen icon for iOS (Safari doesn't use the SVG manifest icon).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5b5bd6, #7c3aed)"
        }}
      >
        <div
          style={{
            width: 104,
            height: 72,
            background: "#ffffff",
            borderRadius: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: 99, background: "#6d3ad9" }} />
          <div style={{ width: 14, height: 14, borderRadius: 99, background: "#6d3ad9" }} />
          <div style={{ width: 14, height: 14, borderRadius: 99, background: "#6d3ad9" }} />
        </div>
      </div>
    ),
    { ...size }
  );
}
