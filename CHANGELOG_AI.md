# CHANGELOG_AI.md

## [2026-05-29]
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
