# CHANGELOG_AI.md

## [2026-05-29] - Dashboard Builder tasks added

### Added
- `TASKS.md`: added a new "Dashboard Builder Tasks" section based on Claude's Dashboard Builder spec.
- Listed the first task as "Create dashboard configuration system with mock config."
- Added follow-up builder tasks for editable names/colors/toggles, local save/load, reset to defaults, drag-and-drop module reorder, pipeline stage editing, and status color editing.

### Notes
- No implementation code was changed.
- Builder work remains mock/local-config only until explicitly approved.

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
