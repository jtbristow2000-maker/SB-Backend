# TASKS.md

## Current Direction

Build the backend/call-automation side for small-business automation software. Claude owns the dashboard GUI. Codex owns backend services, call/message intake, data contracts, tests, and deployment setup.

## Dashboard Builder Tasks

No-code editor for the business owner to customize their dashboard. All tasks use mock/local config only. No Twilio, no database, no auth, no customer messages. Implement one task at a time in order.

**Config file location:** `%LOCALAPPDATA%\BusinessDashboard\dashboard.config.json`
**Codex must not edit dashboard GUI files unless a task explicitly says to.**

---

### BUILDER-01 — Create DashboardConfig model

File: `dashboard/DashboardConfig.cs`

Create C# classes that represent the full config structure:

```
DashboardConfig
  version: int
  branding: BrandingConfig
  theme: ThemeConfig
  modules: List<ModuleConfig>
  pipelines: Dictionary<string, PipelineConfig>

BrandingConfig
  businessName: string
  dashboardSubtitle: string

ThemeConfig
  sidebarBg: string   (hex color)
  accent: string
  contentBg: string

ModuleConfig
  id: string          (stable key — never changes)
  label: string       (display name, editable)
  icon: string
  addButtonLabel: string
  enabled: bool
  order: int

PipelineConfig
  stages: List<StageConfig>

StageConfig
  id: string          (stable key — stored in DB, never changes)
  label: string       (display name, editable)
  color: string       (hex color)
  description: string
```

No logic yet. Classes only.

---

### BUILDER-02 — Create ConfigManager

File: `dashboard/ConfigManager.cs`

Static class with three methods:

- `DashboardConfig Load()` — reads `dashboard.config.json` from `%LOCALAPPDATA%\BusinessDashboard\`. Returns `GetDefaults()` silently if file is missing or JSON is invalid.
- `void Save(DashboardConfig config)` — serializes to JSON and writes to the same path. Write to a temp file first, then rename, to avoid corruption on crash.
- `DashboardConfig GetDefaults()` — returns a hardcoded default config matching the current app state:
  - Modules: Leads (order 0), Appointments (order 1), Messages (order 2), Quotes (order 3), all enabled.
  - Lead stages: New, Contacted, Quoted, Won, Lost.
  - Appointment stages: Scheduled, Confirmed, Completed, Cancelled, No Show.
  - Quote stages: Pending, Sent, Accepted, Declined, Invoiced.
  - Colors matching current `Ui.cs` values.
  - Business name: "Business Hub", subtitle: "Owner Dashboard".

Use `System.Text.Json` for serialization. No third-party packages.

---

### BUILDER-03 — Wire config into MainForm at startup

Files: `dashboard/Program.cs`, `dashboard/MainForm.cs`, `dashboard/UiKit.cs`

In `Program.Main()`, call `ConfigManager.Load()` before `Application.Run()`. Pass the config to `MainForm`.

Apply config values at startup:
- `Ui.Accent`, `Ui.SidebarBg`, `Ui.ContentBg` — set from `config.theme` (parse hex strings to `Color`). Keep existing values as fallback if parse fails.
- Sidebar brand block — use `config.branding.businessName` and `config.branding.dashboardSubtitle`.
- Nav items — use each module's `label`, `icon`, and `enabled` flag. Skip disabled modules entirely. Render in `order` sequence.
- `CardListPage` titles and add-button labels — use each module's `label` and `addButtonLabel`.

Add a `MainForm.ApplyConfig(DashboardConfig config)` public method that re-applies all of the above to the already-open window (used by the builder after Save).

Do not modify any database logic.

---

### BUILDER-04 — Wire pipeline stages into status dropdowns

File: `dashboard/MainForm.cs`

`FieldDialog` status dropdowns for Lead, Appointment, and Quote are currently hardcoded arrays. Replace them with values from the loaded config:

- Lead `Status` field options → `config.pipelines["leads"].stages` mapped to `stage.label`.
- Appointment `Status` field options → `config.pipelines["appointments"].stages`.
- Quote `Status` field options → `config.pipelines["quotes"].stages`.

The value stored in SQLite stays the stage `id` (e.g., `"won"`), not the label. When loading a record, match the saved id back to the current label for display. Fall back to the raw id string if no match is found (handles records saved before a rename).

---

### BUILDER-05 — Add Customize entry point to sidebar

File: `dashboard/MainForm.cs`

Add a `⚙  Customize` clickable label or button to the sidebar footer area (above or replacing the version label). Clicking it opens `BuilderForm` as `ShowDialog(this)`. After the dialog closes with `DialogResult.OK`, call `MainForm.ApplyConfig()` with the updated config.

---

### BUILDER-06 — Create BuilderForm shell

File: `dashboard/BuilderForm.cs`

Modal form (~780 × 580 px). Use the same borderless + `DragWindow()` pattern as `FieldDialog`.

Structure:
- Dark header bar with title "Customize Dashboard" and ✕ close button.
- Four tab buttons below the header: `Modules` · `Pipeline` · `Appearance` · `Branding`. Tab buttons are plain labels that swap visible panels. No WinForms `TabControl` — paint the active tab indicator manually to match the app style.
- Content panel area (fills remaining space).
- Footer: `Save & Apply` (blue), `Cancel` (gray), `Reset to Defaults` (ghost red).

Behavior:
- On open: load a working copy of the current config into memory. All edits happen on this copy.
- `Cancel` closes without saving. No confirmation needed.
- `Reset to Defaults`: show a `MessageBox` confirmation ("This will reset all dashboard settings to default. Continue?"). On Yes: call `ConfigManager.Save(GetDefaults())`, then close with `DialogResult.OK` so `MainForm` re-applies.
- `Save & Apply`: save the working copy, close with `DialogResult.OK`.
- No tab content yet. Each tab panel can be a placeholder `Label` for now.

---

### BUILDER-07 — Implement Modules tab

Inside `BuilderForm`, implement the Modules tab panel.

Render one row per module from the working config copy. Rows display in current order. Each row contains:
- `▲` and `▼` buttons — move module up or down in order. Top item's ▲ is disabled; bottom item's ▼ is disabled.
- Enabled checkbox — toggles `module.enabled`. At least one module must remain enabled; show a warning if the owner tries to disable the last one.
- Module label TextBox — editable. Must not be blank.
- Add-button label TextBox — editable. Must not be blank.

All changes update the in-memory working copy only. Nothing is written until `Save & Apply`.

---

### BUILDER-08 — Implement Pipeline tab

Inside `BuilderForm`, implement the Pipeline tab panel.

At the top: a `ComboBox` to select which pipeline to edit. Options: the label of each enabled module that has a pipeline (Leads, Appointments, Quotes). Switching selection re-renders the stage list below.

For each stage, render a row:
- `▲` and `▼` buttons for reordering.
- Color button: a filled rectangle showing the current hex color. Clicking opens `ColorDialog`. On selection, update the button fill and store the hex value in the working copy.
- Stage name TextBox — editable. Must not be blank.
- `Delete` button — removes the stage. Disabled when only one stage remains.

Below the stage list: `+ Add Stage` button. Adds a new row with label "New Stage", color `#888888`, and a generated id like `custom_1`, `custom_2`, etc.

