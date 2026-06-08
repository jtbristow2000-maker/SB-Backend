"use client";

import { LeadCard, leadGrid, useReadMap, type LeadCardItem } from "./LeadCard";

// Today's "Needs attention" grid — a thin wrapper around the shared LeadCard so the
// triage list and the Leads pipeline render identical cards. (callTimeLabel etc. are
// kept on the item for compatibility but no longer shown at the glance level.)

export type LeadListItem = LeadCardItem & {
  responded?: boolean;
  callTimeLabel?: string | null;
  voicemailLabel?: string | null;
};

export function LeadList({ items }: { items: LeadListItem[] }) {
  const { readMap, markRead } = useReadMap();
  return (
    <div style={leadGrid}>
      {items.map((it) => (
        <LeadCard key={it.id} item={it} readMap={readMap} onOpen={() => markRead(it.id, it.lastActivity)} />
      ))}
    </div>
  );
}
