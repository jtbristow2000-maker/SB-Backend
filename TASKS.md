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

## Save/Load Reliability Tasks

These tasks harden the config save/load pipeline. They fix a critical bug (Save & Apply never writes to disk), add resilience against file corruption, and establish a versioning foundation for future schema changes. Implement in order — each task builds on the previous.

**Scope:** `dashboard/` only. No backend, no Twilio, no database changes, no customer messages.

---

### SAVE-01 — Add MigrationRunner with CurrentSchemaVersion = 1

**Goal:**
Establish the version-aware load pipeline. The `version` field already exists in `DashboardConfig` but nothing reads it. This task wires up version extraction and a migration runner so future schema changes can be applied automatically on load without breaking old config files.

**Files likely affected:**
- `dashboard/ConfigManager.cs` — extend `Load()` to extract version before deserializing
- `dashboard/MigrationRunner.cs` — new file (or nested internal class inside ConfigManager.cs)

**Requirements:**
- Create a `MigrationRunner` class (internal to the `BusinessDashboard` namespace).
- Define `public const int CurrentSchemaVersion = 1` inside it.
- Implement `public static string Migrate(string rawJson, int fromVersion)`:
  - If `fromVersion == CurrentSchemaVersion`: return `rawJson` unchanged.
  - If `fromVersion < CurrentSchemaVersion`: apply each registered migration in order (none exist yet at v1, so this is a no-op loop). Return the final JSON string.
  - If `fromVersion > CurrentSchemaVersion`: write a `Debug.WriteLine` warning and return `rawJson` unchanged (do not crash).
- Migrations are registered as an ordered list of `(int FromVersion, Func<string, string> Apply)`. The list is empty at v1.
- In `ConfigManager.Load()`, before deserializing:
  1. Parse only the `"version"` integer from the raw JSON string. If the field is missing or parse fails, default to `1`. Do not deserialize the whole document just to get the version.
  2. Call `MigrationRunner.Migrate(rawJson, extractedVersion)`.
  3. Deserialize the returned (possibly migrated) JSON.
- `ConfigManager.GetDefaults()` must set `Version = MigrationRunner.CurrentSchemaVersion`.

**Acceptance criteria:**
- Loading a valid v1 config: works identically to before this task.
- Loading a config with the `"version"` field missing: treated as v1, loads without error.
- Loading a config with `"version": 99` (a future version): app starts, loads available fields, no crash.
- `ConfigManager.GetDefaults().Version` equals `MigrationRunner.CurrentSchemaVersion` (both are 1).
- No visible behavioral change to the running app.

**How to test:**
1. Run app with no config file → loads defaults, starts normally.
2. Run app with valid existing config → loads correctly, no change.
3. Manually set `"version": 0` in the config JSON → app starts, loads as v0 (runs zero migrations), no crash.
4. Manually set `"version": 99` → app starts, loads with available fields, no crash, Debug log shows warning.
5. Delete the `"version"` line from the config → app starts as if version 1.

---

### SAVE-02 — Add backup-before-save

**Goal:**
Before every config save, copy the current config file to a backup. This gives the owner a one-step recovery point if a bad save overwrites settings they want to keep.

**Files likely affected:**
- `dashboard/ConfigManager.cs` — add backup step at the start of `Save()`

**Requirements:**
- At the start of `ConfigManager.Save()`, before the atomic write:
  1. Check if `dashboard.config.json` exists.
  2. If it does: copy it to `dashboard.config.backup.json` (overwrite any existing backup with `File.Copy(..., overwrite: true)`).
  3. If the copy fails for any reason (IOException, UnauthorizedAccessException): write a `Debug.WriteLine` warning but do NOT abort the save. The main save must still proceed.
- If `dashboard.config.json` does not exist (first-ever save): skip the backup step silently.
- The backup file is a plain copy — do not run it through any temp-file pattern. Backup file write is not atomic.
- Do not back up the backup itself.

**Acceptance criteria:**
- First save (no prior config): backup is not created, main config is written.
- Second save: backup contains the config from the first save.
- Third save: backup is overwritten and now contains the config from the second save.
- If backup write fails (simulate with a read-only file): save still completes, app keeps running.

**How to test:**
1. Delete both config files. Open builder, change business name to "Test 1", Save.
   - Verify: `dashboard.config.json` exists with "Test 1". No backup file.
2. Reopen builder, change to "Test 2", Save.
   - Verify: main config has "Test 2". Backup has "Test 1".
