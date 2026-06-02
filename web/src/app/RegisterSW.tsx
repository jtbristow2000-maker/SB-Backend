"use client";

import { useEffect } from "react";

// Registers the service worker so the app is installable + has an offline fallback.
// Invisible; rendered once from the root layout.
export function RegisterSW() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; the app works fine without it */
      });
    }
  }, []);

  return null;
}
