# CHANGELOG_AI.md

## [2026-06-08] - Settings: AI & Replies moved to the top

### Changed
- Moved the **AI & Replies** block to the top of Settings (first section in the form) — it's the core setting of the app, so it leads instead of sitting below business name / brand / hours / quote ranges.

### Verified
- `npm run verify` passes: 40 test files, 149 passed, 1 skipped.

## [2026-06-08] - Settings tidy: Signature + consolidated replies block

### Changed
- Renamed the "Reply sign-off" field to **Signature** (label only; the `ai_sign_off` field is unchanged).
- Moved the **Missed-call auto-text** into the **AI & Replies** section (top of the block) so all reply settings live together, instead of a separate section.

### Verified
- `npm run verify` passes: 40 test files, 149 passed, 1 skipped.

## [2026-06-08] - Unsaved-changes guard on Settings

### Added
- Settings now warns before you leave with unsaved edits. `UnsavedChangesGuard` covers both hard navigation (tab close / reload / URL) via `beforeunload` and in-app navigation (clicking a sidebar tab) via a capture-phase link interceptor, since the App Router has no built-in route block. "Dirty" is detected by comparing the form's serialized fields to a baseline captured on mount and re-captured on save — so it catches text, sliders, color, quote rows, and the logo (a hidden field) alike.

### Verified
- `npm run verify` passes: 40 test files, 149 passed, 1 skipped.

## [2026-06-08] - AI fills richer customer profile details

### Added
- Extended voicemail extraction output with `vehicle`, `preferred_contact`, `address`, and `referral_source`, with prompt rules requiring explicit transcript evidence and no invented details.
- Added guarded intake persistence that copies extracted profile details into blank customer profile fields only: `vehicle` -> `vehicles`, PO-box-like addresses -> `po_box`, other addresses -> `address_line1`, plus `preferred_contact` and `referral_source`.

### Changed
- Kept owner-entered profile values authoritative by skipping any extracted field when the profile already has a value.
- Dropped unsupported preferred-contact values before persistence so the `call`/`text`/`email` database constraint is respected.

### Verified
- `npm run verify` passes: 40 test files, 149 passed, 1 skipped.

## [2026-06-08] - Logo file upload (drag & drop) in Settings

### Added
- Settings → Brand logo now has a **drag-and-drop / click-to-choose file uploader** (`LogoUpload`). The image is downscaled in the browser to a ~256px PNG data URL (SVGs kept as vector) and stored in the existing `logo_url` setting — no file storage/backend needed, so it round-trips through `saveSettings` like any other field. Live preview, remove button, size/type guards, and a "paste a URL" fallback. (Completes logo Option B without Codex/Supabase Storage.)

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-08] - Interactive setup checklist on Today

### Added
- A dismissible "Get set up" checklist on the Today dashboard that tracks setup progress from real data and ticks itself off: **Connect your number** (`business.twilio_number_e164`), **Add services/prices/hours** (`quote_ranges`), **Get your first lead** (any profiles/calls). Includes the critical voicemail-timing callout under the number step, a "test it" hint, and a progress bar. Shows a "🎉 You're all set!" state when complete; dismiss persists per-browser (localStorage).

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-08] - Keep Leads as the contact list (revert)

### Changed
- Reverted the Leads page + directory to the compact contact-list view (name + status badge, "how this lead's been handled" line, phone) — it works better as a contact list than the info-card grid. The Callbacks→Today merge, the removed Callbacks tab, and the "Opened" status all stay.

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-08] - Retire Callbacks page; Leads becomes the pipeline (MAJOR)

> **Restore point:** branch `with-callbacks-page` (+ its Vercel preview) is the last
> version that still has the standalone Callbacks screen, if we ever want it back.

### Changed
- **Removed the standalone Callbacks screen.** It duplicated Today's Needs Attention. `/owner` now redirects to `/owner/today`, and the sidebar/tab nav drops the Callbacks tab (now: Today · Leads · Schedule). A lead detail's back link + the Today metric/links point at Leads.
- **Leads is now the full pipeline**, rendered with the same glanceable info cards as Today (name + vehicle, status, summary, Wants/Asked-for/Quote, snippet) instead of the old one-line directory rows. Booked leads show a "✅ Booked · <when>" line; stage filter chips (All · New · Contacted · Booked · Won · Lost) remain.
- Extracted a shared `LeadCard` component + `useReadMap` hook so Today and Leads can't visually drift.

### Added
- **"Opened" status** — a brand-new lead the owner has viewed (but not yet contacted) shows an "Opened" pill instead of "New" (derived from local view history; per-browser, no backend change).

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-08] - Lead cards become a glanceable info grid

### Changed
- Replaced the compact lead list + hover preview with a responsive **grid of info cards**. Each card now shows inline what used to live in the hover: name + vehicle, status pill, the AI summary, 🔧 Wants / 📅 Asked for / 💰 Quote, and the voicemail snippet — so the dashboard reads at a glance with no hover required (Today's Needs Attention + Callbacks).
- Removed the voicemail-length / call-time line from the card (per request — not needed at the glance level; still on the lead page).
- Added `.clamp-1` / `.clamp-2` line-clamp utilities so summaries/snippets stay tidy.

### Fixed
- Voicemail snippet no longer double-wraps in quotes (the snippet already carries its own quotes).

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-08] - Premium UI pass + dashboard metric rework

### Added
- Premium design tokens in `styles.css` — layered elevation (`--shadow-sm/md/lg`), surface/border/ink/muted colors, and reusable `.card` / `.card-tap` (hover-lift) / `.scroll-soft` primitives, referenced from inline styles via `var()`.
- Today metric cards reworked: dropped the confusing "Replied — waiting on you" (always 0) and the redundant all-time "Voicemails" (≈ Callbacks); added **Booked today** and **Voicemails today** so the top row is a true "today" snapshot above the weekly rollup.
- Every lead card now shows a status pill (the "New" state was previously hidden) plus the call time inline for more at-a-glance info.

### Changed
- Refined the dark sidebar (subtle gradient + edge, smoother nav hover/active with an accent rail), logo glow, and heading typography (heavier weight, tighter tracking) app-wide.
- Lead cards (Today + Callbacks), the Leads directory, lead detail, schedule (week grid / agenda / modal), settings, phone-number, and simulator surfaces all moved onto the shared card primitives + elevation tokens for a consistent, elevated look.

### Fixed
- Status/metric chips that used a `var(--brand)1a` string (invalid CSS → no fill) now render proper rgba tints on the Today metric chips and the Leads status badges.
- The "Booked today" card links to `/owner/calendar` (the real Schedule route) instead of a non-existent `/owner/schedule`.

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-08] - Auto-fill customer details from the voicemail

### Added
- The lead detail "Customer details" panel now pre-fills **Vehicle(s)** and **Preferred contact** from the voicemail transcript(s), AI summaries, and inbound texts across the lead's full history — shown as editable suggestions until the owner reviews and Saves them.
- Added `detectPreferredContact` (conservative: only explicit "text me / email me / call is best" phrasing, never a generic "call me back" closer) and exported the existing `detectVehicle` from `leadRundown.ts`.
- A ✨ marker on the panel header + an inline "Pre-filled from the voicemail" hint when a field was auto-suggested. Address / referral stay blank (rarely spoken on a voicemail).

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-08] - Richer customer profile fields

### Added
- Added nullable customer profile fields for `vehicles`, `po_box`, `preferred_contact`, and `referral_source`, plus the existing address and notes fields are now part of the owner-editable profile contract.
- Added Supabase migration `0007_customer_profile_details.sql` with an idempotent preferred-contact constraint for `call`, `text`, or `email`.
- Added `first_time_customer` to the profile detail read model, derived from whether the profile has any completed appointments.

### Changed
- Extended customer profile create/upsert/update paths for both in-memory and Supabase-backed repositories so richer profile details round-trip through the same repository interfaces.
- Extended `PATCH /api/profiles/{id}` validation to accept the new owner-editable fields and reject unsupported `preferred_contact` values.

### Verified
- `npm run verify` passes: 40 test files, 146 passed, 1 skipped.

## [2026-06-07] - AI-driven delayed missed-call auto-replies

### Added
- Added a delayed missed-call auto-reply flow that waits for voicemail transcription, or a 75-second fallback timeout, before composing the response.
- Added level-aware AI reply generation for per-business `ai_reply.auto_reply_level` settings: template fallback at level 0, personalized AI at level 1, service/open-time context at level 2, and full service/price/time context at level 3.
- Added Anthropic/OpenAI auto-reply providers behind the existing AI-provider gating, plus sandbox-safe fallback behavior when AI is disabled or unconfigured.
- Added server-side open-slot suggestions for reply composition using business hours and existing appointments.

### Changed
- Missed-call auto-text messages are no longer created at dial-status time; they are created after transcription or timeout.
- When SMS sending is disabled, the composed auto-reply is saved as a `draft` message with metadata instead of being dropped or reported as sent.

### Verified
- `npx tsc --noEmit` passes.
- `npx vitest run` (38 files, 143 tests, 1 skipped) passes.

## [2026-06-05] - Batch demo-lead seeding in the Simulator

### Added
- Added a "Spawn a batch" control to the owner Simulator (`simulateLeadBatch` action + simulator page UI) that creates up to 50 varied, fully-populated demo leads in one action — randomized caller name, vehicle, service, and timing, each tagged `source: "simulator"` — so owners can see how the dashboard handles real volume.

### Verified
- `npm run verify` (37 files, 136 tests, 1 skipped) passes.

## [2026-06-05] - Twilio call-capture concurrency test

### Added
- Added a signed-webhook concurrency test for the Twilio call-capture pipeline that runs 50 distinct calls through voice intake, no-answer status, recording-ready, and transcription callbacks concurrently.
- Added an idempotency-under-race test that posts the same incoming voice webhook 10 times concurrently and asserts a single persisted call/profile.

### Fixed
- Fixed a real in-memory customer-profile upsert race where simultaneous same-phone webhook requests could throw `DuplicateCustomerProfileError` instead of re-reading the profile created by the winning request.

### Verified
- `npm run verify` (37 files, 136 tests, 1 skipped) passes.

## [2026-06-03] - Editable business name in Settings

### Added
- Added a "Business name" field at the top of owner Settings; `saveSettings` now updates the business row name (carrying existing owner/phone/timezone values forward so nothing else is wiped) so owners can rename their business instead of being stuck with the email-derived default.

### Verified
- `npm run verify` (36 files, 134 tests, 1 skipped) passes.

## [2026-06-03] - Owner phone-number settings UI

### Added
- Added a "Phone number" section to owner Settings (`PhoneNumberSection`): shows the business's connected number + trial countdown/badge, an "Activate my number" button (sandbox-safe), call-forwarding instructions, and a collapsible port-in form to collect the info needed to move the owner's real number over.
- Added owner server actions `activateNumber` / `savePortInfo` / `submitPort` wrapping the telephony provisioning + porting services, using the request-scoped runtime repositories.

### Verified
- `npm run verify` (36 files, 134 tests, 1 skipped) passes.

## [2026-06-03] - Per-business Twilio number foundation

### Added
- Added `0006_business_numbers_and_port_requests.sql` to store per-business Twilio numbers, trial status, trial end time, and Phase 2 number port requests with tenant RLS.
- Added typed business telephony fields and number port request table types/repositories for memory and Supabase.
- Added backend telephony services for sandbox-safe trial number provisioning, owner-triggered activation, number trial read state, inbound To-number routing, and porting intake/submission/completion scaffolds.
- Added config for `TWILIO_AUTO_PROVISION` and `TWILIO_DEFAULT_AREA_CODE`, defaulting real auto-provisioning off.

### Changed
- Incoming voice and SMS now resolve the business by `twilio_number_e164` first, falling back to the legacy bootstrap `business_phone_e164`.
- Owner-approved outbound SMS now uses the business-owned Twilio number as the From number when present.

### Safety
- Real Twilio number purchase is never automatic on signup and is simulated in memory/sandbox mode. Real provisioning requires an explicit backend activation call plus `TWILIO_AUTO_PROVISION=true`, Supabase persistence, non-sandbox mode, credentials, and `PUBLIC_BASE_URL`.
- Phase 2 porting stores intake data/status only; Twilio Porting API automation is intentionally left as a future seam.

### Verified
- `npm run verify` (36 files, 134 tests, 1 skipped) passes.

## [2026-06-03] - Sign-up backend seeds owner business profile

### Changed
- Extended `/api/auth/sign-up` payload parsing to accept `business_name`, `owner_name`, and `phone` from form-encoded and JSON requests.
- Threaded those sign-up fields into first-business provisioning so the seeded business uses the submitted business name, owner name, and normalized phone number.
- Mapped Supabase sign-up failures to specific error codes for disabled signups, duplicate email, weak password, and invalid email.
- Made post-auth business provisioning best-effort: failures are logged without blocking the auth redirect.

### Added
- Added backend tests for sign-up payload parsing, business seed overrides/fallbacks, and sign-up error-code mapping.

### Verified
- `npm run verify` (32 files, 126 tests, 1 skipped) passes.

## [2026-06-03] - Dedicated owner sign-up screen

### Added
- Added a dedicated `/signup` page (server page + client `SignupForm`) with business name, owner name, email, phone, and password + confirm-password fields. Inline validation (min length + match) runs before posting to `/api/auth/sign-up`, and known server error codes map to specific messages.
- Linked `/login`'s "Create account" to `/signup` and mapped login error codes to specific messages instead of one generic line.

### Note
- The backend now persists the posted profile fields when seeding the first business.

### Verified
- `npm run verify` (31 files, 117 tests, 1 skipped) passes.

## [2026-06-03] - Owner shell sign-out button

### Added
- Added a "Sign out" control to the owner shell (desktop sidebar footer + mobile top bar) that posts to `/api/auth/sign-out`. Shown only when `PERSISTENCE=supabase` (real auth is active), since memory mode has no session to end.

### Verified
- `npm run verify` (31 files, 117 tests, 1 skipped) passes.

## [2026-06-03] - Owner route protection and business context

### Changed
- Routed owner server-rendered reads and server actions through `getOwnerBusinessContext()` so memory mode stays auth-free while Supabase owner paths use the signed-in user's business-scoped repositories.
- Added `/owner/**` middleware that protects owner routes only when `PERSISTENCE=supabase`, refreshes Supabase session cookies, and redirects unauthenticated owners to `/login`.
- Preserved webhook/cron service-role paths and the in-memory sandbox runtime without requiring auth.

### Added
- Added owner route guard coverage for memory vs. Supabase protection behavior.

### Verified
- `npm run verify` (31 files, 117 tests, 1 skipped) passes.

## [2026-06-03] - Supabase tenant RLS migration

### Added
- Added an RLS migration that enables row-level security on business, membership, lead, call, message, task, appointment, quote draft, and audit tables.
- Added membership-based policies using `auth.uid()` through a security-definer helper so authenticated owner sessions only see their business rows while service-role webhooks/cron remain available.
- Added an offline migration coverage test and a `TASKS.md` Supabase rollout note for applying the auth migrations and enabling Email auth.

### Verified
- `npm run verify` (30 files, 115 tests, 1 skipped) passes.

## [2026-06-03] - Owner business membership tenancy

### Added
- Added typed `business_members` support with in-memory and Supabase repository implementations.
- Added per-user business resolution/bootstrap helpers that create one business plus owner membership for first-time signed-in users.
- Added the `0004_business_members.sql` migration and wired `businessMemberRepository` into the intake runtime while keeping single-tenant bootstrap limited to memory mode.

### Verified
- `npm run verify` (29 files, 113 tests, 1 skipped) passes.

## [2026-06-03] - Owner auth wiring foundation

### Added
- Added Supabase SSR auth clients for request-bound server usage and browser usage, plus `getServerSession()` / `getCurrentUser()` helpers.
- Added email/password auth route handlers for sign-in, sign-up, and sign-out, with JSON and form-post support.
- Added a minimal `/login` page as the redirect target for the upcoming owner route guard.

