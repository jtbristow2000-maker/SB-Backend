# SPEC.md — AI Missed-Call & Quote Assistant (MVP)

**Version:** 1.0  
**Date:** 2026-05-29  
**Status:** Draft

---

## 1. Product Overview

A lightweight AI-powered assistant that captures every missed call for local service businesses. When the owner misses a call, the system automatically transcribes any voicemail, generates an AI lead summary, texts the customer back, and creates a trackable lead in a simple dashboard — all without the customer needing an app or account.

**Target users:** Auto detailers, pressure washers, landscapers, window cleaners, painters, junk removal operators, mobile mechanics, and similar owner-operated service businesses.

**Core promise:** You never lose a lead to a missed call again.

---

## 2. Goals & Non-Goals

### Goals (MVP)
- Capture every inbound missed call as a lead
- Transcribe voicemails automatically
- Generate a plain-English AI summary of what the caller needs
- Auto-text the caller within seconds of the missed call
- Let callers upload job photos via a one-time web link (no app, no login)
- Give the owner a simple dashboard: leads, voicemails, status, reminders
- Remind the owner to call back if they haven't acted on a lead

### Non-Goals (MVP — do not build)
- Customer login or accounts
- Native mobile app (owner or customer)
- Quoting, invoicing, or payment processing
- Multi-user / team access
- CRM or calendar integrations
- Email campaigns or drip sequences
- Live call answering or AI call agent
- Automated quote generation

---

## 3. User Personas

### The Owner (primary user)
- Runs their business solo or with 1–2 helpers
- Works in the field most of the day; phone is often unavailable
- Checks texts and a simple app dashboard in the evenings or between jobs
- Wants to know: *Who called? What do they need? Did I follow up?*
- Not technical; needs zero setup after initial onboarding

### The Caller / Potential Customer (secondary user)
- Called a local business from Google, a yard sign, or a referral
- Expects a quick acknowledgment, not silence
- Will share photos if it's frictionless
- Should never need to download anything or create an account

---

## 4. Core Workflows

---

### Flow A — Missed Call, No Voicemail

```
Caller dials → Owner misses call → No voicemail left
     ↓
System detects missed call (Twilio webhook)
     ↓
Caller lookup: check existing lead history by phone number
     ↓
Auto-text sent to caller within 30 seconds
     ↓
Lead created in dashboard (status: New)
     ↓
Owner notified (SMS or dashboard badge)
```

**Auto-text copy (no voicemail):**
> Hey, this is [Business Name]! Sorry we missed your call. We'll be in touch shortly. If you have photos of the job, you can send them here: [upload link] — [Owner First Name]

---

### Flow B — Missed Call + Voicemail

```
Caller dials → Owner misses call → Caller leaves voicemail
     ↓
Twilio records voicemail audio
     ↓
Transcription service converts audio → text
     ↓
AI (Claude) reads transcript → generates lead summary
     ↓
Auto-text sent to caller within 60 seconds
     ↓
Lead created with: voicemail audio, transcript, AI summary
     ↓
Owner notified with AI summary (SMS or dashboard)
```

**Auto-text copy (voicemail received):**
> Hey, this is [Business Name]! Got your message and we're on it. We'll call you back soon. If you have any photos of the job, send them here: [upload link] — [Owner First Name]

**AI Summary format (shown in dashboard):**
```
Service: Pressure washing
Location mention: Front driveway and back patio
Urgency: Wants it done before the weekend
Notes: Caller mentioned a HOA inspection coming up
Phone: (555) 210-4400
```

---

### Flow C — Photo Upload

```
Customer receives SMS with upload link
     ↓
Taps link → opens mobile web page (no login, token in URL)
     ↓
Page shows: "[Business Name] — Upload your job photos"
     ↓
Customer selects/takes up to 5 photos and submits
     ↓
Photos stored and attached to the lead in dashboard
     ↓
Owner sees photo count badge on the lead card
```

**Photo upload page UI:**
- Business name and logo at top
- Simple "Tap to add photos" button (camera or gallery)
- Up to 5 photos, 10MB each
- One "Send Photos" button
- Thank-you confirmation screen after submit
- Link expires after 7 days or after the lead is closed

---

### Flow D — Callback Reminder

```
Lead created with status: New
     ↓
If owner has not changed status within [reminder window]:
  → Send reminder SMS to owner:
    "Reminder: You have an uncalled lead from [Caller Name/Number].
     They called [X hours] ago. View: [dashboard link]"
     ↓
Owner calls back → marks lead as "Called Back" in dashboard
     ↓
No further reminders sent for that lead
```

