import type { Metadata, Viewport } from "next";
import "./styles.css";
import { RegisterSW } from "./RegisterSW";

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
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
