import type { MetadataRoute } from "next";

// Web app manifest → served at /manifest.webmanifest and auto-linked by Next.
// Makes the owner app installable ("Add to Home Screen") and run standalone
// (no browser chrome). The installed name uses BUSINESS_NAME when set.
export default function manifest(): MetadataRoute.Manifest {
  const appName = process.env.BUSINESS_NAME?.trim() || "Business Hub";

  return {
    id: "/owner/today",
    name: `${appName} — Owner`,
    short_name: appName.slice(0, 12),
    description: "Turn missed calls into booked jobs — auto text-back, voicemail transcripts, and one-tap replies.",
    start_url: "/owner/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3f5f9",
    theme_color: "#5b5bd6",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }
    ]
  };
}
