# AI Development Rules

## Project
This is an AI missed-call and quote assistant for local service businesses.

The customer should not need to download an app. The customer experience should be SMS, phone, and web-link based.

The business owner should have a simple dashboard for leads, voicemails, quotes, follow-ups, and callback tasks.

## Roles
- Claude is used for GUI, UX, customer-facing copy, workflow design, product planning, and review.
- Codex is used for implementation, debugging, integrations, tests, deployment setup, and code cleanup.

## General Rules
1. Do not change unrelated files.
2. Do not delete working code unless explicitly instructed.
3. Do not hardcode API keys, passwords, tokens, or secrets.
4. Use environment variables for all credentials.
5. Update CHANGELOG_AI.md after every meaningful change.
6. Before major changes, explain the plan first.
7. Keep the customer workflow simple.
8. No customer app.
9. No customer login unless explicitly approved.
10. Owner/admin dashboard is allowed.
11. Do not auto-send real customer messages unless the feature is explicitly approved.
12. Use test data and sandbox mode by default.
13. Prefer simple, maintainable code over clever architecture.
14. Each task should be small and testable.
15. Do not implement future tasks unless asked.