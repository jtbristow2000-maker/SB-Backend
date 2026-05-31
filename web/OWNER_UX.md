# OWNER_UX.md — Owner web/mobile experience (missed-call pipeline)

**Status:** Spec / contract. Not yet implemented.
**Owner of this doc:** Claude (dashboard GUI / owner workflow screens).
**Scope:** ONE mobile detailer, single tenant, **missed-call → lead-intake pipeline only.**
Not in scope here: multi-tenant, auth beyond the existing `X-API-Key`, billing, the no-code
builder, analytics, full scheduling/quoting modules, AI summaries (Phase 3).

This locks the contract so the read API (BACKEND-14/15) and the Next.js owner screens are built
against the same shape. If a screen needs a field, it is listed in §4 — the API must provide it.

---

## 1. The job of this UI

In ≤5 seconds, standing in a driveway, one-handed, in sunlight, the owner must see:

1. **Who's waiting** for a callback,
2. **Whether they already replied** to our auto-text,
3. **Whether our auto-text actually went out** (vs queued/not-sent in sandbox),
4. and **tap Call or Text** to respond.

Everything below serves those four truths. Mobile-first; desktop is the same layout wider.

---

## 2. Minimum screen set (two screens)

### Screen 1 — Callbacks (home / triage)
A single scrollable list of profiles with an **open `callback` task**, hottest first.

- **Sort:** profiles where `customer_replied = true` first, then by `last_contact_at` desc.
- **Row (`LeadRow`):**
  - Title: `display_name` or, if null, the formatted `phone_e164` (e.g. `(555) 210-4400`). Never blank.
  - Time: relative, from the call's `started_at` ("7 min ago").
  - Context line: voicemail snippet if present, else literal **"Missed · no voicemail."**
  - **`AutoReplyChip`**: sent / not-sent (sandbox) / failed — see §3.
  - **`RepliedBadge`**: shown when `customer_replied = true` → "Replied — waiting on you," row gets an accent left edge.
  - Actions: **Call** · **Text** (Text opens Screen 2 focused on the compose field).
- **Empty state:** "You're all caught up — no callbacks waiting." (calm, not an error).

### Screen 2 — Lead profile (detail)
One screen, top to bottom. Absorbs lead profile + call history + voicemail transcript + SMS thread + callback task + next steps.

1. **Profile header** — name or formatted phone, `status`, "Last heard from: {last_contact_at}", address if known. Inline **"Add name"** when `display_name` is null.
2. **Unified timeline** (single merged, reverse-chronological list — NOT separate Calls/Messages tabs):
   - **`CallItem`** — "Missed call · 7:41pm" / "Voicemail · 0:34" / "You answered."
   - **`VoicemailItem`** — `transcript` inline + **Play** (`recording_url`) + a quiet caption **"Auto-transcribed — may contain errors"** when `needs_review = true`. `ai_summary` is null today → **do not render an AI panel**; show the transcript.
   - **`MessageBubble`** — inbound/outbound SMS; the auto-reply renders with its true `status` (§3).
3. **`CallbackActionBar`** (pinned bottom): **Call · Text · Mark done** (`Mark done` completes the callback task). Includes a **`ComposeField`** for the reply.
4. **`NextStepButtons`**: **Book appointment** · **Draft quote** — lightweight create sheets only:
   - Appointment sheet: service, date/time, optional address → creates an `appointment` row linked to the profile.
   - Quote sheet: service, amount, note → creates a `quote_draft` row.
   - These exist here only to show the lead can advance. **No calendar grid, no line-item quoting** in this scope.

---

## 3. State surfacing rules (do not get these wrong)

**Auto-reply (`AutoReplyChip`)** — maps `message.status` of the outbound auto-text:
| status | label | color |
|---|---|---|
| `sent` | "Auto-reply sent" | green |
| `queued` | **"Not sent — sandbox"** | amber |
| `failed` | "Auto-reply failed — Resend" | red |

> ⚠️ **Never render `queued` as "Sent."** In sandbox (`SMS_SENDING_ENABLED=false`) the auto-text is
> recorded but NOT delivered. Showing it as sent makes the owner trust a message the customer
> never received. This is the single most important rule in this document.

**Call outcome (`OutcomeLabel`)** — from `call_type` (+ transcript presence):
- `voicemail` → "Voicemail" (show transcript)
- `missed`, no recording → "Missed · no voicemail" (still a lead; auto-text still went)
- `answered` → "You answered" (should not appear in the callback queue)

**Replied** — `customer_replied = true` is the loudest signal in the app. Top of list, accent edge,
"Replied — waiting on you."

**Transcript** — always caption as auto-transcribed when `needs_review = true`; allow the owner to
correct it (clears `needs_review` via the write API, future task).

---

## 4. Data the screens require (read-API contract → BACKEND-14/15)

**`GET /api/profiles`** (api-key guarded) — one entry per profile with an open callback task:
```
id, display_name, phone_e164, status, last_contact_at,
open_task_id,
last_call_outcome        // "missed" | "voicemail" | "answered"
voicemail_snippet         // first ~80 chars of transcript, or null
auto_reply_status         // "sent" | "queued" | "failed" | "none"
customer_replied          // boolean  — STRUCTURED, not parsed from task.notes
last_inbound_at           // timestamp | null
```
Sort: `customer_replied` desc, then `last_contact_at` desc.

**`GET /api/profiles/{id}`** — profile detail:
```
profile { ...CustomerProfileRow }
timeline []   // MERGED + time-ordered, each item tagged kind:"call"|"message"
  call:    { id, call_type, started_at, duration_seconds, transcript,
             recording_url, needs_review }
  message: { id, direction, channel, body, status, sent_at }
open_task { id, task_type, title, status, due_at } | null
appointments []   // linked rows (may be empty)
quote_drafts []   // linked rows (may be empty)
customer_replied  // boolean
```
404 on unknown id / cross-business id.

**Definition of `customer_replied`:** an inbound `message` exists with `created_at` after the most
recent missed `call_record` for that profile. Compute server-side; do not rely on `task.notes`.

---

## 5. Component kit (minimum)

`LeadRow` · `OutcomeLabel` · `AutoReplyChip` · `RepliedBadge` · `Timeline` · `CallItem` ·
`VoicemailItem` · `MessageBubble` · `CallbackActionBar` · `ComposeField` · `NextStepButtons` ·
`EmptyState`.

Mobile rules: ≥56px tap targets, thumb-zone actions, high contrast (sunlight), one primary action
per row, no horizontal scroll, optimistic UI, cache the last list for bad signal.

---

## 6. Microcopy

Operator language, never DB/system terms. `customer_profile_id`, `provider_call_id`, raw
`call_type`, or `status:"queued"` must never appear on screen.
- "Missed call" / "Voicemail" / "You answered"
- "Call back" (task) → "Done"
- "Auto-reply sent" / "Not sent (texting is off)" / "Auto-reply failed"
- "Check transcript" (needs_review)
- "Last heard from: 7:45pm"

---

## 7. Explicitly NOT in this scope

Charts/analytics; separate Calls/Messages/Quotes navigation; empty AI panels; the dashboard
builder; full calendar or quoting modules; multi-user; anything not on the line from
"customer calls" → "owner sees the lead and taps Call."

---

## 8. Open dependency

These screens cannot be built until **BACKEND-14/15** expose the fields in §4. The owner screens are
a Claude-owned task to be implemented against this contract once the read API lands.
