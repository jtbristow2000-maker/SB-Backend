# AI Development Rules

## Project
This is automation software for small businesses.

The first product focus is call and message intake: missed calls, voicemails, inbound texts, and live-call notes should become useful dashboard records automatically.

The system should create and update customer/lead profiles with call notes, address, requested service, quote details, follow-up tasks, message history, and owner-facing summaries.

The customer should not need to download an app. Customer-facing experiences should stay phone, SMS, and secure web-link based.

The business owner should have a simple dashboard for leads, customers, calls, messages, quotes, follow-ups, and callback tasks.

## Agent Roles
- Claude owns GUI, dashboard UX, customer-facing copy, workflow design, product planning, and visual review.
- Codex owns backend implementation, debugging, call/message integrations, data models, migrations, tests, deployment setup, and code cleanup.
- The WinForms dashboard prototype is archived at `archive/dashboard-winforms/` (frozen, not in use). Nothing under `archive/` should be edited.

## Product Guardrails
1. Keep the customer workflow simple.
2. No customer app.
3. No customer login unless explicitly approved.
4. Owner/admin dashboard is allowed.
5. Calls, texts, voicemails, photos, and web links are allowed customer channels.
6. Live-call automation may capture, transcribe, summarize, and draft records, but must not impersonate the owner or make commitments unless explicitly approved.
7. AI-generated notes, quotes, and summaries are drafts until the owner reviews or approves them.
8. Do not auto-send real customer messages unless the feature is explicitly approved.
9. Do not place real outbound calls unless the feature is explicitly approved.
10. Use test data, fake providers, and sandbox mode by default.

## Engineering Rules
1. Do not change unrelated files.
2. Do not delete working code unless explicitly instructed.
3. Do not hardcode API keys, passwords, tokens, or secrets.
4. Use environment variables for all credentials and provider settings.
5. Update `CHANGELOG_AI.md` after every meaningful change.
6. Before major changes, explain the plan first.
7. Prefer simple, maintainable code over clever architecture.
8. Each task should be small and testable.
9. Do not implement future tasks unless asked.
10. Backend changes should include tests or a clear reason tests were not run.
11. Store all customer/contact data through typed models or migrations, not ad hoc files.
12. Keep an audit trail for automated call/message/profile updates whenever practical.

## Call/Profile Data Rules
Every call or message profile should be able to represent:
- Customer name, phone, email, and address when available.
- Business/source context: missed call, voicemail, inbound SMS, live call, web form, or manual entry.
- Call/message metadata: time, duration, channel, recording URL, transcript, and direction.
- AI extraction: summary, service requested, urgency, address/location, quote-relevant details, and confidence/needs-review flags.
- Owner workflow: status, notes, quote draft fields, follow-up date, callback task, and message history.