**Reminder windows (configurable, defaults):**
- First reminder: 4 hours after missed call (or next morning if after 8 PM)
- Second reminder: 24 hours if still untouched
- No reminders after 48 hours (lead goes stale, stays in dashboard)

---

### Flow E — Follow-Up Tracking

```
Owner views lead in dashboard
     ↓
Owner updates status:
  New → Called Back → Quoted → Won / Lost / No Answer
     ↓
Each status change is timestamped and logged
     ↓
Owner can add a note at any step
     ↓
Owner can schedule a manual follow-up text from dashboard
  → Text sent via Twilio at scheduled time
```

---

## 5. Data Models

### Lead
```
id               UUID, primary key
phone            string, caller's phone number (E.164)
name             string, nullable (from caller ID or owner entry)
call_time        datetime, when the call came in
voicemail_url    string, nullable, Twilio recording URL
transcript       text, nullable, plain text transcription
ai_summary       text, nullable, Claude-generated summary
status           enum: new | called_back | quoted | won | lost | no_answer
notes            text, nullable
photos           array of photo record IDs
upload_token     UUID, unique per lead, used in upload URL
upload_expires   datetime
follow_up_at     datetime, nullable
created_at       datetime
updated_at       datetime
```

### Photo
```
id               UUID
lead_id          UUID, foreign key
filename         string
storage_url      string (S3 or local path)
uploaded_at      datetime
```

### Message
```
id               UUID
lead_id          UUID, foreign key
direction        enum: inbound | outbound
channel          enum: sms | call
body             text
status           enum: queued | sent | delivered | failed
sent_at          datetime
```

### Reminder
```
id               UUID
lead_id          UUID, foreign key
remind_at        datetime
sent             boolean
dismissed        boolean
created_at       datetime
```

---

## 6. Dashboard — Screens & UI

### 6.1 Lead List (Home Screen)

**Layout:** Scrollable card list, newest at top.

**Each card shows:**
- Caller phone (and name if available)
- Time since call (e.g., "2 hours ago")
- Status badge: color-coded pill (New = red, Called Back = yellow, Quoted = blue, Won = green, Lost = gray)
- Icons: voicemail mic if transcript exists, camera if photos attached
- Tap to open lead detail

**Filters (top bar):**
- All / New / Called Back / Quoted / Won / Lost

**Header:**
- Business name
- "New leads" count badge
- Settings gear icon

---

### 6.2 Lead Detail Screen

**Sections (top to bottom):**

1. **Caller info:** Phone, name (editable), call time
2. **Status selector:** Pill row — tap to change status
3. **AI Summary card:** Plain English summary in a highlighted box
4. **Voicemail:** Play button + full transcript (expandable)
5. **Photos:** Thumbnail grid — tap to enlarge. Shows "No photos yet" if none.
6. **Message log:** Chronological list of outbound auto-texts and any inbound replies
7. **Notes:** Free-text field, auto-saved
8. **Actions:**
   - "Call Now" — dials from device
   - "Send Follow-Up Text" — opens text composer pre-filled with template
   - "Schedule Reminder" — set date/time for reminder

---

### 6.3 Settings Screen

- Business name (used in SMS templates)
- Owner first name (used in SMS sign-off)
- Owner phone number (for reminder SMS delivery)
- Reminder window: First reminder after [_] hours (default: 4)
- Auto-text on missed call: On/Off toggle
- Auto-text template preview (read-only in MVP)
- Twilio number displayed (read-only)

---

## 7. SMS Copy Library

All outbound SMS messages are sent from the business's Twilio number.

### Auto-text: Missed call, no voicemail
> Hey, this is [Business Name]! Sorry we missed your call. We'll be in touch soon. Want to share photos of the job? [upload link] — [Owner First Name]

### Auto-text: Missed call, voicemail received
> Hey, this is [Business Name]! Got your voicemail and we'll call you back shortly. Feel free to send photos here in the meantime: [upload link] — [Owner First Name]

### Owner reminder: First
> [Business Name] Reminder: You have a new missed call from [Phone] ([X] hrs ago). View lead: [dashboard link]

### Owner reminder: Second
> [Business Name]: Still haven't followed up with [Phone] from [X] hours ago. They may still be looking. View: [dashboard link]

### Follow-up text (owner-triggered, editable before send)
> Hey [Name/there], this is [Owner First Name] from [Business Name] — just wanted to follow up on your inquiry. Still interested in getting a quote? Give us a call or reply here.

