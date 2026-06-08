"use client";

import { useEffect, useRef } from "react";

// Warns before leaving a form page with unsaved changes. Covers both ways out:
//  - hard navigation (tab close, reload, typing a URL) via `beforeunload`
//  - in-app navigation (clicking a sidebar tab/link) via a capture-phase click
//    interceptor — the Next App Router has no built-in route-block API.
// "Dirty" = the form's serialized fields differ from their baseline (captured on
// mount, re-captured on save), so it catches text inputs, sliders, the color
// picker, quote rows, and the logo (a hidden field) alike.

function serialize(form: HTMLFormElement): string {
  const parts: string[] = [];
  for (const [k, v] of new FormData(form).entries()) {
    if (typeof v === "string") parts.push(`${k}=${v}`);
  }
  return parts.join("\n");
}

export function UnsavedChangesGuard({ formId }: { formId: string }) {
  const baseline = useRef<string | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;

    baseline.current = serialize(form);
    const isDirty = () => baseline.current !== null && serialize(form) !== baseline.current;

    // Saving resets the baseline so we don't warn right after a successful save.
    const onSubmit = () => { baseline.current = serialize(form); };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onClickCapture = (e: MouseEvent) => {
      // Only plain left-clicks; let cmd/ctrl/shift-click (new tab/window) through.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      // Intra-app navigations away from this page only — hard/external nav is handled
      // by beforeunload. Skip same-page links, hashes, new tabs, and downloads.
      if (!href.startsWith("/") || href === window.location.pathname) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      if (!isDirty()) return;
      if (!window.confirm("You have unsaved changes in Settings. Leave without saving them?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    form.addEventListener("submit", onSubmit);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      form.removeEventListener("submit", onSubmit);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [formId]);

  return null;
}
