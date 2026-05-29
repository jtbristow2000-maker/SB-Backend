# TASKS.md

## Current Direction

Build the backend/call-automation side for small-business automation software. Claude owns the dashboard GUI. Codex owns backend services, call/message intake, data contracts, tests, and deployment setup.

## Dashboard Builder Tasks

These tasks define the dashboard customization builder from Claude's Dashboard Builder spec. Implement one task at a time, with mock data/config only until explicitly approved.

1. Create dashboard configuration system with mock config.
   - Define the dashboard config data structure.
   - Include editable business/dashboard names.
   - Include editable theme colors.
   - Include module visibility toggles.
   - Use mock/default config only.
   - Do not connect backend providers or real customer data.

2. Add editable names/colors/toggles panel.
   - Let the owner edit display names from the mock config.
   - Let the owner edit theme colors from the mock config.
   - Let the owner toggle dashboard modules on/off.
   - Keep changes local-only.

3. Save/load config locally.
   - Save dashboard builder config to local storage or local app data.
   - Load saved config on startup.
   - Fall back to defaults if saved config is missing or invalid.

4. Reset to defaults.
   - Add a clear reset action.
   - Restore the mock default dashboard config.
   - Do not delete unrelated local data.

5. Drag-and-drop module reorder.
   - Allow dashboard modules to be reordered in the builder.
   - Persist the local module order.
   - Keep module reorder separate from backend data order.

6. Pipeline stage editor.
   - Allow editing mock pipeline stage names.
   - Allow adding/removing/reordering stages locally.
   - Preserve a simple default stage list.

7. Status color editor.
   - Allow editing status colors from the mock config.
   - Support reset back to default status colors.
   - Keep all changes local-only.

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
