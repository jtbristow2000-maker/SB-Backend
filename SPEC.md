# SPEC.md - Small Business Automation Platform

**Version:** 1.1
**Date:** 2026-05-29
**Status:** Draft

---

## 1. Product Overview

This product is automation software for small businesses. The first major automation area is call and message intake: when a customer calls, leaves a voicemail, sends a text, or has a live call with the business, the system should capture the important details and create or update a dashboard profile.

The dashboard should become the owner's source of truth for customers, leads, call notes, addresses, quote details, tasks, and follow-ups. The customer should not need an app or account.

**Target users:** local service businesses, owner-operated trades, home services, mobile services, auto/detailing, landscaping, cleaning, junk removal, repair businesses, and similar small teams.

**Core promise:** every customer conversation becomes an organized business record the owner can act on.

---

## 2. Agent Ownership

### Claude-owned work
- Dashboard GUI and visual design
- Owner workflow screens
- Customer-facing copy and tone
- UX review and product planning

### Codex-owned work
- Backend services and APIs
- Call, voicemail, SMS, and future live-call integrations
- Data models and migrations
- AI extraction and transcription pipeline
- Dashboard data contracts
- Tests, deployment setup, debugging, and cleanup

Codex should avoid editing the `dashboard/` GUI source unless explicitly asked.

---

## 3. Goals and Non-Goals

### Goals
- Capture missed calls, voicemails, inbound SMS, and live-call summaries.
- Create or update a customer/lead profile from each interaction.
- Extract useful call details: name, phone, address, service requested, urgency, quote notes, and next steps.
- Store transcripts, recordings, messages, owner notes, and quote draft fields.
- Expose clean backend data for the dashboard.
- Create callback and follow-up tasks when action is needed.
- Default all integrations to sandbox/test mode.

### Non-Goals for the first backend pass
- Native customer app.
- Customer login.
- Full CRM replacement.
- Payment processing.
- Automated quote sending without owner review.
- AI voice agent that speaks for the owner without explicit approval.
- Multi-user/team permissions unless separately approved.

---

## 4. Core Workflows

### Flow A - Missed Call

```
Customer calls -> owner misses call
     ->
Phone provider webhook reaches backend
     ->
Backend creates CallRecord
     ->
Backend creates or updates CustomerProfile
     ->
Dashboard shows new lead/callback task
```

If auto-text is enabled in sandbox or explicitly approved for production, the backend may send an acknowledgement with an upload or intake link.

### Flow B - Voicemail or Recorded Message

```
Customer leaves voicemail
     ->
Recording callback reaches backend
     ->
Audio is transcribed
     ->
AI extraction creates structured call notes
     ->
CustomerProfile is updated
     ->
Dashboard shows transcript, summary, quote details, and next task
```

### Flow C - Live Call Intake

```
Owner/customer live call happens
     ->
Call audio or post-call notes are captured
     ->
Backend transcribes or receives summary data
     ->
AI extraction identifies customer info, address, requested service, quote notes, and next steps
     ->
Dashboard profile is created or updated
```

Live-call automation should be passive by default: listen, transcribe, summarize, and draft. It should not speak for the owner or promise prices/times unless explicitly approved.

### Flow D - Inbound SMS

```
Customer texts business number
     ->
SMS webhook reaches backend
     ->
Message is linked to an existing profile by phone number or creates a new profile
     ->
Message history and profile notes are updated
     ->
Owner sees unread message/task in dashboard
```

### Flow E - Quote Draft Capture

```
Call/message mentions quote-relevant details
     ->
AI extraction pulls service, address, size/scope, timeline, constraints, budget, and photos requested
     ->
Backend stores a QuoteDraft attached to the profile
     ->
Owner reviews and edits in dashboard
```

AI quote data is draft-only. The owner makes final pricing and sends any real quote.

### Flow F - Follow-Up Tasks

```
Profile needs owner action
     ->
Backend creates task: call back, review quote, request photos, follow up, or close lead
     ->
Dashboard shows task queue
     ->
Owner completes, dismisses, or reschedules task
```

---

## 5. Data Model Draft

### Business

```
id
name
owner_name
owner_phone
business_phone
timezone
settings_json
created_at
updated_at
```

### CustomerProfile

```
id
business_id
display_name
phone
email
address_line1
address_line2
city
state
postal_code
source
status
summary
notes
last_contact_at
created_at
updated_at
```

### CallRecord

```
id
business_id
customer_profile_id
provider
provider_call_id
direction
call_type            missed | voicemail | live | manual
from_phone
to_phone
started_at
ended_at
duration_seconds
recording_url
transcript
ai_summary
extracted_json
needs_review
created_at
updated_at
```

### Message

```
id
business_id
customer_profile_id
provider
provider_message_id
direction
channel              sms | mms | email | web
body
media_json
status
sent_at
created_at
```

### QuoteDraft