### Verified
- `npm run verify` (28 files, 109 tests, 1 skipped) passes.

## [2026-06-01] - PWA: installable, standalone owner app

### Added
- **Web app manifest** (`app/manifest.ts` → `/manifest.webmanifest`): standalone display, portrait,
  brand theme/background, `start_url` `/owner/today`, SVG + maskable icons. The app is now installable
  ("Add to Home Screen") and runs full-screen with no browser chrome.
- **Icons**: `public/icon.svg` brand mark (manifest + favicon) and `apple-icon.tsx` (generated PNG) for
  a crisp iOS home-screen icon. App name uses `BUSINESS_NAME` when set.
- **Service worker** (`public/sw.js`) + `RegisterSW`: network-first navigations with an `/offline`
  fallback page; deliberately caches no app code or data, so the live dashboard never serves stale leads.
- Root layout: `appleWebApp` meta (capable / title / status bar), `themeColor`, `viewportFit: cover`
  (notch-safe), and proper app name/description.

### Verified
- `npm run verify` (28 files, 109 tests, 1 skipped) and `next build` pass; `/manifest.webmanifest`,
  `/apple-icon`, and `/offline` routes generated.

## [2026-06-01] - Lead page UX cleanup: consolidated action bar + lighter chrome

### Changed
- Replaced the three stacked control rows with a clear hierarchy: prominent **Call / Text**, then a
  compact secondary `LeadActionBar` — **status that auto-saves** on change (no Save button),
  **Mark done**, and a **📅 Book** button that reveals the booking fields on demand instead of an
  always-open form.
- "Texting is live" is now a quiet one-line note (the loud banner shows only when texting is OFF and
  actionable). Dropped the redundant status text from the header subline and the static "built from
  your settings" badge; trimmed the reply box to 4 rows. All features preserved (chips stay visible).