---

## 8. Webhook & Integration Points

### Twilio Incoming Call Webhook (POST /webhooks/call/incoming)
- Triggered on every inbound call
- If owner doesn't answer: mark as missed, trigger Flow A or B
- TwiML response: send caller to voicemail greeting, record voicemail

### Twilio Recording Status Callback (POST /webhooks/call/recording)
- Triggered when voicemail recording is ready
- Initiates transcription job
- On completion, triggers AI summary + auto-text

### Twilio Inbound SMS Webhook (POST /webhooks/sms/inbound)
- Triggered when customer replies to the auto-text
- Message logged to lead's message history
- Owner notified of reply (SMS notification)

### Photo Upload Endpoint (POST /upload/:token)
- Validates token, checks expiry
- Accepts multipart form, up to 5 files
- Stores photos, attaches to lead
- Returns thank-you confirmation

---

## 9. AI Summary Prompt (Claude)

**Input to Claude:**
```
You are a lead intake assistant for a local service business.
A potential customer just left a voicemail. Here is the transcription:

---
[TRANSCRIPT]
---

Extract the following in plain English, max 5 short lines:
- Service requested (if mentioned)
- Location or area details (if mentioned)
- Urgency or timeline (if mentioned)
- Anything else relevant to preparing a quote
- Caller name (if mentioned)

If a field is not mentioned, omit it. Be brief and factual. No filler phrases.
```

**Output format (stored in `ai_summary` field):**
```
Service: [value]
Timeline: [value]
Location: [value]
Notes: [value]
Name heard: [value]
```

---

## 10. Tech Stack (Recommended)

| Layer | Choice | Notes |
|---|---|---|
| Backend | Node.js (Express) or Python (FastAPI) | Simple REST API |
| Database | PostgreSQL | Hosted on Railway or Supabase |
| Phone / SMS | Twilio | Calls, SMS, voicemail recording |
| Transcription | Twilio built-in transcription or OpenAI Whisper | Whisper for better accuracy |
| AI Summary | Anthropic Claude API (claude-sonnet-4-6) | Via API key in env vars |
| Photo Storage | AWS S3 or Cloudflare R2 | Token-based access |
| Dashboard | React (Vite) or plain HTML/CSS/JS | Mobile-responsive |
| Auth (owner) | Simple session token or Clerk | Email/password, single user |
| Hosting | Railway, Render, or Fly.io | Simple deploy |

---

## 11. MVP Scope Summary

### In Scope
- [x] Missed call detection via Twilio webhook
- [x] Voicemail recording and retrieval
- [x] Voicemail transcription
- [x] AI lead summary (Claude)
- [x] Auto-text to caller (missed call acknowledgment)
- [x] Photo upload link in SMS
- [x] Mobile-friendly photo upload page (no login)
- [x] Lead dashboard: list view with status and badges
- [x] Lead detail: voicemail player, transcript, AI summary, photos, message log
- [x] Status tracking: New → Called Back → Quoted → Won/Lost
- [x] Notes field per lead
- [x] Callback reminders (timed SMS to owner)
- [x] Inbound SMS reply logging
- [x] Owner-triggered follow-up text with editable template
- [x] Settings: business name, owner name, reminder window

### Out of Scope (Post-MVP)
- [ ] Multi-user / team access
- [ ] Quoting or invoicing
- [ ] Payment collection
- [ ] Customer login or portal
- [ ] Calendar / scheduling integration
- [ ] Google Business Profile integration
- [ ] Review request automation
- [ ] AI call answering

---

## 12. Key Constraints & Rules

1. No customer app, no customer login. All customer interaction is SMS + web link only.
2. No auto-sending real customer messages until feature is explicitly approved and tested in sandbox mode.
3. All credentials (Twilio, Claude, S3) must use environment variables — never hardcoded.
4. Upload links must be token-based with expiry. No open upload endpoints.
5. Owner dashboard requires authentication (single owner login, no public access).
6. AI summary is informational only — owner makes all decisions and sends all quotes manually.
7. Default to sandbox/test mode. Real SMS sending must be explicitly enabled per environment.

---

## 13. Success Metrics (MVP)

- Owner responds to missed leads within 4 hours (measured by status change time)
- Auto-text delivered within 60 seconds of missed call
- At least 30% of callers who receive the upload link submit at least one photo
- Zero leads lost due to system error (all missed calls create a lead record)
- Owner setup time under 15 minutes from first visit to first live call handled
