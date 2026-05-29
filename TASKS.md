# TASKS.md

## Current Direction

Build the backend/call-automation side for small-business automation software. Claude owns the dashboard GUI. Codex owns backend services, call/message intake, data contracts, tests, and deployment setup.

## Codex Tasks

1. Pick and scaffold the backend stack outside `dashboard/`.
   - Recommended: Node.js Express or Python FastAPI.
   - Must include a basic health endpoint and test command.

2. Define the first database schema.
   - Business
   - CustomerProfile
   - CallRecord
   - Message
   - QuoteDraft
   - Task
   - Attachment
   - AuditEvent

3. Add environment-based configuration.
   - Sandbox mode defaults on.
   - Real SMS/call automation defaults off.
   - No secrets committed.

4. Create sandbox provider interfaces.
   - Call provider
   - SMS provider
   - Transcription provider
   - AI extraction provider
   - Storage provider

5. Implement profile creation/update logic.
   - Match by business and phone number.
   - Create a profile for unknown callers.
   - Update profile fields from extracted call/message data.
   - Preserve owner-entered notes.

6. Add webhook endpoints.
   - Incoming call
   - Recording/voicemail ready
   - Inbound SMS
   - Future live-call summary endpoint

7. Add AI extraction contract.
   - Input: transcript or message body.
   - Output: structured JSON plus owner-facing summary.
   - Include `needs_review` and `confidence`.

8. Add dashboard API contract.
   - Profiles list/detail.
   - Tasks list/update.
   - Quote draft detail/update.
   - Calls/messages attached to a profile.

9. Add tests.
   - Missed call creates profile and callback task.
   - Voicemail transcript updates profile and quote draft.
   - SMS links to existing profile by phone.
   - Low-confidence extraction marks profile for review.

## Claude-Owned Tasks

- Dashboard GUI layout and navigation.
- Dashboard forms and visual interactions.
- Owner-facing copy and workflow review.
- Customer-facing copy review.

## Do Not Start Yet Unless Asked

- Real production SMS sending.
- Real outbound calling.
- AI voice agent that speaks to customers.
- Payment processing.
- Customer login or customer app.
- Large dashboard GUI rewrites by Codex.
