# Backend/Web Foundation

This folder is the sandbox-first Next.js foundation for the future web/mobile missed-call and lead-intake MVP.

## What Exists

- A minimal Next.js App Router project.
- A health endpoint at `GET /api/health`.
- Placeholder Twilio webhook routes:
  - `POST /api/webhooks/twilio/incoming-call`
  - `POST /api/webhooks/twilio/incoming-sms`
  - `POST /api/webhooks/twilio/recording-callback`
- Webhook handlers are isolated in `src/server/webhooks/` so future business logic can be added behind a clean boundary.
- Supabase-ready SQL migrations in `supabase/migrations/` for businesses, customer profiles, calls, messages, tasks, and appointments.
- TypeScript database contracts in `src/server/db/`.
- Provider interfaces and sandbox implementations in `src/server/providers/`.
- Phone normalization and customer profile upsert service in `src/server/phone/` and `src/server/customerProfiles/`.
- Single-tenant business bootstrap and `X-API-Key` route guard for owner API routes.
- Environment examples for Supabase, Twilio, OpenAI, app URL, and safety flags.

## Sandbox Only

The current endpoints are stubs. They do not:

- send SMS
- place calls
- write to a database
- connect to Supabase
- call OpenAI
- transcribe audio
- create customer records
- use production secrets

Safety defaults:

```text
SANDBOX_MODE=true
SMS_SENDING_ENABLED=false
CALL_FORWARDING_ENABLED=false
REAL_MESSAGE_SENDING_ENABLED=false
REAL_CALL_AUTOMATION_ENABLED=false
```

## Local Setup

From this folder:

```powershell
npm install
npm run dev
```

Then open:

```text
http://localhost:3000
http://localhost:3000/api/health
```

Build check:

```powershell
npm run build
```

Test check:

```powershell
npm test
```

## Local Stub Testing

Health:

```powershell
Invoke-RestMethod http://localhost:3000/api/health -Headers @{ "X-API-Key" = "<your API_KEY>" }
```

Incoming call webhook:

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/webhooks/twilio/incoming-call -Body @{ From = "+15551234567"; To = "+15557654321"; CallSid = "CA_TEST" }
```

Incoming SMS webhook:

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/webhooks/twilio/incoming-sms -Body @{ From = "+15551234567"; To = "+15557654321"; Body = "Need a quote"; MessageSid = "SM_TEST" }
```

Recording callback:

```powershell
Invoke-RestMethod -Method Post http://localhost:3000/api/webhooks/twilio/recording-callback -Body @{ CallSid = "CA_TEST"; RecordingSid = "RE_TEST"; RecordingUrl = "https://example.test/recording" }
```

## Still Needed

- Supabase schema and auth wiring.
- Supabase client/repository implementation.
- Supabase-backed customer profile repository.
- Real provider adapters behind the existing sandbox interfaces.
- Signature validation for real Twilio traffic.
- Lead/customer profile creation logic.
- Message/call persistence.
- AI extraction and transcription adapters.
- Owner-facing web dashboard.
- Tests around route behavior and intake services.