3. Reopen builder, change to "Test 3", Save.
   - Verify: main config has "Test 3". Backup has "Test 2".
4. Mark `dashboard.config.backup.json` as read-only, then save again.
   - Verify: main config saves successfully. No crash.

---

### SAVE-03 — Add backup recovery on load

**Goal:**
If the main config file fails to load (corrupt JSON, IO error, missing file), fall back to the backup file before using factory defaults. Prevents a single bad save from silently wiping the owner's entire configuration.

**Files likely affected:**
- `dashboard/ConfigManager.cs` — extend `Load()` with a three-level fallback chain

**Requirements:**
- New load chain (in order):
  1. Try loading `dashboard.config.json` → run version extraction and migration → deserialize.
  2. If step 1 fails for any reason: try `dashboard.config.backup.json` with the same pipeline (version extraction → migration → deserialize).
  3. If step 2 also fails: return `ConfigManager.GetDefaults()`.
- "Fails" means any of: file not found, JSON parse exception, IOException, UnauthorizedAccessException, or null deserialization result.
- If loaded from backup: write `Debug.WriteLine("dashboard config: loaded from backup — main config may be corrupt")`.
- If loaded from defaults: write `Debug.WriteLine("dashboard config: using factory defaults")`.
- Do not distinguish between a missing file and a corrupt file from the caller's perspective — both are silent fallbacks.

**Acceptance criteria:**
- Valid main config: loads main config (no change from before).
- Corrupt main config + valid backup: loads backup, app starts normally, no crash.
- Corrupt main + corrupt backup: loads defaults, app starts normally, no crash.
- Missing main + valid backup: loads backup (unusual but must work).
- Missing main + missing backup: loads defaults (existing behavior, unchanged).

**How to test:**
1. Save a config with business name "My Business".
2. Open `dashboard.config.json` in a text editor, delete a random `}`, save.
3. Restart the app. Verify it loads (from backup), no crash, business name shows correctly.
4. Now also corrupt `dashboard.config.backup.json` the same way.
5. Restart the app. Verify it loads factory defaults ("Business Hub"), no crash.

---

### SAVE-04 — Fix BuilderForm Save & Apply to persist working config

**Goal:**
Fix the critical bug where clicking "Save & Apply" closes the builder but never calls `ConfigManager.Save()`. All changes are currently discarded on close. After this task, the working config is written to disk before the dialog closes.

**Files likely affected:**
- `dashboard/BuilderForm.cs` — wire `ConfigManager.Save(_workingConfig)` into `CloseWith(DialogResult.OK)`

**Requirements:**
- Before closing the form with `DialogResult.OK`, the save path must:
  1. Force any focused TextBox to commit its current value. Call `this.ActiveControl?.Parent?.Focus()` or `ValidateChildren()` to trigger pending `Leave` events before reading `_workingConfig`. This ensures a user who types and immediately clicks Save without tabbing out does not lose their last edit.
  2. Set `_workingConfig.Version = MigrationRunner.CurrentSchemaVersion` so the saved file is always stamped with the current schema version.
  3. Call `ConfigManager.Save(_workingConfig)`.
  4. If `ConfigManager.Save()` throws: catch the exception, show a `MessageBox` with the error message, and do NOT close the form. Let the owner retry or cancel.
- `CloseWith(DialogResult.Cancel)` must NOT save anything. No change to cancel behavior.
- After the dialog closes with `DialogResult.OK`, `MainForm.OpenBuilder()` already calls `ConfigManager.Load()` and `ApplyConfig()` — no changes needed in MainForm.

**Acceptance criteria:**
- Change business name → Save → restart app → name persists.
- Change accent color → Save → restart app → color persists.
- Rename a pipeline stage → Save → restart app → stage name persists.
- Disable a module → Save → restart app → module is still disabled.
- Type in a TextBox, immediately click Save without tabbing out → edit is captured.
- Click Cancel after making changes → restart app → nothing changed.

**How to test:**
1. Open builder.
2. Change business name to "Sunrise Detailing".
3. Change lead stage "Won" to "Closed".
4. Change accent color to green.
5. Click Save & Apply. Verify dashboard immediately updates.
6. Close and reopen the app.
7. Verify all three changes are still present.
8. Open builder, make more changes, click Cancel.
9. Reopen app, verify step 7 values are unchanged.

---

### SAVE-05 — Add Reset to Defaults behavior

