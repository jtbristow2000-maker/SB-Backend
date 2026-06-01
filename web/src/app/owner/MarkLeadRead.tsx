"use client";

import { useEffect } from "react";

import { markLeadRead } from "./leadRead";

// Invisible helper on the lead detail page: marks the lead read as soon as it's
// opened (covers every entry point — dashboard, Leads list, direct link). Re-runs
// if the activity timestamp changes so a freshly-arrived voicemail is marked seen.
export function MarkLeadRead({ id, activity }: { id: string; activity: string | null }) {
  useEffect(() => {
    markLeadRead(id, activity);
  }, [id, activity]);
  return null;
}