All changes are in-memory until Save.

---

### BUILDER-09 — Implement Appearance tab

Inside `BuilderForm`, implement the Appearance tab panel.

Three rows, one per theme color:

```
Accent color           [████] (filled button, opens ColorDialog)
Sidebar background     [████]
Content background     [████]
```

Each button shows the current hex color as its background. Clicking opens `ColorDialog`. On selection, update the button and store the hex value in the working copy.

No live preview. Colors are applied only after `Save & Apply`.

---

### BUILDER-10 — Implement Branding tab

Inside `BuilderForm`, implement the Branding tab panel.

Two labeled fields:

```
Business name         [ Business Hub              ]
Dashboard subtitle    [ Owner Dashboard           ]
```

Standard TextBoxes. Neither may be blank. Changes stored in working copy.

---

### BUILDER-11 — Implement Save & Apply

In `BuilderForm`, wire the `Save & Apply` button:

1. Validate: no module label is blank, no stage label is blank, no branding field is blank. If invalid, show a `MessageBox` describing what is missing. Do not close the form.
2. Collect the working config from all four tab panels.
3. Call `ConfigManager.Save(workingConfig)`.
4. Set `DialogResult = DialogResult.OK` and close.
5. Back in `MainForm`: call `ApplyConfig(config)` to re-render the open window without restart.
6. Show a brief `"Saved!"` label in the sidebar footer for 2 seconds, then revert to the version text.

---

### BUILDER-12 — Add mock config seed for development

File: `dashboard/SampleData.cs`

Add a `SeedConfig()` method that calls `ConfigManager.Save(ConfigManager.GetDefaults())` to write a clean default config file. Wire it to the existing `--seed` flag in `Program.Main()` so running `BusinessDashboard.exe --seed` resets both the database sample data and the config file.

This makes it easy to reset to a known clean state during development.

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