**Goal:**
Wire the "Reset to Defaults" button that currently exists in BuilderForm but is `Enabled = false`. After this task, clicking it prompts for confirmation, backs up the current config, writes factory defaults to disk, and reloads the dashboard.

**Files likely affected:**
- `dashboard/BuilderForm.cs` — enable the button and add its click handler

**Requirements:**
- Set `reset.Enabled = true`.
- On click: show a confirmation dialog:
  ```
  MessageBox.Show(
    "This will restore all settings to factory defaults.\nYour current settings will be backed up first.\n\nContinue?",
    "Reset to Defaults",
    MessageBoxButtons.YesNo,
    MessageBoxIcon.Warning
  )
  ```
- On **Yes**:
  1. Call `ConfigManager.Save(ConfigManager.GetDefaults())`.
     - This triggers the backup-before-save logic from SAVE-02, so the current config is backed up before being overwritten.
  2. Close the form with `DialogResult.OK`.
- On **No**: do nothing, leave the form open at its current tab.
- Do not touch `_workingConfig` during a reset — the reset bypasses the working copy entirely and writes defaults straight to disk.

**Acceptance criteria:**
- Click Reset to Defaults → confirmation dialog appears.
- Confirm → dashboard reloads with factory defaults (name "Business Hub", original colors, all four modules enabled, original pipeline stages).
- Decline → form stays open, nothing changes, working copy unchanged.
- After a confirmed reset, `dashboard.config.backup.json` contains the pre-reset config.
- If `ConfigManager.Save()` throws during reset: show error message, do not close form.

**How to test:**
1. Customize: rename business, change a color, rename a stage. Save.
2. Reopen builder, click Reset to Defaults, confirm.
3. Verify dashboard shows "Business Hub", original colors, original stage names.
4. Verify `dashboard.config.backup.json` has the customized settings.
5. Repeat, but click No on the confirmation. Verify nothing changed.

---

### SAVE-06 — Smoke test checklist

**Goal:**
Document and run a manual end-to-end checklist verifying the full save/load reliability flow after SAVE-01 through SAVE-05 are implemented. This is not an automated test — it is a runnable checklist to be executed once after all five tasks are complete.

**Files likely affected:**
- New file: `dashboard/SMOKE_TESTS.md`

**Requirements:**
Create `dashboard/SMOKE_TESTS.md` with the following checklist. Each item must have a pass/fail result column.

```
## Save/Load Reliability — Smoke Test Checklist

Run after SAVE-01 through SAVE-05 are complete.
Run from the compiled exe or `dotnet run`.

### Startup

[ ] App starts with no config file → loads factory defaults, no crash
[ ] App starts with valid config → loads saved values correctly
[ ] App starts after `--seed` flag → config and data both reset to defaults

### Save & Apply

[ ] Change business name in builder → Save → name appears in sidebar immediately
[ ] Change accent color → Save → color visible in dashboard immediately
[ ] Change a pipeline stage name → Save → stage name visible in status dropdowns
[ ] Disable a module → Save → module removed from sidebar immediately
[ ] Reorder modules → Save → sidebar reflects new order immediately
[ ] Type in a field, click Save without tabbing out → edit is captured
[ ] Cancel after changes → nothing saved, dashboard unchanged

### Persistence (restart required)

[ ] All changes from above "Save & Apply" section survive app restart
[ ] Cancel changes do not survive restart

### Backup

[ ] After first-ever Save: backup file does not exist
[ ] After second Save: backup contains the config from before the second save
[ ] After Reset to Defaults: backup contains the pre-reset config

### Backup Recovery

[ ] Corrupt main config JSON → restart → app loads from backup, no crash
[ ] Corrupt both config files → restart → app loads factory defaults, no crash
[ ] Delete main config → restart → app loads from backup if available, else defaults

### Reset to Defaults

[ ] Click Reset, confirm → dashboard returns to factory defaults
[ ] Click Reset, cancel → nothing changes, builder stays open
[ ] After reset, backup file contains pre-reset config

### Version Safety

[ ] Manually set "version": 0 in config → app loads, no crash
[ ] Manually set "version": 99 → app loads with available fields, no crash
[ ] Remove "version" field entirely → app loads as v1, no crash
```

**Acceptance criteria:**
- All checklist items pass.
- Any item that fails becomes a new bug task with the failing behavior described.

**How to test:**
Run each item in the checklist sequentially. Record pass/fail. File a task for any failure.

---

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
