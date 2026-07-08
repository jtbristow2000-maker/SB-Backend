"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";

// Branded error boundary for the owner app — replaces Next's raw error screen
// with a friendly card and a retry. The error itself is logged to the console
// (and Sentry when configured) rather than shown to the owner.
export default function OwnerError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="owner-page" style={{ maxWidth: 560 }}>
      <div className="card" style={{ padding: "34px 28px", textAlign: "center" }}>
        <TriangleAlert size={34} strokeWidth={1.8} style={{ color: "#b06f12" }} aria-hidden />
        <h2 style={{ margin: "14px 0 6px", fontSize: 19, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.3px" }}>
          Something went wrong
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--muted)", lineHeight: 1.55 }}>
          That screen hit a snag. Your data is safe — try again, or head back to Today.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" onClick={reset} className="btn btn-primary">Try again</button>
          <Link href="/owner/today" className="btn btn-secondary">Go to Today</Link>
        </div>
      </div>
    </main>
  );
}
