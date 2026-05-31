import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "SB Web Backend",
  description: "Sandbox-first web/API foundation for small business intake."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
