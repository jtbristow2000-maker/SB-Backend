# CHANGELOG_AI.md

## [2026-05-29] - BUILDER-03 config wired into dashboard startup

### Changed
- `Program.cs`: loads the local dashboard config and passes it into `MainForm`.
- `MainForm.cs`: applies branding, theme colors, module labels/icons/enabled flags/order, and page add-button labels from the loaded config.
- `UiKit.cs`: allows configured theme colors for sidebar background, accent, and content background with invalid-color fallback.

### Notes
- Added `MainForm.ApplyConfig(DashboardConfig config)` for re-applying config to an open window.
- No pipeline/status dropdown storage changes, builder form, customize entry point, backend changes, provider integrations, auth, payments, or message sending.

## [2026-05-29] - BUILDER-02 ConfigManager added

### Added
- `dashboard/ConfigManager.cs` with `Load()`, `Save(DashboardConfig config)`, and `GetDefaults()`.
- Local mock config path: `%LOCALAPPDATA%\BusinessDashboard\dashboard.config.json`.
- Default dashboard config matching the current app modules, branding, theme colors, and pipeline stages.

### Notes
- Uses `System.Text.Json` only; no third-party packages.
- Saves through a temp file before replacing the config file.
- No UI wiring, backend changes, provider integrations, auth, payments, or message sending.

## [2026-05-29] - BUILDER-01 DashboardConfig model added

### Added
- `dashboard/DashboardConfig.cs` with strongly typed dashboard builder config model classes:
  - `DashboardConfig`
  - `BrandingConfig`
  - `ThemeConfig`
  - `ModuleConfig`
  - `PipelineConfig`
  - `StageConfig`

### Notes
- Model classes only; no file I/O, save/load logic, UI changes, backend changes, or provider integrations.

## [2026-05-29] - Dashboard Builder tasks revised and expanded

### Changed
- `TASKS.md` — Dashboard Builder Tasks section replaced with 12 granular, ID-tagged tasks (BUILDER-01 through BUILDER-12).
  - Previous tasks were too broad for Codex to implement directly.
  - New tasks are atomic, ordered, and each has a named target file, clear inputs/outputs, and acceptance criteria.
  - No Twilio, no database connections, no auth, no customer messages — mock/local config only throughout.

### Task summary
| ID | Task |
|---|---|
| BUILDER-01 | Create `DashboardConfig.cs` model classes |
| BUILDER-02 | Create `ConfigManager.cs` (load/save/defaults) |
| BUILDER-03 | Wire config into `MainForm` startup + `ApplyConfig()` method |
| BUILDER-04 | Wire pipeline stages into `FieldDialog` status dropdowns |
| BUILDER-05 | Add `⚙ Customize` entry point to sidebar |
| BUILDER-06 | Create `BuilderForm.cs` shell (tabs, header, footer, reset) |
| BUILDER-07 | Implement Modules tab (toggle, rename, reorder, add-label) |
| BUILDER-08 | Implement Pipeline tab (stage editor, color picker, add/delete/reorder) |
| BUILDER-09 | Implement Appearance tab (three theme color pickers) |
| BUILDER-10 | Implement Branding tab (business name, subtitle) |
| BUILDER-11 | Implement Save & Apply with validation and sidebar confirmation |
| BUILDER-12 | Add `SeedConfig()` to `SampleData.cs`, wire to `--seed` flag |

### Notes
- No code was changed. Planning pass only.
- First Codex task: BUILDER-01 (`DashboardConfig.cs` — model classes only, no logic).

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
