"use client";

import { useEffect } from "react";

// Root error boundary — catches crashes outside the owner app (auth screens etc.)
// with a plain, branded card instead of Next's default error page.
export default function RootError({
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
    <div className="shell">
      <div className="panel" style={{ textAlign: "center" }}>
        <p className="eyebrow">Snagly</p>
        <h1 style={{ fontSize: 24 }}>Something went wrong</h1>
        <p style={{ marginBottom: 20 }}>That page hit a snag — give it another try.</p>
        <button
          type="button"
          onClick={reset}
          className="btn btn-primary"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
