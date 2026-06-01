// Per-device "have I opened this lead since its last activity?" tracking, stored
// in localStorage. Read/unread is a personal UI cue, not shared business data, so
// it lives in the browser — no DB column, instant, works offline. A lead is unread
// until opened, and goes unread again when newer activity arrives (we compare the
// lead's last-activity timestamp against the time we recorded when it was opened).

const KEY = "sb-lead-read-v1";

export type ReadMap = Record<string, string>; // profileId -> ISO timestamp last seen

export function loadReadMap(): ReadMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReadMap) : {};
  } catch {
    return {};
  }
}

function saveReadMap(map: ReadMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable / full */
  }
}

// Record that a lead was just opened. We store the lead's latest activity time so
// that any newer activity later re-flags it as unread.
export function markLeadRead(id: string, activity: string | null): ReadMap {
  const map = loadReadMap();
  map[id] = activity ?? new Date().toISOString();
  saveReadMap(map);
  return map;
}

export function isLeadUnread(map: ReadMap, id: string, activity: string | null): boolean {
  const seen = map[id];
  if (!seen) return true; // never opened
  if (!activity) return false;
  return activity > seen; // newer activity than when we last looked
}
