import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./styles.css";
import { RegisterSW } from "./RegisterSW";

// Single app-wide typeface. Exposed as a CSS variable so styles.css can build
// the font stack; loaded via next/font so it's self-hosted (no FOUT/layout shift).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const appName = process.env.BUSINESS_NAME?.trim() || "Business Hub";

export const metadata: Metadata = {
  applicationName: appName,
  title: { default: `${appName} — Owner`, template: `%s · ${appName}` },
  description: "Turn missed calls into booked jobs — auto text-back, voicemail transcripts, and one-tap replies.",
  icons: { icon: "/icon.svg" },
  // Installable to the home screen + runs full-screen (no browser chrome) on iOS.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: appName
  }
};

export const viewport: Viewport = {
  themeColor: "#5b5bd6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
