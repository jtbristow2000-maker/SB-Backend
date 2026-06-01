# Deployment Readiness

This app is designed to deploy from the `web/` directory to Vercel. The default local mode remains sandbox/in-memory; a production deploy for a real business should use Supabase persistence and verified Twilio webhooks.

## Vercel Project

1. Create a Vercel project from this repository.
2. Set the project root directory to `web/`.
3. Use the default Next.js build settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output: managed by Next.js
4. Set all required environment variables in Vercel. Do not commit real secrets.

## Environment Variables

Required for an observable Supabase-backed deploy:

```text
NODE_ENV=production
SANDBOX_MODE=true
PERSISTENCE=supabase
PUBLIC_BASE_URL=https://your-vercel-domain.vercel.app
APP_BASE_URL=https://your-vercel-domain.vercel.app
API_KEY=<owner-api-key>

BUSINESS_ID=<stable-uuid>
BUSINESS_NAME=<business-name>
OWNER_NAME=<owner-name>
OWNER_PHONE=<owner-e164-phone>
BUSINESS_PHONE=<twilio-e164-phone>
TIMEZONE=America/New_York

SUPABASE_URL=<supabase-project-url>
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>

TWILIO_ACCOUNT_SID=<twilio-account-sid>
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_PHONE_NUMBER=<twilio-e164-phone>
TWILIO_MESSAGING_SERVICE_SID=<optional>

WEBHOOK_SIGNATURE_REQUIRED=true
SMS_SENDING_ENABLED=false
CALL_FORWARDING_ENABLED=false
REAL_MESSAGE_SENDING_ENABLED=false
REAL_CALL_AUTOMATION_ENABLED=false

OPENAI_API_KEY=
SENTRY_DSN=<optional>
```

`SUPABASE_SERVICE_ROLE_KEY`, `TWILIO_AUTH_TOKEN`, `API_KEY`, and `SENTRY_DSN` are server-only secrets. Never expose them with `NEXT_PUBLIC_` names.

## Supabase

1. Create a Supabase project.
2. Apply the SQL migration in `supabase/migrations/0001_init.sql` with the Supabase CLI:

```bash
supabase db push
```

Or run the file with `psql` against the Supabase Postgres connection.

3. Set `PERSISTENCE=supabase`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
4. Visit `/api/health` with the `X-API-Key` header and confirm:
   - `persistence.mode` is `supabase`
   - `persistence.supabase.status` is `ok`
   - no secrets are included in the response

## Twilio Webhooks

When ready to point a real Twilio number at the deploy, configure these webhook URLs in Twilio:

```text
Voice webhook:
https://your-vercel-domain.vercel.app/api/webhooks/twilio/voice

Voice status callback:
https://your-vercel-domain.vercel.app/api/webhooks/twilio/voice/status

Recording/transcription callback:
https://your-vercel-domain.vercel.app/api/webhooks/twilio/recording

Messaging webhook:
https://your-vercel-domain.vercel.app/api/webhooks/twilio/sms
```

Set `WEBHOOK_SIGNATURE_REQUIRED=true` in production. `PUBLIC_BASE_URL` must match the public Vercel origin Twilio calls so signature validation uses the same URL Twilio signed.

The safety flags stay off until explicitly approved:

```text
SMS_SENDING_ENABLED=false
CALL_FORWARDING_ENABLED=false
```

With those defaults, the backend records sandbox-safe actions and does not send customer SMS or place outbound calls.

## Local Tunnel Testing

For local webhook tests, run the app:

```bash
npm run dev
```

Expose it with a tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
```

or:

```bash
ngrok http 3000
```

Set `PUBLIC_BASE_URL` and `APP_BASE_URL` to the tunnel HTTPS URL, then point Twilio's sandbox/test number webhooks to:

```text
https://your-tunnel-url/api/webhooks/twilio/voice
https://your-tunnel-url/api/webhooks/twilio/sms
```

For quick local form posts without signatures, keep `WEBHOOK_SIGNATURE_REQUIRED=false`. For realistic tunnel testing, set it to `true` and use the matching `TWILIO_AUTH_TOKEN`.

## Observability

Every API/webhook request emits one JSON log line with:

- `request_id`
- `route`
- `status`
- `outcome`
- `business_id`
- `provider_call_id`
- `provider_message_id`

Logs intentionally exclude request bodies, API keys, Twilio auth tokens, Supabase keys, and other secrets.

If `SENTRY_DSN` is set, unhandled route errors are reported through a lightweight server-only capture path. If it is unset, error capture is a no-op.

## Pre-Deploy Check

Run:

```bash
npm run verify
npm run build
```

Then call:

```bash
curl -H "X-API-Key: $API_KEY" https://your-vercel-domain.vercel.app/api/health
```

The deploy is ready for controlled Twilio testing when health is `ok`, Supabase connectivity is `ok`, and production webhook signatures are required.
