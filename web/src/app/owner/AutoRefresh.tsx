"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps the owner screens live: re-fetches the server-rendered data on an
// interval (and when the tab regains focus) so new calls/voicemails/replies
// appear without a manual refresh. router.refresh() re-runs the server
// components without a full page reload, so scroll position is preserved.

export function AutoRefresh({ seconds = 10 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => router.refresh();
    const id = setInterval(tick, seconds * 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);

  return null;
}