### Verified
- `npm run verify` (28 files, 109 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Lead detail consumes the shared profile-detail timeline

### Changed
- The lead page now derives its **calls, AI summary/hero, and the conversation's call items from the
  shared `buildProfileDetail` timeline** (the same projection `GET /api/profiles/{id}` returns)
  instead of re-filtering raw call rows — so the screen and the read API can't drift. Removed the
  page's bespoke `profileCalls` derivation. No visual/behavior change.

### Notes
- Messages still read from the raw rows only to label auto-reply vs. owner-sent (the timeline message
  item lacks `provider_message_id`); `busy` still uses all-business appointments for slot conflicts
  (not the lead-scoped `detail.appointments`). Both logged as follow-ups in `TASKS.md`.

### Verified
- `npm run verify` (28 files, 109 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Quote helper follow-up closed

### Changed
- Closed the `TASKS.md` maintenance follow-up for duplicate owner quote helpers now that owner screens use the shared backend `quotePriceLabel()` helper.

### Verified
- `npm run verify` (28 files, 109 tests, 1 skipped) passes.

## [2026-06-01] - Lead detail related-record parity

### Changed
- Extended `buildProfileDetail` and `GET /api/profiles/{id}` to include profile-linked appointments and quote drafts while preserving the existing profile, timeline, open task, and reply fields.
- Added an in-memory and Supabase-backed quote draft repository seam so the detail route can read quote drafts behind the same runtime interface as the other repositories.

### Added
- Expanded the lead detail route test to assert linked appointments and quote drafts are returned and unrelated records are excluded.

### Verified
- `npm run verify` (28 files, 109 tests, 1 skipped) passes.

## [2026-06-01] - Owner action audit consolidation

### Changed
- Routed owner server-action mutations through the canonical audited backend helpers for owner SMS, profile updates, task updates, and appointment create/update/delete behavior.
- Preserved owner action signatures and revalidation behavior while removing duplicate direct repository mutation logic from `web/src/app/owner/actions.ts`.

### Added
- Added owner server-action tests covering audit events for owner text sending, profile status changes, callback completion, contact marking, and appointment create/update/delete flows.

### Verified
- `npm run verify` (28 files, 109 tests, 1 skipped) passes.

## [2026-06-01] - Owner UI realign: dedupe helpers + remove dead styles (no behavior change)

### Changed
- Deduped formatting/parsing helpers into `web/src/app/owner/format.ts` (`fmtPhone`, `fmtUsd`,
  `readExtracted` + `Extracted` type) and switched the three `priceForService` copies (calendar page,
  lead detail, leadRundown) to the shared `quotePriceLabel` from `@/server/business/settings`.
  Behavior-identical (the calendar's null-phone "" case is preserved at the call site).
- Removed dead style keys left over from earlier feature changes: lead detail
  (`hero*`, old `callItem`/`callHead`/`transcript`, `quickActions`/`callBtn`/`textBtn`/`taskBar`,
  `compose`/`textInput`); Callbacks (`meta`, `replied`, `linkBtnGhost`, `inlineLink`); Today
  (`rowMeta`, `replied`, `link`); ReplyComposer (`tuneBtn`, `controls`). Verified unreferenced first.

### Verified
- `npm run verify` (27 files, 106 tests, 1 skipped) and `next build` pass. No visual/behavior change.

## [2026-06-01] - Owner data-contract drift review

### Reviewed
- Reviewed recent `web/src/app/owner/**` reads and server actions against the current backend profile, SMS, task, appointment, and business-settings contracts.
- Logged follow-up contract notes in `TASKS.md` for quote helper reuse, audited service-helper alignment, and lead-detail related-record parity.

### Verified
- `npm run verify` (27 files, 106 tests, 1 skipped) passes.

## [2026-06-01] - Follow-up sweep cron readiness

### Added
- Added `web/vercel.json` with a daily cron entry for `/api/internal/jobs/sweep-followups`.
- Added GET support for the sweep endpoint so Vercel Cron can invoke it, while preserving the existing POST path.
- Documented `CRON_SECRET`, `INTERNAL_JOB_TOKEN`, and `FOLLOW_UP_STALE_HOURS` in `web/.env.example`.
- Added a Vercel-style bearer-token GET test for the sweep route.

### Verified
- `npm run verify` (27 files, 106 tests, 1 skipped) passes.

## [2026-06-01] - BACKEND-20 appointment REST API

### Added
- Added API-key guarded `GET/POST /api/appointments` and `PATCH/DELETE /api/appointments/[id]` routes.
- Added appointment validation/service helpers for business-scoped list/create/update/delete behavior and owner audit events.
- Added route tests for auth, range filtering/ordering, profile-linked create, patch audit, unknown IDs, and delete audit.

### Verified
- `npm run verify` (27 files, 105 tests, 1 skipped) passes.

## [2026-06-01] - SMS provider wiring tests

### Changed
- `/api/messages` now uses the selected `smsProvider` instead of the always-sandbox provider, so real-provider mode can reach the Twilio-backed provider when flags and credentials are configured.
- Owner-approved SMS records now use truthful status handling: `sent` only after `networkCallsMade=true`, `queued` for log-only/sandbox sends, and `failed` when the provider throws.

### Added
- Added tests for SMS provider selection, including `BUSINESS_PHONE` as the Twilio from-number fallback.
- Expanded owner-send route tests to cover queued, sent, and failed outcomes with fake providers.

### Verified
- `npm run verify` (25 files, 97 tests, 1 skipped) passes.

## [2026-06-01] - Shared quote price helper

### Added
- Added `quotePriceLabel()` in business settings so saved quote ranges can be formatted from one backend helper instead of duplicate owner-side matching code.
- Covered exact match, substring fallback, flat pricing, range pricing, thousands separators, and no-match behavior with unit tests.

### Verified
- `npm run verify` (25 files, 92 tests, 1 skipped) passes.

## [2026-06-01] - Truthful missed-call auto-text status

### Fixed
- Missed-call auto-text records now report `sent` only when the SMS provider says a real network call was made, stay `queued` for sandbox/log-only providers, and move to `failed` when provider sending throws.
- Updated voice intake tests to cover sandbox queued, real provider sent, and provider failure paths.

### Verified
- `npm run verify` (24 files, 88 tests, 1 skipped) passes.

## [2026-06-01] - Owner-facing hover rundown on the callback lists

### Added
- Hovering a lead row (Callbacks + Today) shows an **owner-facing rundown** card: the AI summary,
  what they want, the quote (from saved ranges), and when they asked — the same facts the suggested
  reply uses, framed for the owner. Falls back to the voicemail snippet when there's no AI data.
- `buildLeadRundown` helper builds the rundown from the lead's most recent AI-extracted call.

### Verified
- `npm run verify` (24 files, 87 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Keep the quote/time chips visible in the bottom composer

### Changed
- Reverted the chip-collapsing from the streamline pass: the services / quote / "offer these times"
  chips are **always visible** again in the composer (no toggle). The composer stays positioned at the
  bottom in the conversation area (the only change the owner actually wanted). One compose box, full
  controls visible.

### Verified
- `npm run verify` (24 files, 87 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Streamline lead page to one compose box

### Changed
- Merged the two compose areas into **one**: the suggested-reply composer now lives at the bottom of
  the conversation as the single reply box — the auto-drafted message sits right in the "type box",
  editable, with one **Send**. Removed the separate plain reply form.
- The quote/time chips are tucked behind a **"⚙ Quote & times"** toggle (collapsed by default), so the
  default view is just the suggested message + Send/Copy. AI-reading status moved to the header.
- The box clears after a successful send, ready for a fresh reply.

### Verified
- `npm run verify` (24 files, 87 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Trim env booleans

### Fixed
- `readBoolean` now trims the env value, so a pasted `"true "` / `"true\n"` (e.g. from a hosting
  dashboard) no longer silently reads as false. Affects all boolean flags incl.
  `SMS_SENDING_ENABLED` / `REAL_MESSAGE_SENDING_ENABLED`.

## [2026-06-01] - Unified conversation thread + in-app sending + texting status

### Changed
- The lead page is now **one conversation thread**: every voicemail (with transcript) and every text
  interleaved oldest→newest, messaging-style. Dropped the separate hero + "Earlier activity" split.
- **Sending now goes through the app/server**, not the phone's SMS app. The composer's button is now
  **"Send text"** (calls `sendOwnerText` → records + delivers via Twilio when enabled) instead of an
  `sms:` link that did nothing on desktop. The bottom reply box already sent server-side.
- Outbound messages are now labeled **"You"** vs **"Auto-reply"** (by provider id) with delivery
  status (sent / not sent yet / failed).

### Added
- A **texting-status banner** on each lead derived from live config: shows "Texting is live" or
  lists exactly what's missing (`Twilio keys` / `REAL_MESSAGE_SENDING_ENABLED` / `SMS_SENDING_ENABLED`)
  so the env config is visible in-app.

### Verified
- `npm run verify` (24 files, 87 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Snappy delete + Quote header in calendar notes

### Fixed
- **Deleting an appointment froze the UI (~1.8s INP)**: replaced the blocking `window.confirm` with
  an inline two-tap confirm, and moved delete ownership to `CalendarViews` so the popup closes
  instantly while the server action + revalidation run in the background.

### Added
- Booking from a lead now prepends a **"Quote: $X–$Y" header** to the appointment notes (derived
  from the service + saved quote ranges), so the price rides onto the calendar. Notes render with
  line breaks in the popup + hover card so the Quote sits on its own line.

### Verified
- `npm run verify` (24 files, 87 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Real outbound SMS (Twilio) wired in

### Added
- `TwilioSmsProvider` (real outbound SMS via Twilio's Messages API) + unit tests.
- `selectSmsProvider()` in the runtime: uses Twilio when `twilioConfigured` + `REAL_MESSAGE_SENDING_ENABLED`
  and creds are present, otherwise the sandbox (logged-only) provider. Exposed on the runtime as
  `smsProvider` and passed to the voice-intake auto-text path.
- "Log a reply" (`sendOwnerText`) now actually delivers via the provider when `SMS_SENDING_ENABLED`
  is on, and flags the message as failed if Twilio rejects it.

### Notes
- Inbound replies were already handled (`/api/webhooks/twilio/sms` → `SmsIntakeService`).
- Going live needs (operator): an SMS-capable Twilio number, A2P 10DLC or toll-free verification,
  the number's Messaging webhook pointed at `/api/webhooks/twilio/sms`, and env
  `SMS_SENDING_ENABLED=true` + `REAL_MESSAGE_SENDING_ENABLED=true`. On a trial account, sending works
  to verified numbers (with a trial prefix) for testing.

### Verified
- `npm run verify` (24 files, 87 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Calendar hover preview + delete; booking notes from the voicemail

### Added
- **Hover preview** on week-view events (desktop): a fixed-position card with date/time, status,
  price, address (clickable **Maps ↗**), notes, and customer — positioned so the scroll container
  doesn't clip it and you can move in to click the link.
- **Delete appointments**: `AppointmentRepository.delete()` (in-memory + Supabase) + a
  `deleteAppointment` action + a 🗑 Delete button (with confirm) in the detail popup.
- Booking from a lead now **pre-fills the appointment notes** from the voicemail summary/transcript
  (condition + vehicle), so calendar events carry context instead of starting blank.

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Calendar event details/edit + quote range reordering

### Added
- **Calendar event interaction**: clicking an event opens a detail popup (date/time, status, derived
  price, address with an "Open in Maps ↗" link, notes, customer) with Edit / Open lead / Call
  actions; double-clicking (or the Edit button) opens an inline edit form that saves via a new
  `updateAppointment` server action (title, service, start, length, status, address, notes). Works in
  Week and Agenda views.
- Appointment **price** is derived from the saved quote ranges; **address** + **notes** use the
  existing `location`/`notes` columns (no migration). The quick-book form now accepts service,
  address, and notes too.
- **Reorder quote ranges**: up/down controls on each row in Settings; the saved order is what shows
  everywhere (composer chips, price list).

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Reply acknowledges out-of-hours requests

### Added
- `describeOutsideHours()` in the composer: when the caller asked for a day/time outside business
  hours (e.g. "Sunday or after six"), the suggested reply now names it gracefully — "We don't
  usually do Sundays or evenings, but I'd love to make it work — here's what I have open: …" — instead
  of silently offering weekday slots. A matching ⚠ note appears by the time chips so the owner sees
  the clash and can make an exception.

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - AI-driven service matching in the reply composer

### Added
- `recommendServicesFromTranscript()` (provider layer): given a voicemail transcript + the business's
  exact service menu, asks the configured model (Anthropic/OpenAI) which menu item(s) apply — judging
  severity ("super messy" → full detail), damage ("blood/feathers/spills" → stain removal), and
  vehicle. Returns only names that exist in the menu.
- `suggestServicesWithAI` server action that selects the configured provider/key and calls it.
- ReplyComposer now runs this automatically when a lead opens (once per open, survives the 10s soft
  refresh), overriding the keyword guess with the AI's picks; the chips show "✨ picked by AI".
  Falls back to the keyword matcher when AI is off or errors.

### Fixed
- Keyword fallback no longer treats "exterior" (as in "exterior damage") as a *light* cue, adds
  severity words ("messy/filthy/trashed…" → full), and maps real-world mess synonyms
  (blood/feathers/spill/mud/vomit → stain-removal; fur/shedding/pet → pet-hair service).

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Lead page: voicemail transcript as the centerpiece

### Changed
- The actual voicemail transcript is now the hero element near the top of the lead page (large,
  quoted), since the caller's real words matter most. The "When" the caller asked for rides along as
  a small pill.
- Removed the redundant "Quick summary" card (name duplicated the header, "wants" duplicated the
  composer chips, the sentence duplicated the transcript) and the standalone callback-task bar (the
  "Mark callback done" button already conveys it).
- The bottom "Timeline" is now "Earlier activity" and excludes the hero voicemail, so a single-
  voicemail lead no longer shows the same words twice; the section hides entirely when empty.

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Interactive reply composer (services + quote + times)

### Added
- `ReplyComposer` replaces the static `SuggestedReply` on the lead page. Shows the whole flow in
  one place: **service chips** (pre-ticked from the voicemail) → a **live quote** from the saved
  price settings → **open time slots** to offer → the assembled, editable message. Toggling any chip
  rebuilds the draft; hand-edits are preserved until the next toggle.
- **Smart service pre-selection**: vehicle (sedan/SUV/midsize, incl. make/RAV4/truck synonyms) + tier
  (full/light) detection, plus specialty keyword matching (dog hair, stains), so "full detail SUV"
  quotes the SUV price and "dog hair + stains" pre-checks both add-ons. Owner adjusts with one tap.
- **Multi-service quotes**: selecting several services sums the ranges ("…about $X–$Y altogether").
  Flat-rate services render as a single price, not "$25–$25".
- **Pricing-inquiry handling**: when the voicemail is a general price question (no specific service),
  an "+ Add full price list" toggle drops the rundown straight from the quote settings.
- **Requested-timeframe biasing**: "next week" starts the offered slots next week instead of tomorrow.

### Removed
- `SuggestedReply.tsx` (superseded by `ReplyComposer`).

### Notes
- Ghost/hold blocks for offered times (overbooking prevention) are the planned fast-follow; slot
  computation already skips real booked appointments.

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Read/unread + "Responded" status on the triage lists

### Added
- **Read/unread** on Today's "Needs attention" and the Callbacks tab: a lead shows an unread dot +
  bold name until opened, and re-flags when newer activity arrives. Tracked per-device in
  localStorage (`leadRead.ts`) — no DB column, instant. Marked read on open (`MarkLeadRead` on the
  lead page + on row click).
- **"Responded" pill**: tapping Call back / Text now records the reach-out (`ContactButtons` →
  `markContacted` action promotes a new lead to `contacted`), and logging a reply does the same, so
  the dashboards show a green "Responded" badge. The lead stays in the list (it's keyed off the open
  callback task) until the callback is marked done.
- Shared `LeadList` client component powering both triage lists (one place for the read/unread +
  pill logic); "Replied — waiting on you" recoloured to amber so it's distinct from "Responded".

### Changed
- Today + Callbacks render through `LeadList`; the Callbacks tab drops the sandbox "auto-reply not
  sent" line (noise until texting is live) in favour of the clearer Responded/Replied cues.

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Simulator: run real AI extraction on voicemail-only tests

### Changed
- `simulateLead` now has two modes. **Realistic** (no service field typed): creates the voicemail
  record without a transcript and calls `voiceIntakeService.handleRecording({ transcript })`, so the
  SAME AI extraction the live pipeline uses parses the transcript (caller name / service / timing).
  **Manual** (service typed): sets `extracted_json` directly for a deterministic scenario, as before.
- Simulator page reworked around the voicemail as the primary input; name/service/when demoted to
  optional overrides, with copy explaining each mode. Added an AI-status banner
  (`hasConfiguredExtractionProvider`) so it's clear whether voicemail-only tests will parse.

### Verified
- `npm run verify` (23 files, 84 tests, 1 skipped) and `next build` pass.

## [2026-06-01] - Lead simulator (owner-side test tool)

### Added
- **Simulator page** (`web/src/app/owner/simulator/page.tsx`): spawns a pretend missed-call lead so
  the quote / suggested-reply tool can be tested across scenarios without juggling real phone
  numbers. A service-name datalist is seeded from the configured quote ranges so it's obvious which
  inputs trigger a price range.
- `simulateLead` server action (`web/src/app/owner/actions.ts`): generates a **unique** valid US
  number per submit (so every test lead is a distinct customer, not piled onto one), upserts the
  profile, creates a voicemail call record with `extracted_json` (caller_name / service_requested /
  requested_datetime / summary) + `ai_summary`, opens a callback task, then redirects to the new
  lead. Mirrors the shapes the real voice-intake pipeline produces.
- `SIMULATOR_ENABLED` config flag (default **on**) gating the action + nav links, so the tool can be
  hidden from client deployments by setting it to `false`.
- Simulator links in the owner sidebar footer + mobile top bar (shown only when enabled).

### Notes
- Works against live Supabase data (unlike the sandbox-only `/api/dev/*` console, which 404s in
  production), so simulated leads appear in the real owner UI exactly like genuine ones.
- Cleanup for now is manual: open a test lead and set its status to **Lost**. A bulk "clear test
  leads" action can come later (repos have no delete yet).

### Verified
- `npm run verify` passes (23 test files, 1 Supabase contract test skipped) and `next build` passes
  with the new `/owner/simulator` route.

## [2026-06-01] - Owner Settings screen + full brand theming + settings-driven replies

### Added
- **Settings screen** (`web/src/app/owner/settings/page.tsx`): the first self-serve customization
  surface, so the product can be tailored per client/niche. Sections: brand color (live color
  picker), missed-call auto-text wording (with `{business_name}` placeholder), business hours
  (open/close + working-day checkboxes), and quote ranges (service → low/high price).
- `QuoteRangesEditor.tsx`: a small client island for adding/removing service price ranges; rows
  submit as parallel `quote_service` / `quote_low` / `quote_high` form fields.
- `saveSettings` server action (`web/src/app/owner/actions.ts`): validates the brand hex, parses the
  parallel quote-range arrays + day checkboxes into a `BusinessSettingsUpdate`, persists via
  `businessRepository.updateSettings`, and revalidates the owner routes.
- `--brand-strong-rgb` and `--positive-rgb` design tokens so every accent (AI card gradient, chat
  bubbles, task bar, "replied" pills) is driven by tokens, not literals.

### Changed
- **Owner layout is now an async server component** that reads the saved brand color and injects
  `--brand` / `--brand-rgb` onto the owner shell — so a client's chosen color re-skins the whole
  app. Adds a Settings gear in the sidebar footer + mobile top bar; branding (logo letter + name)
  now comes from the business record. `dynamic = "force-dynamic"`, `runtime = "nodejs"`.
- **Migrated every per-screen button/accent color to tokens** across the 6 owner screens
  (`#5b5bd6`→`var(--brand)`, `#1f9d6b`→`var(--positive)`, `#7c3aed`→`var(--brand-strong)`, and the
  matching `rgba(...)` tints → `rgba(var(--*-rgb), …)`). Same default values, so no visual change
  until a brand color is set — but now the whole UI re-skins from one setting.
- **Suggested Reply is now settings-driven**: open-slot computation respects the configured working
  days + open/close hours, and when the caller's requested service matches a configured quote range
  the draft folds in the real price range (e.g. "Most full detail jobs run $150–$300."). No more
  hardcoded slot hours; no fabricated prices.

### Verified
- `npm run verify` passes: 84 tests passing, 1 Supabase contract test skipped.
- `next build` passes: all 18 routes compile, including the new `/owner/settings`.

## [2026-06-01] - BACKEND-21 follow-up sweep job

### Added
- `POST /api/internal/jobs/sweep-followups`, protected by `INTERNAL_JOB_TOKEN`, for cron-style stale lead sweeps.
- `sweepFollowUps()` job logic that finds `new` / `contacted` profiles older than `FOLLOW_UP_STALE_HOURS` with no recent owner SMS, status-change audit, or completed task.
- Idempotent daily `follow_up` task creation with `task.follow_up.created` audit events; owner reminders only, no customer messages.
- Tests covering token enforcement, stale vs fresh/owner-touched profiles, and same-day duplicate prevention.

### Changed
- `web/.env.example` documents `INTERNAL_JOB_TOKEN` and `FOLLOW_UP_STALE_HOURS`.
- `TASKS.md` marks BACKEND-21 complete and leaves only BACKEND-20 optional REST endpoints pending in this block.

### Verified
- `npm run verify` passes: 84 tests passing, 1 Supabase contract test skipped.

## [2026-06-01] - Backend: per-business settings store

### Added
- Typed `BusinessSettings` helpers for `businesses.settings_json`, including brand color, auto-text message, business hours, and quote ranges with safe defaults.
- `BusinessRepository.updateSettings()` for in-memory and Supabase repositories, merging partial settings into the existing JSON without touching bootstrap name/phone/timezone updates.
- Tests for in-memory settings merge/read behavior, bootstrap preserving settings, Supabase repository settings round-trip, and missed-call auto-text using the configured settings message.

### Changed
- Missed-call auto-text now reads the canonical `auto_text_message` setting while keeping the existing default and legacy `missed_call_auto_text` fallback.

### Verified
- `npm run verify` passes: 82 tests passing, 1 Supabase contract test skipped.

## [2026-06-01] - Theming foundation: brand design tokens

### Added
- Brand design tokens in `styles.css` `:root` (`--brand`, `--brand-strong`, `--brand-rgb`,
  `--positive`) and applied them to the owner chrome (sidebar logo gradient + active-nav tint).
  Same values as before, so no visual change — this is the hook that lets the app be re-skinned
  per client by overriding a few variables.

### Notes
- First step toward client customization. Next: migrate the per-screen button/accent colors to the
  same tokens, then drive `--brand` from a saved per-business brand color once the settings store
  exists (Codex). Full customization (color, quote ranges, hours, auto-text wording) needs that store.

## [2026-06-01] - Lead detail: calendar-aware Suggested Reply

### Added
- `web/src/app/owner/SuggestedReply.tsx`: a "✨ Suggested reply" card on each lead that drafts a
  friendly response offering **real open time slots computed from the calendar** (skips slots that
  conflict with existing appointments). Editable textarea + one-tap **Send as text** (`sms:` with the
  body) and **Copy**. Turns a missed call into a near-instant, calendar-aware reply.
- Lead detail now fetches appointments and passes the busy list to the card.

### Notes
- Frontend only (computes slots browser-side = business tz; no backend/AI call). Quote ranges are
  deferred until a pricing setting exists (no fabricated prices). Fully-automatic send is deferred
  until live texting (Twilio sending) is enabled. `npm run verify` + `next build` pass.

## [2026-06-01] - Appointments: duration dropdown

### Added
- A **Duration** dropdown (30 min / 1 / 1.5 / 2 / 3 / 4 hours) on both booking forms — the Schedule
  page and the lead's "📅 Book". `createAppointment` now computes `scheduled_end_at` from the chosen
  duration, so week-view blocks size correctly and the agenda shows the time range.

### Notes
- Frontend + the existing `createAppointment` action; default duration 1 hour. `tsc --noEmit` clean.

## [2026-06-01] - Schedule: full Week / Month / Agenda calendar

### Added
- `web/src/app/owner/CalendarViews.tsx`: a client calendar with **Week**, **Month**, and **Agenda**
  views + prev/next/Today navigation.
  - **Week**: hourly time axis on the Y (7 AM–9 PM); appointment blocks positioned by start time and
    sized by duration, in the correct day column; horizontally scrollable on mobile; today highlighted.
  - **Month**: standard 6-week grid with event chips per day; tapping a day jumps to that week.
  - **Agenda**: upcoming list grouped by day with inline status updates.
  - Events colored by status; clicking an event with a customer opens that lead.
- `web/src/app/owner/calendar/page.tsx` now builds the event list and renders `<CalendarViews>` above
  the existing booking form.

### Notes
- Calendar date math runs in the browser's local timezone (which equals the business timezone for the
  owner). Frontend only. `npm run verify` + `next build` both pass.

## [2026-06-01] - Appointments + Schedule calendar (full feature, solo)

Built the whole appointments feature end-to-end while Codex was unavailable (repository + UI),
following the existing repo/provider patterns. Covers most of BACKEND-20 (see its STATUS note in
TASKS.md) — only the optional REST `/api/appointments` endpoints remain.

### Added
- `web/src/server/intake/appointments.ts`: `AppointmentRepository` interface + `InMemoryAppointmentRepository`
  (mirrors tasks/messages). `SupabaseAppointmentRepository` added to `supabaseRepositories.ts` + the
  `IntakeRepositories` factory; `appointmentRepository` wired into `getIntakeRuntime()` (both modes).
- `createAppointment` + `setAppointmentStatus` server actions in `owner/actions.ts`, including a
  DST-aware `datetime-local` (business-tz wall clock) → UTC conversion (no date library).
- **Schedule** screen `web/src/app/owner/calendar/page.tsx`: upcoming appointments grouped by day
  (business tz), a "book an appointment" form, and per-item status. Added "📅 Schedule" to OwnerNav.
- Lead detail: a "📅 Book" form that pre-fills the customer + AI-extracted service.

### Verified
- `npm run verify` green (typecheck + 80 tests, 1 skipped). Round-tripped the appointments table on
  live Supabase (insert/read/delete) — persistence confirmed.

### Notes
- web/ only; no archive/ changes. Owner UI uses server actions (no REST needed). When Codex returns,
  BACKEND-20's repository is already done — only the optional REST endpoints remain.

## [2026-06-01] - Owner GUI: Today metric cards are now clickable

### Changed
- `web/src/app/owner/today/page.tsx`: the four Today metric cards are now links —
  Callbacks waiting + Replied → `/owner` (Callbacks list), Voicemails + Calls today →
  `/owner/leads` (Leads directory). Card styled as a link (no underline) so it reads the same.

### Notes
- Frontend only. Routes to the two existing list screens; dedicated voicemails-only / calls-today
  filtered views can come as a follow-up.

## [2026-06-01] - Owner GUI: one-tap Call/Text + copy cleanup

### Added
- Lead detail: prominent **📞 Call back** (`tel:`) and **💬 Text** (`sms:`) buttons that open the
  owner's phone dialer/messages for the customer's number — the fastest way to respond, and works
  today (no Twilio sending needed).

### Changed
- Reworded the lead-detail footer to explain the in-app "Log a reply" box vs. tapping Call/Text;
  renamed its input to "Log a reply…". Replaced the stale "sandbox, in-memory / GET /api/profiles"
  footer on the Callbacks list with "Updates automatically as new calls and texts come in."

### Notes
- Frontend only. The remaining "owner app features" (Settings: auto-text wording + hours; and the
  calendar/appointments view) need backend work (Codex) and are queued.

## [2026-06-01] - Owner GUI: Leads directory (searchable, all leads)

### Added
- `web/src/app/owner/leads/page.tsx` + `web/src/app/owner/LeadDirectory.tsx`: a new **Leads** tab —
  a searchable directory of *every* lead (Callbacks only shows open callbacks). Client-side search
  by name or phone number + status filter chips (All / New / Contacted / Booked / Won / Lost), each
  row linking to the lead detail. Sorted most-recently-heard first; times in the business timezone.
- Added "Leads" to `OwnerNav` (sidebar + bottom tab bar) with active-tab highlighting.

### Notes
- Frontend only; reads existing profile data. No backend/contract changes. Part of the "owner app
  features" phase (Settings + calendar/appointments still to come, those need backend work).

## [2026-06-01] - Retire the Sandbox Console; lock the dev endpoints

### Changed
- Removed the clickable Sandbox Console simulator (the system is now exercised with real calls).
  `/` (`web/src/app/page.tsx`) redirects to the owner dashboard (`/owner/today`).
- Stripped the "Sandbox Console" / "Console" / "Simulate" links from the owner layout and the
  Callbacks/Today screens, and reworded the empty states (no more simulator references).

### Security
- `GET /api/dev/state` and `POST /api/dev/reset` now require the API key (`X-API-Key`) in addition
  to sandbox mode — the in-memory state dump is no longer publicly reachable.

### Notes
- The Twilio webhook routes the console used to drive are unchanged (now hit by real Twilio
  traffic). Frontend + dev-route guard only; `npm run verify` green (80 passed, 1 skipped).

## [2026-06-01] - Backend: OpenAI voicemail extraction provider

### Added
- `OpenAIExtractionProvider` for voicemail interpretation through OpenAI chat completions, defaulting to `gpt-4o-mini` and returning the existing caller/date/service/summary shape.
- Runtime extraction-provider selection via `EXTRACTION_PROVIDER=openai|anthropic`, with Anthropic still preferred when no provider is specified and both keys are present.
- Tests for OpenAI JSON parsing/request shape and runtime provider selection, including the AI-disabled sandbox fallback.

### Changed
- `web/.env.example` documents `EXTRACTION_PROVIDER` and `OPENAI_EXTRACTION_MODEL` so transcription and voicemail interpretation can both run on OpenAI.

### Verified
- `npm run verify` passes: 80 tests passing, 1 Supabase contract test skipped.

## [2026-06-01] - Backend: fast voicemail transcription from recording-ready callback

### Added
- `OpenAITranscriptionProvider` behind `FAST_TRANSCRIPTION_ENABLED=true` and `OPENAI_API_KEY`, using the OpenAI audio transcription endpoint with `gpt-4o-mini-transcribe` by default.
- Recording-ready callbacks can now fast-transcribe Twilio recording audio, store the transcript, and immediately trigger the existing AI voicemail extraction path.
- Tests for fast transcription success, disabled behavior, provider failure safety, and TwiML with/without Twilio's slow transcription fallback.

### Changed
- Voicemail `<Record>` TwiML omits Twilio `transcribe="true"` / `transcribeCallback` when fast transcription is enabled, while keeping `recordingStatusCallback` as the fast path.
- Twilio transcription callbacks now only fill the transcript when it is still empty, so a later Twilio callback does not overwrite a good fast transcript.
- Profile detail timeline call items now include `ai_summary` and `extracted_json`, matching the owner UI's backend contract.
- `web/.env.example` documents `FAST_TRANSCRIPTION_ENABLED` and `OPENAI_TRANSCRIPTION_MODEL`.

### Verified
- `npm run verify` passes: 76 tests passing, 1 Supabase contract test skipped.

## [2026-06-01] - Owner GUI: AI quick-summary card + "Transcribing…" state

### Added
- `web/src/app/owner/[id]/page.tsx`: a "✨ Quick summary" card at the top of the lead that
  surfaces the AI-extracted **name / wants / when** + one-line summary (from the most recent
  call's `ai_summary` + `extracted_json`), labeled "AI · double-check". Sourced from the full
  call rows since the read-API timeline projects a smaller shape.
- "⏳ Transcribing voicemail…" state in the timeline for a voicemail that has a recording but
  no transcript yet — so the brief gap before the transcript lands reads as intentional
  instead of looking empty.

### Notes
- Frontend only; no backend/contract changes. The AI-extracted caller name already shows in
  the Callbacks/Today lists via `display_name`. Pairs with the pending fast-transcription
  backend change (once that lands, the "Transcribing…" gap shrinks to a couple seconds).

## [2026-06-01] - BACKEND-23 AI voicemail understanding

### Added
- `web/src/server/providers/extraction.ts`: optional Anthropic-backed voicemail extraction provider plus JSON parsing helpers.
- `ExtractionProvider` interface and sandbox extraction provider alongside the existing sandbox provider set.
- Voicemail transcript extraction in `VoiceIntakeService.handleRecording()` when `AI_EXTRACTION_ENABLED=true` and `ANTHROPIC_API_KEY` is present.
- Extracted voicemail suggestions are stored in `call_records.extracted_json`, with a one-line `ai_summary`, `needs_review=true`, and a `voicemail.ai_extracted` audit event.

### Changed
- Empty customer profile names are filled from `caller_name` suggestions; owner-entered names are not overwritten.
- `web/.env.example` documents `AI_EXTRACTION_ENABLED`, `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL`.

### Notes
- Default behavior remains AI-free: when the flag is off or the key is absent, extraction is skipped and no network call is made.
- Extraction failures are caught and logged without failing the recording webhook or call flow.

## [2026-06-01] - Backend: show voicemail recording before transcript callback

### Changed
- `web/src/server/providers/sandbox.ts`: voicemail `<Record>` TwiML now includes a `recordingStatusCallback` for the `completed` event in addition to the transcription callback.
- `web/src/app/api/webhooks/twilio/recording`: now handles both callback phases idempotently: recording-ready updates `call_type=voicemail`, `recording_url`, and review state; transcription-ready fills `transcript` later while preserving the recording.
- `web/src/app/api/webhooks/twilio/recording-callback`: converted the older route into a legacy alias for the real recording handler so old Twilio/tunnel configs still work without keeping a placeholder endpoint.

### Verified
- Added tests for recording-ready then transcription-ready callback ordering, signed recording callbacks, unsigned callback rejection, and TwiML callback attributes.

## [2026-06-01] - Owner GUI: timezone (ET) + timeline order (newest at bottom)

### Changed
- `web/src/app/owner/[id]/page.tsx`: all timestamps now render in the business timezone
  (`business.timezone`, default `America/New_York`) instead of the server's UTC. The lead timeline is
  now ordered **oldest → newest** so the newest call/message sits at the bottom, like a text thread.
- `web/src/app/owner/today/page.tsx`: the greeting, date, and "Calls today" count are all computed in
  the business timezone (via `Intl.DateTimeFormat` with `timeZone`), so they're correct regardless of
  where the server runs (Vercel is UTC).

### Notes
- Frontend only; no backend/contract changes. Resolves the "show times in EST" and "newest messages
  at the bottom" requests.

## [2026-06-01] - Owner GUI: live auto-refresh (no manual reload)

### Added
- `web/src/app/owner/AutoRefresh.tsx`: a client island that calls `router.refresh()` every 10s (and
  when the tab regains focus) so new calls, voicemails, and replies appear on the owner screens
  without a manual browser refresh. Uses RSC refresh (no full reload), so scroll position is kept.
- Wired into `web/src/app/owner/layout.tsx` (covers all `/owner/*` screens); sidebar footer now shows
  "● Live · updates automatically".

### Notes
- Resolves the "I had to refresh to see the call" report. A voicemail lands in two stages — the call
  arrives first, then Twilio's recording/transcription callback upgrades it to a voicemail a few
  seconds later; auto-refresh now surfaces that second stage on its own. The voicemail capture flow
  itself is working (verified live: the test call recorded `recording_url` + transcript).

## [2026-06-01] - Owner GUI: mobile-responsive shell (sidebar + bottom tab bar)

### Added
- `web/src/app/owner/OwnerNav.tsx`: a small client nav island that highlights the active screen
  (via `usePathname`); shared by the desktop sidebar and the mobile bottom tab bar.

### Changed
- `web/src/app/owner/layout.tsx`: the owner shell is now responsive. **Desktop** keeps the graphite
  left sidebar; **mobile** (≤768px) switches to a slim sticky top bar + a fixed bottom tab bar
  (thumb-friendly, native-app style) since the owner uses this on a phone in the field. Active tab is
  highlighted on both.
- `web/src/app/styles.css`: added the `owner-*` shell classes + a `@media (max-width:768px)`
  breakpoint (sidebar hidden on mobile, top/tab bars shown, content padded for the fixed bar,
  iOS safe-area inset handled).

### Verified
- `npm run build` passes. Booted a memory-mode dev server and confirmed `/owner`, `/owner/today`, and
  `/owner/[id]` return 200 with the responsive structure present and active-tab highlighting working;
  a seeded lead renders on the detail page. (Memory mode — the real Supabase was not touched.)

## [2026-06-01] - Repo cleanup: archive retired prototypes into archive/

### Changed
- Moved retired prototypes/old versions out of the active tree into a single `archive/` folder.
  Nothing was deleted — all files remain in git history and on disk:
  - `dashboard/` → `archive/dashboard-winforms/` (frozen C# WinForms owner-dashboard prototype)
  - `legacy/` → `archive/legacy/` (retired Python/FastAPI backend scaffold)
  - root `.env.example` → `archive/env.example.python` (sqlite/`APP_ENV`-era template; the live one
    is `web/.env.example`)
  - local-only `dist/` (the 118 MB `BusinessDashboard.exe` build) → `archive/dashboard-dist/`
    (git-ignored; never committed)
- `.gitignore`: repointed the .NET / Python build-artifact ignore rules to the new `archive/` paths.
- Added `archive/README.md` documenting that the folder is reference-only and how to recover a file.
- Updated forward-looking path references in `AI_RULES.md`, `TASKS.md`, and `USER_MANUAL.md`
  (historical changelog and completed-task entries left unchanged).

### Notes
- Top level is now `web/` (the live product) + `archive/` + the active docs. No `web/` source or
  runtime behavior changed; no app rebuild required.

## [2026-06-01] - BACKEND-22 observability and deployment readiness

### Added
- Deep `/api/health` payload for persistence mode, Supabase connectivity status, sandbox provider modes, safety flags, and integration configuration without exposing secrets.
- Structured JSON request logging for API and Twilio webhook routes with request id, route, outcome, business id, and provider call/message ids.
- Lightweight optional Sentry-compatible error capture behind `SENTRY_DSN`; unset remains a no-op.
- `web/DEPLOY.md` with Vercel root-directory setup, Supabase migration guidance, Twilio webhook URLs, local tunnel flow, and safe environment variable checklist.

### Changed
- Twilio signature validation now builds the signed URL from `PUBLIC_BASE_URL` / `APP_BASE_URL` and forwarded headers so Vercel/proxy deployments can validate production signatures.
- `web/.env.example` documents `PUBLIC_BASE_URL` and `SENTRY_DSN`.
- `TASKS.md` marks BACKEND-22 complete while leaving BACKEND-20/21 explicitly pending.

### Verified
- `npm run verify` passes: TypeScript typecheck plus 67 passing Vitest tests and 1 skipped Supabase contract test.
- `npm run build` passes for the Next.js production build.
- Added tests for deep health payloads, proxied Twilio signature validation, and structured webhook logs.

## [2026-05-31] - Fix: type Supabase repo factory by interface (strict typecheck)

### Fixed
- `web/src/server/db/supabaseRepositories.ts`: `createSupabaseRepositories()` returned the concrete
  Supabase classes, which only expose the 1-arg `findByProviderCallId` / `findByProviderMessageId`
  overloads publicly. The new contract test calls the 2-arg form (valid on the repository
  *interface*), so `tsc --noEmit` failed with TS2554. Annotated the factory's return as the
  repository interfaces (`IntakeRepositories`) so callers see the full overload surface.

### Notes
- `vitest` and `next build` both passed already because esbuild/SWC strip types and `next build`
  doesn't type-check `*.test.ts`. Only the strict `tsc --noEmit` caught it — same gap as the earlier
  `bootstrap.test.ts` fix. `tsc --noEmit` now clean; 64 tests pass, 1 Supabase contract test skipped
  without DB env.

## [2026-05-31] - BACKEND-19 Supabase persistence mode

### Added
- `PERSISTENCE=memory|supabase` runtime switch inside `getIntakeRuntime()`, with `memory` still the default for local demo and offline tests.
- Server-only Supabase client setup using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, plus Supabase-backed business, customer profile, call record, message, task, and audit repositories behind the existing interfaces.
- `web/supabase/migrations/0001_init.sql`: idempotent schema for businesses, customer profiles, call records, messages, tasks, appointments, quote drafts, and audit events.
- `web/PERSISTENCE.md` and `web/.env.example` documentation for enabling Supabase persistence safely.
- Supabase repository contract test that is skipped unless Supabase env vars are configured, plus an always-on test confirming the in-memory path remains DB-free and resettable.

### Changed
- `TASKS.md`: replaced stale Python-era BACKEND-19→22 entries with the current web-track persistence, appointments, follow-up, and observability roadmap.
- `web/src/server/db/schema.ts`: extended typed Supabase table metadata and added `QuoteDraftRow`/`quote_drafts`.

### Notes
- Default behavior remains in-memory and sandbox-only. Supabase mode fails fast if service-role env is missing.
- No real SMS/calls, Twilio REST calls, AI, payments, dashboard changes, legacy backend changes, or secrets were implemented.

## [2026-05-31] - Fix: share intake runtime via globalThis (cross-route mutations)

### Fixed
- `web/src/server/intake/runtime.ts`: the in-memory runtime was cached in a module-scoped `let`,
  which Next.js dev duplicates per bundle — so a mutation made by one route (a webhook, or an owner
  action button) could be invisible to another route's read. Cached it on `globalThis` instead, so
  every route handler, server component, and server action shares ONE instance per process. Same
  exports and behavior; `resetIntakeRuntimeForTests()` clears the global.

### Verified
- Booted the dev server and replayed the real flow over HTTP: seeded a missed-call-with-voicemail
  through `/api/webhooks/twilio/*`, then read it back on `/owner` and `/api/dev/state` (different
  bundles) — the lead, call, and task all appeared. Then exercised the three owner server actions:
  status `new`→`booked`, task `open`→`done`, and an outbound text recorded as `queued`
  (`SMS_SENDING_ENABLED=false`). All reflected on re-read.

## [2026-05-31] - Web owner dashboard: action buttons (status, mark done, text back)

### Added
- `web/src/app/owner/actions.ts`: three sandbox server actions — `setProfileStatus`,
  `markCallbackDone`, and `sendOwnerText` — that mutate the same in-memory runtime the owner
  screens read, then `revalidatePath` so the UI refreshes. No API key needed in the browser; the
  real app will call the guarded `/api/*` endpoints once auth + Supabase persistence land.

### Changed
- `web/src/app/owner/[id]/page.tsx`: the Lead detail screen is now interactive, not just a viewer —
  a status dropdown (`new/contacted/booked/won/lost`), a "✓ Mark callback done" button shown when an
  open task exists, and a "Send text" compose box under the timeline. Honors `SMS_SENDING_ENABLED`
  (records `queued` in sandbox, no delivery).

### Fixed
- `web/src/server/business/bootstrap.test.ts`: `getBusinessSeedFromEnv({})` failed `tsc --noEmit`
  because Next's `NodeJS.ProcessEnv` requires `NODE_ENV`; cast to `{} as NodeJS.ProcessEnv`. Tests
  still ran (Vitest strips types) — this only un-reds the strict typecheck.

### Notes
- Sandbox/in-memory only; no `dashboard/`, intake, Twilio, or production changes. Mutations are lost
  on server restart until Supabase persistence lands.

## [2026-05-31] - BACKEND-18 owner-approved outbound SMS API

### Added
- `POST /api/messages`: API-key guarded owner action endpoint for sending/queuing a text to a known customer profile.
- `web/src/server/messages/outbound.ts`: validation and send orchestration that scopes profiles to the seeded business, honors `SMS_SENDING_ENABLED`, records outbound SMS messages, updates `last_contact_at`, and writes owner audit events.
- Tests covering disabled-SMS queueing with no provider call, enabled sandbox-provider sends, unknown profile 404s, auth rejection, and empty-body validation.

### Notes
- This endpoint is owner-triggered only; no webhook or automatic caller path invokes it.
- With `SMS_SENDING_ENABLED=false`, messages are recorded as `queued` and no provider send is attempted. With the flag enabled, the current sandbox provider only logs and makes no network calls.
- No real SMS/Twilio REST calls, calls, AI, payments, dashboard changes, legacy backend changes, or production secrets were implemented.

## [2026-05-31] - Web owner dashboard: app shell + Today overview

### Added
- `web/src/app/owner/layout.tsx`: a premium **app shell** (graphite sidebar with Today / Callbacks
  nav + brand block + link back to the Sandbox Console) wrapping all `/owner/*` screens, matching
  the WinForms dashboard look.
- `web/src/app/owner/today/page.tsx`: the **Today** overview — time-aware greeting, a row of metric
  cards (callbacks waiting, replied-waiting, voicemails, calls today) derived from the read-API
  builder, and a "Needs attention" preview of the top callbacks linking to lead detail.

### Changed
- `web/src/app/page.tsx`: Sandbox Console "Open owner view →" now lands on `/owner/today`.

### Notes
- Server components reading the in-memory sandbox runtime; the existing Callbacks list (`/owner`) and
  Lead detail (`/owner/[id]`) now inherit the sidebar shell. Sandbox-only; no backend/intake or
  `dashboard/` changes.

## [2026-05-31] - BACKEND-17 owner tasks API

### Added
- `GET /api/tasks`: API-key guarded task list endpoint for the seeded business, defaulting to open tasks and sorting by due date then creation date.
- `PATCH /api/tasks/[id]`: API-key guarded owner update endpoint for marking tasks `done`/`dismissed` or rescheduling `due_at`.
- `web/src/server/tasks/api.ts`: task read/update helper with payload validation, business scoping, and `task.update` owner audit events.
- Tests covering auth rejection, open-list ordering, unknown task 404s, invalid fields/values, task completion leaving the open queue, and audit logging.

### Notes
- Existing `completed` task status remains typed for compatibility; BACKEND-17 owner completion stores the requested `done` status.
- No real SMS/calls, Twilio REST calls, AI, payments, dashboard changes, legacy backend changes, or production secrets were implemented.

## [2026-05-31] - BACKEND-16 owner profile edits

### Added
- `PATCH /api/profiles/[id]`: API-key guarded owner edit endpoint for `display_name`, `status`, `notes`, `email`, and address fields.
- `web/src/server/profiles/update.ts`: validation/update helper that rejects unknown fields, scopes edits to the seeded business, and writes owner audit events with before/after diffs.
- Tests covering auth rejection, unknown profile 404, unknown field rejection, persisted edits, and `profile.update` audit logging.

### Notes
- Edits are sandbox/in-memory for now; Supabase persistence is still a later task.
- No task API work, real SMS/calls, Twilio REST calls, AI, payments, dashboard changes, or production secrets were implemented.

## [2026-05-31] - Fix: configure business phone via env (webhook "not configured" 404)

### Fixed
- The voice webhook returned 404 "This business number is not configured" because the business
  phone was only set at request time by the dev console's data loader — and Next.js dev does not
  reliably share that in-memory runtime singleton across separate route handlers, so the webhook
  routes booted with no business phone.
- Documented the fix in `web/BACKEND_README.md`: create a git-ignored `web/.env.local` with a valid
  `BUSINESS_PHONE` (and `OWNER_PHONE`) so `bootstrapSingleTenantBusiness` configures the business
  consistently in every route's runtime from startup. (A matching local `.env.local` was created on
  the dev machine.)

### Notes
- Sandbox-only/config; no application code or `dashboard/` changes. `.env.local` is git-ignored.

## [2026-05-31] - Sandbox Console: validate caller number before simulating

### Changed
- `web/src/app/page.tsx`: the caller field is now validated/normalized with `libphonenumber-js`
  before any simulate action. A loosely-typed valid number ("404 642 3435") is normalized to E.164;
  an invalid one (e.g. a number missing the country code) shows a friendly inline hint instead of
  firing a webhook that 500s on phone normalization. Valid numbers are sent as E.164.

### Notes
- Fixes the "/api/webhooks/twilio/voice → 500" seen when typing an invalid number like `+4046423435`
  (missing the `+1`). Sandbox-only UI change; no backend/intake logic or `dashboard/` changes.

## [2026-05-31] - Fix: Sandbox Console 500 (invalid 555 demo phone numbers)

### Fixed
- The Sandbox Console showed "state 500" and created no leads because every demo phone number used
  a `555` prefix, which `normalizePhoneNumber` rejects as invalid (it throws `PhoneNormalizationError`).
  Setting the business phone to a 555 number threw inside `GET /api/dev/state`, and 555 caller
  numbers would have failed the webhooks too.
- `web/src/app/api/dev/state/route.ts`: use valid NANP defaults (business `+14157654321`,
  owner `+13104567890`); wrap the phone-ensure and whole handler in try/catch so it returns the
  real error message instead of a blank 500.
- `web/src/app/page.tsx`: default caller is now a valid number (`+12128675309`); `postForm` now
  throws with the response body on a non-OK webhook so failures surface in the console banner
  instead of silently doing nothing.
- `web/BACKEND_README.md`: replaced the invalid `+1555…` example numbers with valid ones.

### Notes
- Sandbox-only; no intake logic, schema, real SMS/calls, or `dashboard/` changes.

## [2026-05-31] - Owner screens (web/) built on the read API

### Added
- `web/src/app/owner/page.tsx`: the **Callbacks** screen (OWNER_UX screen 1). Lists leads with an
  open callback task — name/phone, call outcome / voicemail snippet, auto-reply state, and a
  "Replied — waiting on you" badge (replied float to top). Each row links to the lead detail.
- `web/src/app/owner/[id]/page.tsx`: the **Lead detail** screen (OWNER_UX screen 2). Profile header,
  open callback task, and a merged reverse-chronological call + voicemail + SMS timeline (voicemail
  transcript with "may contain errors" when needs_review; auto-reply shown with true sent/queued state).

### Changed
- `web/src/app/page.tsx`: Sandbox Console header gained an "Open owner view →" link to `/owner`.

### Notes
- Server components reuse Codex's read-API builders (`buildCallbackProfileList`, `buildProfileDetail`)
  directly against the in-memory sandbox runtime, so the screens match `GET /api/profiles` and
  `GET /api/profiles/{id}` exactly with no API-key friction in local preview.
- Sandbox/in-memory; additive; no intake logic, schema, real SMS/calls, or `dashboard/` changes.
- These are the real owner UI (per web/OWNER_UX.md); when Supabase + auth land they switch to the
  HTTP read API with persistent data.

## [2026-05-31] - BACKEND-15 profile detail read API

### Added
- `web/src/app/api/profiles/[id]/route.ts`: API-key guarded profile detail endpoint returning `profile`, merged timeline, open callback task, empty appointment/quote arrays, and structured `customer_replied`.
- `web/src/server/profiles/detail.ts`: read model that builds the reverse-chronological call/message timeline and scopes profile lookup to the seeded business.
- Tests covering auth rejection, unknown/cross-business 404s, queued auto-text preservation, merged timeline ordering, and server-derived `customer_replied`.

### Changed
- `web/src/server/profiles/callbacks.ts`: exported the shared customer-reply derivation helper so list and detail APIs use the same rule.

### Notes
- `appointments` and `quote_drafts` return empty arrays until their in-memory repositories/write APIs exist in later tasks.
- No Supabase persistence, Twilio REST calls, SMS sending, outbound calls, AI, payments, dashboard changes, or production secrets were implemented.

## [2026-05-31] - BACKEND-14 callback profiles read API

### Added
- `web/src/app/api/profiles/route.ts`: API-key guarded `GET /api/profiles` returning the OWNER_UX callback-list contract.
- `web/src/server/profiles/callbacks.ts`: server-side read model for open callback profiles, call outcome, voicemail snippets, auto-reply status, and customer reply derivation.
- Tests covering API-key rejection, exact list fields, `queued` auto-reply preservation, server-derived `customer_replied`, open-task filtering, and replied-first ordering.

### Changed
- `web/src/server/intake/messages.ts`: message fixtures can now set `created_at`, keeping read-model tests aligned with the `customer_replied` contract.

### Notes
- `customer_replied` is computed from inbound message `created_at` versus the latest missed/voicemail call `started_at`; task notes are not used.
- No BACKEND-15 detail route, Supabase persistence, Twilio REST calls, SMS sending, outbound calls, AI, payments, dashboard changes, or production secrets were implemented.

## [2026-05-31] - BACKEND-13 webhook idempotency and dedupe

### Added
- `web/src/app/api/webhooks/twilio/idempotency.test.ts`: route-level retry coverage for repeated voice, dial-status, recording, and SMS webhooks.
- Message repository lookup/update helpers for provider-message dedupe.

### Changed
- Incoming voice webhooks now update an existing call record by `business_id + provider_call_id` instead of creating duplicates.
- Missed dial-status retries now reuse the existing callback task and missed-call auto-text record instead of duplicating rows or re-running side effects.
- Inbound SMS webhooks now update the existing message row by `business_id + provider_message_id`.

### Notes
- Recording webhooks continue to update the existing call record in place.
- No read API, Supabase persistence, Twilio REST calls, SMS sending, outbound calls, AI, payments, dashboard changes, or BACKEND-14+ work was implemented.

## [2026-05-31] - Plain-English owner's manual

### Added
- `USER_MANUAL.md`: a non-technical guide for the founder — what the product is, how the pieces
  fit (Twilio / backend / Supabase / owner app / frozen Windows demo), what's done vs not, how to
  open and stop the clickable demo (incl. the PowerShell execution-policy fix), who does what
  (you / Claude / Codex / ChatGPT), a glossary of every term, a map of the repo folders, and a
  what's-next cheat sheet.

### Notes
- Documentation only; no code changed.

## [2026-05-31] - Clickable Sandbox Console (web/) for the missed-call pipeline

### Added
- `web/src/app/page.tsx`: replaced the placeholder home page with a **Sandbox Console** — a
  clickable tester that drives the real Twilio webhook routes (form-encoded POSTs) and renders
  the resulting leads as the `OWNER_UX.md` contract describes (outcome, auto-reply state,
  Replied badge, merged call+voicemail+SMS timeline, callback task). Buttons: missed call +
  voicemail, missed call (no voicemail), customer texts back, answered call, reset.
- `web/src/app/api/dev/state/route.ts`: dev/sandbox-only `GET` returning current in-memory intake
  state (business, profiles, calls, messages, tasks); 404 when `SANDBOX_MODE` is off. Also gives
  the seeded business sandbox default phones so the console works zero-config.
- `web/src/app/api/dev/reset/route.ts`: dev/sandbox-only `POST` to clear in-memory state.

### Changed
- `web/BACKEND_README.md`: documented the Sandbox Console and the two dev routes.

### Notes
- Sandbox-only and additive; no intake/service logic, schema, or `dashboard/` source changed.
- Derived view fields (outcome, auto_reply_status, customer_replied) are computed client-side here
  as a stopgap; they become the real read-API contract in BACKEND-14/15.
- Auto-texts render as "not sent (sandbox)" while `SMS_SENDING_ENABLED=false` — never shown as sent.

## [2026-05-31] - BACKEND-12 Twilio signature verification

### Added
- `web/src/server/webhooks/twilioSignature.ts`: shared Twilio signature validation using the request URL, sorted webhook params, `X-Twilio-Signature`, and `TWILIO_AUTH_TOKEN`.
- Route-level tests proving the local bypass works, valid signatures pass, tampered signatures fail, and missing signatures are rejected across every `/api/webhooks/twilio/*` route when required.
- `WEBHOOK_SIGNATURE_REQUIRED=false` in root and web environment examples for documented local sandbox bypass.

### Changed
- All Twilio webhook routes now parse the payload once through a verified helper before running placeholder or intake logic.
- `web/BACKEND_README.md`: documented the signature guard, local bypass, and required `TWILIO_AUTH_TOKEN` behavior.

### Notes
- Signature checks are disabled by default for local sandbox testing and can be enabled with `WEBHOOK_SIGNATURE_REQUIRED=true`.
- No Twilio REST API calls, SMS sending, outbound calls, auth expansion, payments, AI, production secrets, dashboard changes, or future backend tasks were implemented.

## [2026-05-31] - Owner UX contract for missed-call pipeline

### Added
- `web/OWNER_UX.md`: spec/contract for the future web/mobile owner experience (one detailer,
  missed-call pipeline only). Defines two screens (Callbacks triage + Lead detail), the minimum
  component kit, state-surfacing rules (auto-reply sent/queued/failed, replied, needs_review),
  microcopy, and the **read-API field contract** the screens require — including structured
  `auto_reply_status`, `customer_replied`, `last_inbound_at`, and a merged call+message timeline.

### Notes
- Spec only — no code changed; `dashboard/` and backend untouched.
- Locks the contract so BACKEND-14/15 (read API) and the future Next.js owner screens build
  against one shape. Key rule recorded: never render a `queued` (undelivered) auto-text as "sent."

## [2026-05-31] - BACKEND-11 inbound SMS threading

### Added
- `web/src/app/api/webhooks/twilio/sms/route.ts`: inbound SMS webhook that threads messages onto customer profiles by normalized phone number.
- `web/src/server/intake/sms.ts`: SMS intake service for business resolution, profile upsert, message storage, last-contact updates, and callback task reply flagging.
- Tests covering new profile creation, repeated-number threading, message storage, last-contact updates, and callback task note flagging.

### Changed
- `web/src/server/intake/tasks.ts`: added task update and open-callback lookup helpers.
- `web/src/server/intake/runtime.ts`: wired SMS intake into the local sandbox runtime.
- `web/BACKEND_README.md`: documented the inbound SMS webhook test command.

### Notes
- The inbound SMS route returns empty TwiML and sends no outbound response. No Twilio SDK, SMS sending, outbound calls, auth expansion, payments, AI, production secrets, or dashboard changes were implemented.

## [2026-05-31] - BACKEND-10 missed-call auto-text

### Added
- `web/src/server/intake/messages.ts`: in-memory outbound message repository for local/sandbox missed-call auto-text records.
- Missed-call auto-text handling in the dial-status flow, with queued messages when `SMS_SENDING_ENABLED=false` and sandbox provider sends when enabled.
- Tests covering SMS flag off, SMS flag on, and provider failure that does not break voicemail/callback flow.

### Changed
- `web/src/server/intake/voice.ts`: missed calls now create an outbound SMS message record and audit auto-text queue/send/failure events.
- `web/src/server/intake/runtime.ts`: wired the sandbox SMS provider and message repository into intake runtime.
- `web/BACKEND_README.md`: documented sandbox auto-text behavior.

### Notes
- SMS remains sandbox-only. No Twilio SDK, real SMS sending, outbound calls, auth expansion, payments, AI, transcription provider, production secrets, or dashboard changes were implemented.

## [2026-05-31] - BACKEND-09 recording and transcription webhook

### Added
- `web/src/app/api/webhooks/twilio/recording/route.ts`: recording/transcription webhook that attaches a recording URL and transcript to the existing call record.
- Tests covering idempotent recording updates at service and route level.

### Changed
- `web/src/server/intake/voice.ts`: added recording handler that marks calls as voicemail and `needs_review`.
- `web/BACKEND_README.md`: documented the recording/transcription webhook test command.

### Notes
- No transcription provider, AI, Twilio REST API calls, SMS sending, outbound calls, production secrets, or dashboard changes were implemented.

## [2026-05-31] - BACKEND-08 dial status and missed-call tasking

### Added
- `web/src/app/api/webhooks/twilio/voice/status/route.ts`: Dial status webhook that marks answered calls, detects missed calls, and returns voicemail Record TwiML.
- `web/src/server/intake/tasks.ts`: in-memory task repository for local/sandbox callback task creation.
- `web/src/server/intake/auditEvents.ts`: in-memory audit event repository for workflow audit entries.
- `web/supabase/migrations/0003_audit_events.sql`: Supabase-ready audit event table required by the missed-call workflow.
- Tests covering completed versus missed dial status behavior and route-level voicemail TwiML.

### Changed
- `web/src/server/intake/voice.ts`: added dial-status handling, callback task creation, and audit event creation.
- `web/src/server/providers/*`: added empty and voicemail-record TwiML builders.
- `web/src/server/db/schema.ts`: added `answered` call type and audit event types.
- `web/BACKEND_README.md`: documented the dial-status webhook.

### Notes
- No Twilio REST API calls, SMS sending, outbound calls, auth expansion, payments, AI, transcription provider, production secrets, or dashboard changes were implemented.

## [2026-05-31] - BACKEND-07 incoming-call voice webhook

### Added
- `web/src/app/api/webhooks/twilio/voice/route.ts`: Twilio voice webhook that resolves the configured business number, upserts the caller profile, creates a provisional inbound missed call record, and returns Dial TwiML to the owner phone.
- `web/src/server/intake/`: voice intake service, local runtime wiring, and in-memory call-record repository for sandbox/local tests.
- `web/src/server/webhooks/twilioForm.ts`: shared Twilio form parser.
- Tests covering the voice intake service and route-level Dial TwiML response.

### Changed
- `web/src/server/providers/types.ts` and `web/src/server/providers/sandbox.ts`: added safe TwiML builder helpers to the call provider interface.
- `web/src/server/business/bootstrap.ts`: added business lookup by normalized business phone.
- `web/BACKEND_README.md`: documented the incoming voice webhook test command.

### Notes
- The route returns TwiML only; it does not call Twilio's REST API, send SMS, place outbound provider calls, use production secrets, or touch the dashboard.
- `CALL_FORWARDING_ENABLED` remains default false; real provider-side call automation is still not connected.

## [2026-05-31] - BACKEND-06 single-tenant bootstrap and API key guard

### Added
- `web/src/server/auth/apiKey.ts`: `X-API-Key` guard for protected owner API routes.
- `web/src/server/business/bootstrap.ts`: single-tenant Business bootstrap from environment variables with an idempotent repository boundary.
- Tests covering protected API access, webhook bypass behavior, and idempotent Business bootstrap.

### Changed
- `web/src/app/api/health/route.ts`: now requires the configured API key and reports new safety flags.
- `.env.example` and `web/.env.example`: added `API_KEY`, single-tenant business bootstrap values, `SMS_SENDING_ENABLED`, and `CALL_FORWARDING_ENABLED`.
- `web/BACKEND_README.md`: documented API-key health testing and new safety flags.

### Notes
- Webhook routes remain unguarded by `X-API-Key` for future Twilio signature validation.
- No dashboard source was modified.
- No Supabase client writes, Twilio integration, SMS sending, outbound calls, auth system, payments, AI, transcription, or production secrets were implemented.

## [2026-05-31] - BACKEND-00 backend track consolidation

### Changed
- `backend/`: archived the redundant Python/FastAPI backend under `legacy/backend-python/` so `web/` is the single active backend source of truth.
- `TASKS.md`: marked the backend track decision as DONE and updated status to BACKEND-00→05 complete.
- `.gitignore`: added ignores for generated Python artifacts under the archived legacy backend path.

### Verified
- `web`: Vitest suite passes.
- `web`: Next.js production build passes.

### Notes
- No dashboard source was modified.
- No Twilio integration, SMS sending, outbound calls, auth, payments, AI, production secrets, or feature work was implemented.

## [2026-05-31] - TASKS.md: granular backend build plan (BACKEND-03→22) + track decision

### Added
- `TASKS.md`: new **Backend Build Tasks** section detailing BACKEND-03 → BACKEND-22 in the repo's
  goal/files/requirements/acceptance/test style, with difficulty estimates. Covers the full
  missed-call → auto-text → voicemail → owner-notify → respond pipeline for one single-tenant
  paying customer. AI tasks (BACKEND-23/24) deliberately deferred until after first customer.

### Changed
- `TASKS.md`: added a **"Backend track decision"** banner. Two backends now exist — `web/`
  (Next.js + Supabase + Vitest, Codex's active track, BACKEND-01→05 done) and `backend/`
  (Python/FastAPI, earlier scaffold, now redundant). Recommendation: **consolidate on `web/`,
  archive `backend/`.** Tasks are written for the `web/` track with a Python→web path/term mapping note.
- `TASKS.md`: marked the old high-level "Codex Tasks" outline as legacy/superseded.

### Notes
- Planning only — no application code changed; `dashboard/` untouched.
- Flagged for the founder: the dual-backend divergence needs an explicit keep/kill decision.



### Added
- `web/src/server/phone/normalize.ts`: E.164 phone normalization helper using `libphonenumber-js`.
- `web/src/server/customerProfiles/repository.ts`: customer profile repository interface plus in-memory test implementation with duplicate prevention.
- `web/src/server/customerProfiles/service.ts`: customer profile upsert service keyed by `business_id + normalized phone`.
- Tests covering phone normalization, duplicate prevention, cross-business separation, and owner-note preservation.

### Changed
- `web/package.json`: added `libphonenumber-js`.
- `web/BACKEND_README.md`: documented phone normalization and customer profile upsert service.

### Notes
- No Twilio integration, real SMS sending, calls, auth, payments, AI, transcription, frontend changes, Supabase client, or production secrets were implemented.

## [2026-05-31] - BACKEND-04 sandbox provider interfaces

### Added
- `web/src/server/providers/types.ts`: interfaces for SMS, call, transcription, and storage providers.
- `web/src/server/providers/sandbox.ts`: sandbox implementations that log actions only and report `networkCallsMade: false`.
- `web/src/server/providers/sandbox.test.ts`: tests proving sandbox SMS/call/transcription/storage actions stay local and do not send or call anything.

### Changed
- `web/BACKEND_README.md`: documented provider interfaces and sandbox implementations.

### Notes
- No Twilio SDK, network provider calls, real SMS sending, outbound calls, auth, payments, AI, transcription service, frontend changes, or production secrets were implemented.

## [2026-05-31] - BACKEND-03 appointment model

### Added
- `web/supabase/migrations/0002_appointments.sql`: Supabase-ready appointment table with business/customer links, schedule fields, status, location, and notes.
- `web/src/server/db/schema.ts`: typed appointment row/insert/update contract.
- `web/src/server/db/schema.test.ts`: coverage that Appointment extends the foundation table set and remains business-scoped.

### Changed
- `web/BACKEND_README.md`: documented Appointment as part of the backend data foundation.

### Notes
- No frontend changes, live Supabase connection, auth, Twilio integration, SMS sending, calls, payments, AI, transcription, or customer messaging were implemented.

## [2026-05-31] - BACKEND-02 database foundation

### Added
- `web/supabase/migrations/0001_backend_foundation.sql`: Supabase-ready foundation schema for businesses, customer profiles, call records, messages, and tasks.
- `web/src/server/db/schema.ts`: typed database contract for the foundation tables.
- `web/src/server/db/schema.test.ts`: Vitest coverage for required table names and customer profile phone-normalization readiness.

### Changed
- `web/package.json`: added a `test` script and Vitest for backend foundation tests.
- `web/BACKEND_README.md`: documented migrations, typed database contracts, and the test command.

### Notes
- No live Supabase connection, auth, Twilio integration, SMS sending, calls, payments, AI, transcription, or frontend dashboard changes were implemented.

## [2026-05-31] - BACKEND-01 web app foundation

### Added
- `web/`: sandbox-first Next.js foundation for the future web/mobile missed-call and lead-intake MVP.
- `web/src/app/api/health/route.ts`: safe health endpoint exposing environment and safety flags without secrets.
- `web/src/app/api/webhooks/twilio/*`: placeholder incoming call, incoming SMS, and recording callback endpoints.
- `web/src/server/webhooks/twilio.ts`: isolated Twilio webhook stub handlers with no business logic, database writes, provider calls, or outbound communication.
- `web/.env.example`: environment examples for Supabase, Twilio, OpenAI, app URL, and safety flags.
- `web/BACKEND_README.md`: local setup, sandbox limitations, endpoint testing, and future work notes.

### Changed
- `.env.example`: added app base URL and future Supabase environment placeholders.

### Notes
- No dashboard source was modified.
- No database schema, Supabase connection, Twilio sending, outbound calls, auth, payments, AI, transcription, or customer messaging was implemented.

## [2026-05-31] - Backend database schema foundation

### Added
- `backend/app/db/`: SQLAlchemy base, session helper, and typed models for Business, CustomerProfile, CallRecord, Message, QuoteDraft, Task, Attachment, and AuditEvent.
- `backend/alembic/`: Alembic migration setup and initial schema migration for the customer intake data model.
- `backend/tests/test_schema.py`: coverage that the first schema metadata exists and can create/link core records in SQLite.

### Changed
- `backend/pyproject.toml`: added SQLAlchemy and Alembic dependencies.
- `backend/README.md`: documented the local migration command.
- `.env.example`: corrected the local SQLite database URL format.

### Notes
- No dashboard source was modified.
- No Twilio, Supabase, auth, payments, AI, customer messaging, or real provider integrations were implemented.

## [2026-05-30] - Backend FastAPI scaffold

### Added
- `backend/`: initial FastAPI backend scaffold outside the Claude-owned dashboard source.
- `backend/app/main.py`: app factory and API router wiring.
- `backend/app/api/health.py`: `/health` endpoint exposing service, version, environment, sandbox mode, and real-automation safety flags.
- `backend/app/core/config.py`: environment-based settings with sandbox/test defaults and real SMS/call automation disabled by default.
- `backend/tests/test_health.py`: pytest coverage for the health endpoint and safety defaults.
- `backend/README.md`: setup, test, run, and health-check commands.

### Changed
- `.gitignore`: added Python backend cache, virtualenv, package metadata, and local data ignores.

### Notes
- No dashboard source was modified.
- No Twilio, Supabase, auth, payments, AI, customer messaging, or real provider integrations were implemented.

## [2026-05-30] - Appointment calendar details and time picker

### Added
- `Database.cs` and `Models.cs`: added a local appointment address field with a safe SQLite column add for existing databases.
- `CalendarMonthView.cs`: appointment chips now show a hover tooltip with customer, date/time, service, phone, address, status, and notes when available.

### Changed
- `FieldDialog.cs`: appointment time now uses an up/down time selector instead of free typing.
- `MainForm.cs`: appointment forms include address, appointment cards include address in their subtitle, and the sidebar logo uses a larger cover-fill image area.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No Twilio, Supabase, auth, payments, AI, customer messaging, or external backend integrations were implemented.

## [2026-05-29] - Premium dialogs and appointment calendar

### Added
- `CalendarMonthView.cs`: added an Outlook-style month calendar control with appointment chips, month navigation, and double-click day selection.
- `CardListPage.cs` and `MainForm.cs`: added Calendar/List view switching on the Appointments page and wired appointment records into the calendar display.
- `FieldDialog.cs`: added real `DateTimePicker` calendar selection for date fields.

### Changed
- `FieldDialog.cs`: refreshed add/edit dialogs with a more rounded bordered shell and softer input styling.
- `MainForm.cs`: Appointment, Message, and Quote date fields now use calendar-backed date pickers.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No Twilio, Supabase, auth, payments, AI, customer messaging, or external backend integrations were implemented.

## [2026-05-29] - Status badge text cleanup

### Fixed
- `EntityCard.cs`: removed the literal trailing `v` from clickable status badges while preserving status menu click behavior.

### Notes
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Persistent brand header layout

### Changed
- `MainForm.cs`: added a persistent centered brand header above the main dashboard content so the business name remains stable across modules.
- `MainForm.cs`: changed the sidebar brand block to focus on a larger logo only, avoiding cramped brand-name text at narrow sidebar widths.
- `CardListPage.cs`: increased page header spacing and title bounds so page names like Messages no longer clip.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Narrow sidebar layout polish

### Changed
- `MainForm.cs`: made the sidebar brand block responsive at minimum width, with a larger logo and company-name-only compact layout.
- `NavItem.cs`: adjusted sidebar nav label and badge spacing so labels like Messages no longer collide or truncate unnecessarily.
- `CardListPage.cs`: gave page headers more vertical space and responsive title/count widths to prevent the Messages count from overlapping the title.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Startup splitter crash fix

### Fixed
- `MainForm.cs`: fixed startup crash caused by applying `SplitContainer` minimum panel sizes before the splitter had a valid width.
- `MainForm.cs`: added safe sidebar splitter clamping so the dashboard can launch and still keep the sidebar resizable.
- `MainForm.cs`: removed unsafe constructor-time `BeginInvoke` and moved initial splitter setup to handle/layout events.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Builder border and interaction polish

### Changed
- `BuilderForm.cs`: added a real outer modal frame so the Customize Dashboard window no longer blends into the background.
- `BuilderForm.cs`: added smoother drag/drop feedback for Modules and Pipeline rows with rounded drop-target highlighting while keeping arrow buttons as fallback.
- `UiKit.cs` and `MainForm.cs`: added a rounded status menu renderer for card status dropdowns.

### Notes
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Builder polish and editable status badges

### Changed
- `BuilderForm.cs`: polished the Customize Dashboard modal with rounded window edges, a rounded content surface, tighter spacing, and drag handles for module and pipeline row reordering while keeping the existing arrow controls as fallback.
- `EntityCard.cs`: made configured status badges clickable and hoverable so dashboard records can open a status menu directly from the card.
- `MainForm.cs`: wired Lead, Appointment, and Quote card status menus to configured `DashboardConfig` pipeline stages and saved selected stage IDs back to the existing local data store.
- `MainForm.cs`: status badge colors now come from configured pipeline stage colors, with `Ui.StatusColor()` kept as a fallback for unknown legacy statuses.
- `MainForm.cs`: fixed a WinForms `ContextMenuStrip` disposal crash after selecting a card status.

### Notes
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Demo readiness polish D3-D6

### Changed
- `BuilderForm.cs`: enabled Reset to Defaults with confirmation, default config save, OK reload path, and graceful error handling.
- `BuilderForm.cs`: removed the Stage ID column from the Pipeline tab while preserving internal stage IDs.
- `BuilderForm.cs`: replaced raw Up/Down/Delete controls in Modules and Pipeline with cleaner compact icon buttons.
- `BuilderForm.cs`: added visible Save & Apply success feedback after a successful config save.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- MigrationRunner, backup logic, export/import, drag-and-drop, theme presets, backend integrations, Twilio, auth, payments, messaging, and AI features were not implemented.

## [2026-05-29] - BUILDER-10 Branding tab

### Added
- `DashboardConfig.cs`: added extended branding fields for tagline, contact info, brand colors, and logo path.
- `BuilderForm.cs`: implemented the Branding tab with identity fields, contact fields, brand color pickers, logo browsing, clearing, and preview.
- `MainForm.cs`: sidebar branding now attempts to render a configured logo and falls back safely when the file is missing or unreadable.

### Changed
- `ConfigManager.cs`: default branding now includes primary and secondary brand colors.
- `BuilderForm.cs`: working-copy cloning now carries all branding fields so Cancel still discards unsaved changes.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- MigrationRunner, backups, Reset to Defaults, theme presets, backend integration, SMS features, and later builder tasks were not implemented.

## [2026-05-29] - D1 Save & Apply persistence fix

### Changed
- `BuilderForm.cs`: wired `Save & Apply` to commit pending edits and save the working-copy `DashboardConfig` through `ConfigManager.Save()`.
- Existing `MainForm` behavior reloads the saved config with `ConfigManager.Load()` after the builder closes with `DialogResult.OK`.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- Reset to Defaults, Branding, backup/migration behavior, backend work, provider integrations, auth, payments, and customer messaging were not implemented.

## [2026-05-29] - Clickable home + contact links + popups actually resize

### Fixed — popups now truly resize
- The borderless popups never received edge hit-tests because the content panel covered the whole form. Exposed a 6px border-colour **`Padding` ring** (`InfoPopupForm`, `FieldDialog`) so the form surface is hittable at the edges — combined with the existing `WndProc` hit-testing, the dialogs now resize from any edge/corner.

### Added — Home page is now fully interactive
- **Metric cards are clickable** → navigate to that tab. `MetricCard` raises `Clicked`; `HomePage.MetricClicked` passes the module id; `MainForm.NavigateTo(id)` selects the matching nav item/page. Cards show a hover lift.
- **Needs-attention cards open on single click.** Lead and appointment attention cards gained `onActivate` (messages already had it) — click any item to view/edit it without leaving Home.
- **Contact line links are usable.** The Home contact line is now a `LinkLabel`: the email opens a `mailto:` and the website opens in the browser (`https://` prepended if missing). Phone stays plain text. `SetIdentity` now takes phone/email/website separately and builds the link regions.

### Notes
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Fix Home greeting band overlap (DPI-safe stacking)

### Fixed — `dashboard/HomePage.cs`
- The greeting title, date/tagline line, and contact line could overlap (worse at higher display scaling) because they used fixed pixel heights while the 21pt title rendered taller. Replaced the absolutely-positioned fixed-height labels with **AutoSize labels in a top-down `FlowLayoutPanel`**, and made the greeting row `AutoSize`. The lines now stack by their natural height + margins and can't overlap at any DPI. Title trimmed 21→20pt.

### Notes
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Resizable dialogs, auto-hide scrollbars, click-to-view quotes

### Added
- **Click a quote to view all its details.** Quote cards gained `onActivate`; `MainForm.OpenQuote(id)` shows a popup with Service, Amount, Phone, Status, and Notes (single-click to view; edit via the ✎ icon — same pattern as messages).
- Generalised the message reader into **`InfoPopupForm`** (title + meta + body), now reused for both messages and quotes. Removed `MessageReaderForm.cs`.

### Changed
- **`FieldDialog` is now resizable** (edge/corner drag, `MinimumSize` 380×300, bottom-right grip). Field inputs widen to fill the dialog as it grows (`ResizeFields`).
- **Scrollbars only show when needed.** The dialog's multiline Notes field and the info popup body now use a `RichTextBox` (`ScrollBars = Vertical`), which auto-hides the scrollbar unless the text actually overflows — fixes the always-visible scrollbar on short content.
- `InfoPopupForm` carries the same resize/grip behaviour as the former message reader.

### Notes
- The big "Customize Dashboard" builder modal is intentionally left fixed-size for now (dense absolute layout); say the word if you want it resizable too.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Calendar: click-to-edit chips + new Week view with time axis

### Added
- **Click a calendar appointment to edit it.** `CalendarItem` now carries the source `Id`; `CalendarMonthView` and the new week view raise `ItemClicked`, which `CardListPage` forwards as `CalendarItemClicked`. `MainForm.OpenAppointment(id)` opens the edit dialog for the clicked chip.
- **New `CalendarWeekView`** (`dashboard/CalendarWeekView.cs`): a 7-day week with an **hourly time axis (7 AM–7 PM)** on the left. Appointment chips are positioned vertically to **correlate with their parsed start time** on the axis, with simple per-day overlap nudging. Prev/next week navigation, today highlight, click-to-edit, and double-click-day-to-add.
- **List / Month / Week toggle** on the Appointments page. `CardListPage` view mode is now a 3-state enum (`List`/`Month`/`Week`) hosting both calendar views; toggles appear when the header is wide enough (≥820px).

### Changed
- Month view hint updated to "Double-click a day to add • click an appointment to edit"; clicking a chip in the month view now edits it.

### Notes
- Time parsing uses `DateTime.TryParse` on the appointment's time string; unparseable times stack at the top of the day column.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Message reader is resizable + taller default

### Changed — `dashboard/MessageReaderForm.cs`
- The reader bubble is now **user-resizable**: added a `WndProc` override that reports edge/corner hit zones (`HTLEFT`/`RIGHT`/`TOP`/`BOTTOM` + corners) so the borderless rounded window can be dragged from any edge. Added a subtle three-dot resize grip in the bottom-right corner.
- Taller, more readable default (min body height 170, up to 420) and a `MinimumSize` of 360×240 so short messages are fully visible without resizing.
- Fully-qualified `System.Windows.Forms.Message` in `WndProc` (this namespace also defines a `Message` model class).

### Notes
- The content text box (`Dock=Fill`) grows with the window, so enlarging the bubble reveals the full message; the rounded region re-applies live during resize.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Live home metrics + message reader + message status dropdown

### Fixed
- **Home metrics were stale** (showed 0 while tabs had data). `MainForm.Select()` now calls `RefreshHome()` whenever Home is opened, so the metric cards always reflect current data. Counts also use a new robust `IsStage()` helper that resolves a stored status to its stage id (handles id-vs-label storage).

### Added
- **Click a message to read it.** `EntityCard` gained an optional `onActivate` (single-click on the card body). Message cards now open a new **`MessageReaderForm`** — a rounded read-only bubble showing sender, channel · date · phone, and the full message text. On close, an unread message is **automatically marked Read** (status → `read`), then the list, sidebar badge, and Home all refresh.
- **Message status dropdown.** Messages are now config-driven like Quotes/Leads: a new `messages` pipeline (Unread / Read / Replied / Archived, with colors) was added to `ConfigManager` defaults. The message status badge is clickable and opens the same rounded status menu as the other tabs; the edit dialog's Status field is config-driven; stored values use stable stage ids.

### Changed
- Sidebar unread badge and Home "Unread messages" metric now detect unread via `IsStage("messages", …, "unread")` instead of an exact `== "Unread"` string match.

### Notes
- Existing saved configs without a `messages` pipeline fall back to defaults automatically (no reset required); resetting also makes Messages editable in the builder's Pipeline tab.
- Home metrics are intentionally "today/actionable" (new leads, unread, pending quotes, appointments *today*) — these may differ from the sidebar's total counts by design.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Fixes: swatch sizing, button ampersand, home overlap + branding surfaced

### Fixed
- **`UiKit.cs` (PillButton):** added `TextFormatFlags.NoPrefix` so `&` renders literally. "Save & Apply" no longer shows as "Save _Apply" (the `&` was being eaten as a Windows mnemonic and underlining the following space).
- **`BuilderForm.cs` (AddThemeRow):** color swatches are now a fixed 72×28 centred via `Anchor.None` instead of `Dock.Fill`. Primary, Secondary, and all Appearance swatches now render pixel-identical regardless of each tab's row height (previously they could differ).
- **`HomePage.cs` (MetricCard):** reworked the metric card layout — value font 23→21, taller value rect, label moved down, card height 96→100 — so the big number no longer clips at the bottom and nothing overlaps the icon chip.

### Added
- **Branding now appears in the app.** `HomePage.SetIdentity(tagline, contact)` surfaces the Tagline next to the date in the greeting band and a combined Phone · Email · Website line beneath it. `MainForm.RefreshHome()` feeds these from `config.Branding`.
  - Full branding visibility map: Business Name → window title + persistent header; Sidebar Subtitle → sidebar; Logo + Primary/Secondary colours → sidebar logo block; Tagline + Phone/Email/Website → Home greeting band.

### Notes
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-16/17 pipeline funnel preview + redesigned empty states

### Changed — `dashboard/CardListPage.cs`
- Replaced the plain centered grey "No X yet" label with a new **`EmptyStatePanel`**: a soft accent icon circle (drawn vector icon), a headline, a subline, and a primary action button wired to the page's Add action. Empty screens now feel intentional instead of abandoned.

### Changed — `dashboard/BuilderForm.cs`
- Added a **`PipelinePreviewStrip`** above the stage editor: the current pipeline rendered as connected colour pills (`New › Contacted › Quoted › Won`) so the owner sees their funnel at a glance.
- `PickStageColor` now re-renders the pipeline tab so the preview strip reflects colour changes immediately (add/delete/reorder already re-rendered).

### Notes
- Both are visual-only; no data, config schema, or behaviour changed.
- Heavy timer-driven motion (UI-14/15) intentionally deferred — it's the one area that risks visible jank without runtime testing, and card/nav hover already repaints responsively.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-10..13 "Today" home page (overview as default landing)

### Added — `dashboard/HomePage.cs`
- New `HomePage` overview screen: time-aware greeting + date band, a row of metric cards, and a "NEEDS ATTENTION" list. Reads **no new data** — populated by `MainForm.RefreshHome()` from existing SQLite tables.
- New `MetricCard` painted control: big value, label, and a soft accent icon chip (same shadow/surface language as `EntityCard`).

### Changed — `dashboard/MainForm.cs`
- Generalised the page/route model from `CardListPage` to `Control` (`_navRoutes`, `Select`, `PageFor`, `NewNav`) so non-list pages can be hosted.
- Added `home` as a first-class module: `KnownModuleIds` now leads with `"home"`; `DefaultModule("home")` added and the other modules' default orders bumped (leads 1, appts 2, messages 3, quotes 4).
- `BuildPages` builds `HomePage` for the `home` module; `PageFor`/`SetNavFor` handle it; `_homePage`/`_navHome` fields added and reset in `RebuildLayout`.
- Added `RefreshHome()`: computes 4 metrics (new leads, unread messages, pending quotes, today's appointments) and builds up to 6 attention cards (new leads + unread messages + today's appointments). Cards reuse `EntityCard`; edit/delete route through existing dialogs + `RefreshAll`.
- `RefreshAll()` now also refreshes Home.

### Changed — `dashboard/ConfigManager.cs`
- `GetDefaults().Modules` includes the Home module at order 0 (others bumped). Existing saved configs without `home` still get it via `GetActiveModules` fallback, so Home appears for everyone and is the default landing screen.

### Notes
- Home is a normal configurable module — it can be renamed, reordered, or disabled in the builder like any other.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-04 card redesign (soft surfaces, status edge, calm rows)

### Changed — `dashboard/EntityCard.cs`
- **Removed the hard border** → replaced with a layered translucent **soft drop shadow** (3 offset rounded rects) + a whisper `Ui.Hairline` outline. Cards now read as surfaces, not spreadsheet cells.
- **Hover lift:** surface changes to `Ui.SurfaceAlt` and the shadow deepens on hover.
- **Status-coloured 3px left edge** added — the card's single source of colour/meaning.
- **Rainbow avatar removed** (folds in UI-05): the monogram chip is now a calm neutral `#EDEFF3` with `Ui.TextBody` initials instead of 1-of-8 saturated hues.
- **Status badge restyled:** soft `Ui.Soft()` fill, a 7px status **dot** before the label, no hard border (start of UI-06).
- **Edit/delete icons hidden until hover** — rows are calm at rest; actions fade in only when hovering the card.
- **Typography:** title bumped to 12pt and recoloured to `Ui.TextStrong`; subtitle stays muted.

### Notes
- Card height and the `Gap`/Dock-Top stacking model are unchanged, so list layout/scroll behaviour is identical.
- Status badge remains click-to-change (`onStatusClick` unchanged); hit-testing is unaffected because hovering is guaranteed before any click.
- Emoji action glyphs (✎ 🗑) are retained for now — a drawn icon set is the separate UI-07 task.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-01 palette rework (calm/premium foundation)

### Changed — `dashboard/UiKit.cs`
- Reworked the `Ui` palette from saturated slate-navy + loud blue to a calm, premium system:
  - **Chrome desaturated to graphite:** `SidebarBg` 24,33,54 → 22,24,29; `SidebarHover`/`SidebarActive` retuned to graphite tints.
  - **Accent → calm indigo:** 56,132,255 → 91,91,214.
  - **Canvas → soft warm-grey:** `ContentBg` 243,245,249 → 246,247,249.
  - **Borders softened:** `CardBorder` 226,231,238 → 236,238,242 (now an alias of new `Hairline`).
  - **Text neutralised:** `TextDark` 28,37,56 → 30,32,38; `TextMuted` 120,132,153 → 138,144,156.
  - **Semantic colours calmed:** Success/Warning/Danger/Info retuned to less-shouty hues (status meaning only).
- Added new tokens (all additive, no existing name removed): `SurfaceAlt`, `Hairline`, `TextStrong`, `TextBody`, and `-Soft` tint variants `AccentSoft`/`SuccessSoft`/`WarningSoft`/`DangerSoft`/`InfoSoft`.
- Added `Ui.Soft(Color, alpha)` helper for translucent badge/chip fills from arbitrary (configured) colours.

### Changed — `dashboard/ConfigManager.cs`
- `GetDefaults().Theme` updated to match the new chrome (`#16181D` sidebar, `#5B5BD6` accent, `#F6F7F9` canvas) so a fresh install / Reset to Defaults reflects the new palette.

### Notes
- First task of the premium-UI redesign roadmap. Palette/token foundation only — no layout, card, or sidebar structure changed yet.
- Cards, text, borders, surfaces, and status colours re-theme immediately.
- Sidebar background + accent are overridden by any *saved* `dashboard.config.json`, so an existing config keeps its current chrome until the owner clicks **Reset to Defaults** (or a fresh config is created).
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Appearance/Branding pickers, resizable sidebar, logo, Codex docs

### Changed — `dashboard/BuilderForm.cs`
- `AddThemeRow`: replaced flat `Button picker` with `ColorSwatchButton swatch` — Appearance and Branding color pickers now use the same rounded custom-painted swatch as Pipeline stages.
- `PickThemeColor`: updated parameter from `Button` to `ColorSwatchButton`; sets `SwatchColor + Invalidate()`.
- `UpdateThemeColor`: updated parameter from `Button` to `ColorSwatchButton`; reads previous color from `ColorToHex(swatch.SwatchColor)`.
- Added file-level architecture comment explaining the builder's tab structure, save flow, and inner control class map (for Codex).

### Changed — `dashboard/MainForm.cs`
- `RebuildLayout()`: replaced `TableLayoutPanel` 2-column fixed layout with `SplitContainer`. Owner can now drag the divider to resize the sidebar. `Panel1MinSize = 180`, `Panel2MinSize = 480`, default split at 232px. Splitter track color matches `Ui.SidebarBg`.
- `BuildSidebar()`: brand block height increased from 78 → 96 px. Logo size increased from 36×36 → 54×54. Logo is vertically centred in the block. Business name now uses `TextFormatFlags.WordBreak` so long names wrap to 2 lines instead of truncating. All text x/width values are computed from `brand.Width` dynamically — adapts when the owner resizes the sidebar. Added `brand.Resize` handler to repaint on width change.
- Added file-level architecture comment explaining layout, config-driven rendering, and pipeline/status helper methods (for Codex).

### Changed — documentation (Codex-targeted)
- `DashboardConfig.cs`: full XML doc comments on every class and property; architecture rules block explaining Id/Label stability contract and schema migration policy.
- `ConfigManager.cs`: file-level comment explaining Load/Save/GetDefaults contract and file locations.
- `Models.cs`: file-level comment explaining status ID storage rule and DB layer boundary.
- `Program.cs`: file-level comment explaining startup order and `--seed` flag.
- `UiKit.cs`: file-level comment explaining mutable colours, StatusColor fallback chain, RoundedRect disposal, and UserPaint pattern.
- `EntityCard.cs`: file-level comment explaining paint-only rendering, statusColor/onStatusClick parameters, and double-click behaviour.
- `CardListPage.cs`: file-level comment explaining config-driven construction, SetCards contract, and empty-state behaviour.

### Notes
- No backend, Twilio, Supabase, auth, payments, or messaging touched.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - GUI visual fixes — corner artifacts, color swatches, pipeline header

### Fixed — `dashboard/BuilderForm.cs`

**Root cause of right-side row artifacts:**
All custom-painted controls (`BuilderDropRow`, `BuilderSurfacePanel`, `ToggleSwitch`) that use `UserPaint` + `AntiAlias` were drawing only inside a rounded path — leaving the 4 corner pixels outside the rounded rect with undefined/dark buffer content. Anti-aliasing then blended the rounded edge against that dark fringe, producing the visible line on the right side of every row.

- `BuilderDropRow.OnPaintBackground`: now flood-fills `ClientRectangle` with white before drawing the rounded card. Removed the `Color.Transparent` border pen (GDI+ artifact risk) — replaced with `Color.FromArgb(18, 0, 0, 0)` at rest (subtle shadow border) and explicit `Pen(Ui.Accent)` on drag-over. Inset rect by 1px so the border renders fully within bounds.
- `BuilderSurfacePanel.OnPaint`: flood-fills `ClientRectangle` with `Ui.ContentBg` before drawing the white rounded card — corners now blend into the surrounding gray correctly.
- `ToggleSwitch.OnPaint`: flood-fills `ClientRectangle` with white before drawing the pill — eliminates corner dark-fringe artifact.

**`move` FlowLayoutPanel transparency:**
- Both `BuildModuleRow` and `BuildStageRow`: changed `move` FlowLayoutPanel `BackColor` from `Color.Transparent` to `Color.White`. `Color.Transparent` on a child of a `UserPaint` parent doesn't reliably show the parent's rendered background, causing subtle compositing artifacts on the right side of rows.

**Pipeline color swatches:**
- Added `ColorSwatchButton` inner class: custom-painted rounded color swatch. Fills full bounds with white first, draws a rounded rect filled with `SwatchColor`, subtle semi-transparent border, and a `✎` pencil glyph on hover to signal it's clickable. Replaces the rectangular `FlatStyle.Flat` system `Button`.
- `BuildStageRow`: replaced `Button` with `ColorSwatchButton`. Updated margin to `(4, 10, 10, 10)` for proper vertical centering.
- `PickStageColor`: updated parameter from `Button` to `ColorSwatchButton`; sets `swatch.SwatchColor` and `Invalidate()` instead of `BackColor`.

**Pipeline header "Remove" → "Del":**
- `BuildPipelineHeader`: changed column 4 header from `"Remove"` to `"Del"` — was being truncated to "Remov" at the column width.
- `AddPipelineColumns`: widened Color column (78→72), narrowed Del column (70→52) — Del is shorter text, Color swatch no longer needs full width button.

### Notes
- No architecture changes. `DashboardConfig` unchanged. No backend, Twilio, Supabase, auth, or messaging touched.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - GUI premium polish — toggles, styled inputs

### Added — `dashboard/BuilderForm.cs`
- `ToggleSwitch` inner class: fully custom-painted pill-style on/off toggle. Replaces `CheckBox` in every module row. On state = Accent blue with white knob right; Off state = gray with white knob left. Hover darkens/lightens the track slightly.
- `StyledInputPanel` inner class: wraps a borderless `TextBox` inside a custom-painted rounded panel. On focus, border turns `Ui.Accent` (1.8 px); at rest, `Ui.CardBorder` (1 px). Inner TextBox is vertically centered in the panel. Click anywhere on the panel to focus the input.

### Changed — `dashboard/BuilderForm.cs`
- `BuildModuleRow`: replaced `CheckBox` with `ToggleSwitch`; replaced both `TextBox` name/add-button fields with `StyledInputPanel`. Event handlers attach to `StyledInputPanel.Inner` (the raw `TextBox`), so all save/validation logic is unchanged.
- `BuildStageRow`: replaced stage-label `TextBox` with `StyledInputPanel`.
- `AddBrandingTextRow`: replaced `TextBox` with `StyledInputPanel` — all Identity and Contact fields in the Branding tab now use the styled input.
- `AddThemeRow`: replaced hex `TextBox` with `StyledInputPanel` — Appearance and Brand Color hex fields now use the styled input.
- `BuildModuleHeader`: "Add button" → "Button label" column header.

### Notes
- No architecture changes. `DashboardConfig` is unchanged. No backend, Twilio, Supabase, auth, payments, or messaging was touched.
- Build confirmed clean: 0 C# warnings, 0 C# errors.

## [2026-05-29] - GUI polish pass

### Changed
- `dashboard/FieldDialog.cs`:
  - Added `using System.Drawing.Drawing2D`.
  - Added `ModalRadius = 12` and `ModalBorderColor = Color.FromArgb(132, 146, 170)` constants.
  - Added `ApplyRoundedRegion()` method; called in constructor after `ClientSize` is set and in `OnResize` override.
  - Updated `OnPaint` to draw a 2 px anti-aliased rounded border (replaces the old flat `CardBorder` rectangle). Add/edit dialogs now match the `BuilderForm` modal visual style.

- `dashboard/BuilderForm.cs`:
  - `BuildHeader`: changed close button `Text = "X"` to `Text = "✕"` to match `FieldDialog`.
  - `SaveAndApply`: removed the success `MessageBox.Show(...)` — the dashboard re-rendering immediately after close is the confirmation; errors still show a `MessageBox`.
  - `BuilderTabButton`: expanded from a simple `Active` auto-property to a full interactive control:
    - `Active` setter now calls `UpdateBackColor()` and `Invalidate()`.
    - Added `_hover` field, `OnMouseEnter`, `OnMouseLeave` overrides.
    - Added `UpdateBackColor()`: active → white background; hover → light accent tint `(231, 238, 252)`; default → `Ui.ContentBg`.
    - Updated `OnPaint` to adjust `ForeColor` across active/hover/default states (darker text on hover, `Ui.TextDark` when active).

### Notes
- No architecture changes. `DashboardConfig` remains the source of truth. No backend, Twilio, Supabase, auth, payments, or messaging was touched.
- Build confirmed clean: 0 C# warnings, 0 C# errors.
- The running app must be closed before `dotnet run` picks up the new exe (file was locked during build verification — expected).

## [2026-05-29] - Save/Load Reliability Tasks added

### Added
- `TASKS.md`: new **Save/Load Reliability Tasks** section with 6 Codex-ready tasks (SAVE-01 through SAVE-06).

### Task summary

| ID | Task | Files affected |
|---|---|---|
| SAVE-01 | Add `MigrationRunner` with `CurrentSchemaVersion = 1`; wire version extraction into `ConfigManager.Load()` | `ConfigManager.cs`, new `MigrationRunner.cs` |
| SAVE-02 | Backup current config to `.backup.json` before every save | `ConfigManager.cs` |
| SAVE-03 | Extend `Load()` with three-level fallback: main → backup → defaults | `ConfigManager.cs` |
| SAVE-04 | Fix critical bug: call `ConfigManager.Save(_workingConfig)` in `BuilderForm` Save & Apply | `BuilderForm.cs` |
| SAVE-05 | Enable Reset to Defaults button; confirmation → save defaults → reload | `BuilderForm.cs` |
| SAVE-06 | Create `dashboard/SMOKE_TESTS.md` with full manual end-to-end checklist | New `SMOKE_TESTS.md` |

### Notes
- No code was changed. Planning pass only.
- SAVE-04 is the highest-priority fix: the builder currently discards all changes on save.
- Correct implementation order: SAVE-01 → SAVE-02 → SAVE-03 → SAVE-04 → SAVE-05 → SAVE-06.
- SAVE-02 must exist before SAVE-05 so Reset to Defaults automatically backs up before overwriting.

## [2026-05-29] - BUILDER-09 Appearance tab editor

### Added
- `BuilderForm.cs`: implemented the Appearance tab against the working-copy `DashboardConfig`.
- `BuilderForm.cs`: added hex text boxes and color picker buttons for accent color, sidebar background, and content background.

### Notes
- Appearance tab edits are in-memory only and are not persisted yet.
- The current `DashboardConfig.Theme` model only supports accent, sidebar background, and content background, so card color, text color, radius, spacing, and theme mode were not added.
- Branding editing, save/apply persistence, drag-and-drop, backend changes, provider integrations, auth, payments, and message sending were not implemented.

## [2026-05-29] - BUILDER-08 Pipeline tab editor

### Added
- `BuilderForm.cs`: implemented the Pipeline tab against the working-copy `DashboardConfig`.
- `BuilderForm.cs`: added pipeline selection, stage order display, stage ID display, editable stage labels, color picker buttons, and up/down stage reordering.
- `BuilderForm.cs`: added in-memory add/delete stage controls from the BUILDER-08 task.

### Notes
- Pipeline tab edits are in-memory only and are not persisted yet.
- Existing dashboard status dropdowns continue to use `DashboardConfig` pipeline stages.
- Card badge color routing still uses the existing `Ui.StatusColor()` behavior and should be handled in a future task if stage colors need to render on dashboard cards.
- Save/load, drag-and-drop, appearance editing, branding editing, backend changes, provider integrations, auth, payments, and message sending were not implemented.

## [2026-05-29] - BUILDER-07 Modules tab working copy

### Added
- `BuilderForm.cs`: added a cloned working-copy `DashboardConfig` so builder edits do not mutate the live dashboard config.
- `BuilderForm.cs`: implemented the Modules tab with module order, enabled toggle, editable module name, editable add-button label, and up/down reorder controls.
- `BuilderForm.cs`: added named panels for Modules, Pipeline, Appearance, and Branding tabs.

### Notes
- Module tab edits are in-memory only and are not persisted yet.
- Save/load, drag-and-drop, pipeline editing, appearance editing, branding editing, validation-on-save, backend changes, provider integrations, auth, payments, and message sending were not implemented.

## [2026-05-29] - BUILDER-05/06 Customize entry point and builder shell

### Added
- `MainForm.cs`: added a sidebar `Customize` entry point that opens the dashboard builder dialog.
- `BuilderForm.cs`: added a modal shell with header, Modules/Pipeline/Appearance/Branding tab selectors, empty content panels, and footer controls.

### Notes
- `Save & Apply` closes the shell with `DialogResult.OK`; `MainForm` then reloads the existing local config and reapplies it.
- `Reset to Defaults` is present but disabled because reset/save behavior is deferred to later builder tasks.
- No tab content, module editing, pipeline editing, appearance editing, branding editing, database changes, backend changes, provider integrations, auth, payments, or message sending.

## [2026-05-29] - BUILDER-04 config-driven status dropdowns

### Changed
- `MainForm.cs`: Lead, Appointment, and Quote status dropdowns now use pipeline stages from `DashboardConfig`.
- Status values saved from those dialogs now prefer stable stage IDs instead of display labels.
- Cards and edit dialogs map stored stage IDs back to current configured labels for display.

### Notes
- Added centralized helpers for pipeline stage lookup, label display, label-to-ID conversion, and ID-to-label compatibility.
- Existing records that stored old labels such as `Won`, `Scheduled`, or `Pending` continue to display through compatibility mapping.
- No builder form, customize entry point, backend changes, provider integrations, auth, payments, or message sending.

## [2026-05-29] - BUILDER-03 config wired into dashboard startup

### Changed
- `Program.cs`: loads the local dashboard config and passes it into `MainForm`.
- `MainForm.cs`: applies branding, theme colors, module labels/icons/enabled flags/order, and page add-button labels from the loaded config.
- `UiKit.cs`: allows configured theme colors for sidebar background, accent, and content background with invalid-color fallback.

### Notes
- Added `MainForm.ApplyConfig(DashboardConfig config)` for re-applying config to an open window.
- No pipeline/status dropdown storage changes, builder form, customize entry point, backend changes, provider integrations, auth, payments, or message sending.

## [2026-05-29] - BUILDER-02 ConfigManager added

### Added
- `dashboard/ConfigManager.cs` with `Load()`, `Save(DashboardConfig config)`, and `GetDefaults()`.
- Local mock config path: `%LOCALAPPDATA%\BusinessDashboard\dashboard.config.json`.
- Default dashboard config matching the current app modules, branding, theme colors, and pipeline stages.

### Notes
- Uses `System.Text.Json` only; no third-party packages.
- Saves through a temp file before replacing the config file.
- No UI wiring, backend changes, provider integrations, auth, payments, or message sending.

## [2026-05-29] - BUILDER-01 DashboardConfig model added

### Added
- `dashboard/DashboardConfig.cs` with strongly typed dashboard builder config model classes:
  - `DashboardConfig`
  - `BrandingConfig`
  - `ThemeConfig`
  - `ModuleConfig`
  - `PipelineConfig`
  - `StageConfig`

### Notes
- Model classes only; no file I/O, save/load logic, UI changes, backend changes, or provider integrations.

## [2026-05-29] - Dashboard Builder tasks revised and expanded

### Changed
- `TASKS.md` — Dashboard Builder Tasks section replaced with 12 granular, ID-tagged tasks (BUILDER-01 through BUILDER-12).
  - Previous tasks were too broad for Codex to implement directly.
  - New tasks are atomic, ordered, and each has a named target file, clear inputs/outputs, and acceptance criteria.
  - No Twilio, no database connections, no auth, no customer messages — mock/local config only throughout.

### Task summary
| ID | Task |
|---|---|
| BUILDER-01 | Create `DashboardConfig.cs` model classes |
| BUILDER-02 | Create `ConfigManager.cs` (load/save/defaults) |
| BUILDER-03 | Wire config into `MainForm` startup + `ApplyConfig()` method |
| BUILDER-04 | Wire pipeline stages into `FieldDialog` status dropdowns |
| BUILDER-05 | Add `⚙ Customize` entry point to sidebar |
| BUILDER-06 | Create `BuilderForm.cs` shell (tabs, header, footer, reset) |
| BUILDER-07 | Implement Modules tab (toggle, rename, reorder, add-label) |
| BUILDER-08 | Implement Pipeline tab (stage editor, color picker, add/delete/reorder) |
| BUILDER-09 | Implement Appearance tab (three theme color pickers) |
| BUILDER-10 | Implement Branding tab (business name, subtitle) |
| BUILDER-11 | Implement Save & Apply with validation and sidebar confirmation |
| BUILDER-12 | Add `SeedConfig()` to `SampleData.cs`, wire to `--seed` flag |

### Notes
- No code was changed. Planning pass only.
- First Codex task: BUILDER-01 (`DashboardConfig.cs` — model classes only, no logic).

## [2026-05-29] - Product direction clarified

### Changed
- `AI_RULES.md`: reframed the project as small-business automation software with call/message intake creating dashboard profiles.
- `SPEC.md`: replaced the narrow missed-call assistant MVP with a broader backend/call-intake automation spec, data model draft, API contract, and phased implementation plan.
- `TASKS.md`: added Codex backend tasks and Claude-owned dashboard responsibilities.
- `.env.example`: added sandbox-first backend, provider, transcription, AI extraction, storage, and safety flag placeholders.

### Notes
- Codex should avoid `dashboard/` GUI source unless explicitly asked; Claude owns dashboard GUI work.
- Real SMS sending and outbound calling remain disabled by default.

## [2026-05-29] — Dashboard source added

### Added
- `dashboard/` folder: full C# .NET 10 WinForms source for the Business Hub owner dashboard.
  - `BusinessDashboard.csproj` — project file, targets net10.0-windows, depends on Microsoft.Data.Sqlite
  - `Program.cs` — entry point; supports `--seed` flag for demo data
  - `Models.cs` — Lead, Quote, Message, Appointment data classes
  - `Database.cs` — SQLite CRUD (stores to `%LOCALAPPDATA%\BusinessDashboard\data.db`)
  - `MainForm.cs` — main window; sidebar nav + 4 section pages
  - `CardListPage.cs` — reusable section page (header, search, scrollable card list)
  - `EntityCard.cs` — painted row card with avatar, status badge, edit/delete icons
  - `NavItem.cs` — painted sidebar nav item with count badge
  - `FieldDialog.cs` — reusable add/edit dialog built from a field definition list
  - `UiKit.cs` — color palette, PillButton, SearchBox, drawing helpers
  - `SampleData.cs` — dev seed data (triggered with `--seed` flag)
- `.gitignore` updated: added C# rules (`dashboard/bin/`, `dashboard/obj/`, `*.user`, `*.pdb`, `crash.log`)

## [2026-05-29] — SPEC written
### Added
- SPEC.md (v1.0): Complete MVP specification written from scratch.
  - Defined 5 core workflows: missed call (no VM), missed call + voicemail, photo upload, callback reminder, follow-up tracking.
  - Specified Lead, Photo, Message, and Reminder data models.
  - Described all dashboard screens: Lead List, Lead Detail, Settings.
  - Documented SMS copy library for all auto-text and reminder messages.
  - Defined Claude AI summary prompt and output format.
  - Listed recommended tech stack (Node/Python, PostgreSQL, Twilio, Whisper, Claude API, S3, React).
  - Established MVP in-scope / out-of-scope boundaries.
  - Added key constraints aligned with AI_RULES.md (no customer app, no hardcoded secrets, sandbox mode default).