```
id
business_id
customer_profile_id
source_call_record_id
service_requested
job_address
scope_notes
timeline
budget_hint
estimated_amount
status               draft | reviewed | sent | accepted | declined
created_at
updated_at
```

### Task

```
id
business_id
customer_profile_id
task_type            callback | quote_review | follow_up | request_photos | manual
title
notes
due_at
status               open | completed | dismissed
created_at
updated_at
```

### Attachment

```
id
business_id
customer_profile_id
source_type          call | message | upload | manual
filename
content_type
storage_url
uploaded_at
```

### AuditEvent

```
id
business_id
customer_profile_id
actor                system | owner | provider
event_type
event_json
created_at
```

---

## 6. Backend/API Contract

The dashboard should be able to consume these backend surfaces:

- `GET /api/profiles` - list customer/lead profiles with status, last contact, task count, and quote state.
- `GET /api/profiles/:id` - profile detail with calls, messages, quote drafts, tasks, notes, and attachments.
- `PATCH /api/profiles/:id` - owner edits to customer info, address, notes, and status.
- `GET /api/tasks` - owner task queue.
- `PATCH /api/tasks/:id` - complete, dismiss, or reschedule a task.
- `GET /api/quotes/:id` - quote draft detail.
- `PATCH /api/quotes/:id` - owner edits to draft quote data.

Webhook surfaces:

- `POST /webhooks/calls/incoming`
- `POST /webhooks/calls/recording`
- `POST /webhooks/sms/inbound`
- `POST /webhooks/live-call/summary` for future or provider-specific live-call intake

Provider names should stay abstract in internal code when possible so Twilio or another call provider can be swapped later.

---

## 7. AI Extraction

The extraction pipeline should accept transcript/message text and return structured JSON plus a short owner-facing summary.

Required extracted fields:

```
customer_name
phone
email
address
service_requested
urgency
quote_details
photos_requested
follow_up_recommendation
confidence
needs_review
summary
```

Rules:
- Omit unknown fields instead of guessing.
- Mark `needs_review = true` when key details are ambiguous.
- Never produce a final price unless explicitly provided by the caller or owner.
- Store the raw transcript and structured extraction.
- Keep prompts factual and short.

---

## 8. Integration and Safety Defaults

All real providers must be controlled by environment variables.

Required defaults:
- `SANDBOX_MODE=true`
- `REAL_MESSAGE_SENDING_ENABLED=false`
- `REAL_CALL_AUTOMATION_ENABLED=false`
- Fake/sandbox transcription and AI providers allowed for local tests.
- No credentials in source code.
- No real outbound SMS or calls until explicitly approved.

---

## 9. Suggested Backend Stack

Pick one simple backend stack when implementation starts:

| Layer | Recommended choice | Notes |
|---|---|---|
| API | Node.js Express or Python FastAPI | Keep the first pass simple |
| Database | SQLite locally, PostgreSQL for hosted | Use migrations |
| Call/SMS provider | Twilio first | Abstract provider boundary |
| Transcription | Sandbox fake first, then Whisper/provider transcription | Test without real calls |
| AI extraction | Provider adapter with sandbox fake | Use env vars |
| Storage | Local dev storage, S3/R2 later | Attachments/photos/recordings |
| Dashboard | Existing `dashboard/` GUI owned by Claude | Codex exposes backend contract |

---

## 10. MVP Implementation Phases

### Phase 1 - Backend foundation
- Choose backend stack.
- Add typed data models.
- Add local database and migrations.
- Add sandbox provider interfaces for calls, SMS, transcription, and AI extraction.
- Add tests for profile creation/update logic.

### Phase 2 - Call and message intake
- Implement webhook endpoints.
- Create/update profiles from missed calls, voicemails, and inbound SMS.
- Store transcripts and message history.
- Create callback/follow-up tasks.

### Phase 3 - AI extraction and quote drafts
- Convert transcripts/messages into structured profile fields.
- Create quote drafts from extracted service and scope details.
- Mark low-confidence fields for owner review.

### Phase 4 - Dashboard integration contract
- Expose profile, call, message, quote, and task APIs.
- Document payloads for Claude's dashboard work.
- Add seed/demo data endpoint or script for dashboard testing.

### Phase 5 - Real provider setup
- Add Twilio or selected provider credentials through env vars.
- Keep sandbox mode default.
- Add production safety flags for real outbound actions.

---

## 11. Key Constraints

1. No customer app.
2. No customer login unless explicitly approved.
3. Owner dashboard is allowed.
4. Customer interaction stays phone, SMS, and secure web links.
5. AI notes and quote data are drafts until owner review.
6. Do not auto-send real customer messages without approval.
7. Do not place real outbound calls without approval.
8. Credentials must come from environment variables.
9. Backend records should be auditable and testable.
10. Codex should avoid GUI/dashboard source unless explicitly asked.
