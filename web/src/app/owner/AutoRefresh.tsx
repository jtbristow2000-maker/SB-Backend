"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Keeps the owner screens live without being twitchy: re-fetches the server-rendered
// data on a calm interval, and immediately when the tab regains focus (the common
// "switch back and check" case). Skips a tick while the owner is typing in a field —
// a background re-render mid-keystroke feels glitchy — and while the tab is hidden
// (no point paying for refreshes nobody sees). router.refresh() re-runs the server
// components without a full page reload, so scroll position is preserved.

function isTyping(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible" || isTyping()) return;
      router.refresh();
    };
    const id = setInterval(tick, seconds * 1000);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
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
