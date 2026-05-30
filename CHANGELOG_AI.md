# CHANGELOG_AI.md

## [2026-05-30] - Appointment calendar details and time picker

### Added
- `Database.cs` and `Models.cs`: added a local appointment address field with a safe SQLite column add for existing databases.
- `CalendarMonthView.cs`: appointment chips now show a hover tooltip with customer, date/time, service, phone, address, status, and notes when available.

### Changed
- `FieldDialog.cs`: appointment time now uses an up/down time selector instead of free typing.
- `MainForm.cs`: appointment forms include address, appointment cards include address in their subtitle, and the sidebar logo uses a larger cover-fill image area.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No Twilio, Supabase, auth, payments, AI, customer messaging, or external backend integrations were implemented.

## [2026-05-29] - Premium dialogs and appointment calendar

### Added
- `CalendarMonthView.cs`: added an Outlook-style month calendar control with appointment chips, month navigation, and double-click day selection.
- `CardListPage.cs` and `MainForm.cs`: added Calendar/List view switching on the Appointments page and wired appointment records into the calendar display.
- `FieldDialog.cs`: added real `DateTimePicker` calendar selection for date fields.

### Changed
- `FieldDialog.cs`: refreshed add/edit dialogs with a more rounded bordered shell and softer input styling.
- `MainForm.cs`: Appointment, Message, and Quote date fields now use calendar-backed date pickers.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No Twilio, Supabase, auth, payments, AI, customer messaging, or external backend integrations were implemented.

## [2026-05-29] - Status badge text cleanup

### Fixed
- `EntityCard.cs`: removed the literal trailing `v` from clickable status badges while preserving status menu click behavior.

### Notes
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Persistent brand header layout

### Changed
- `MainForm.cs`: added a persistent centered brand header above the main dashboard content so the business name remains stable across modules.
- `MainForm.cs`: changed the sidebar brand block to focus on a larger logo only, avoiding cramped brand-name text at narrow sidebar widths.
- `CardListPage.cs`: increased page header spacing and title bounds so page names like Messages no longer clip.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Narrow sidebar layout polish

### Changed
- `MainForm.cs`: made the sidebar brand block responsive at minimum width, with a larger logo and company-name-only compact layout.
- `NavItem.cs`: adjusted sidebar nav label and badge spacing so labels like Messages no longer collide or truncate unnecessarily.
- `CardListPage.cs`: gave page headers more vertical space and responsive title/count widths to prevent the Messages count from overlapping the title.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Startup splitter crash fix

### Fixed
- `MainForm.cs`: fixed startup crash caused by applying `SplitContainer` minimum panel sizes before the splitter had a valid width.
- `MainForm.cs`: added safe sidebar splitter clamping so the dashboard can launch and still keep the sidebar resizable.
- `MainForm.cs`: removed unsafe constructor-time `BeginInvoke` and moved initial splitter setup to handle/layout events.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Builder border and interaction polish

### Changed
- `BuilderForm.cs`: added a real outer modal frame so the Customize Dashboard window no longer blends into the background.
- `BuilderForm.cs`: added smoother drag/drop feedback for Modules and Pipeline rows with rounded drop-target highlighting while keeping arrow buttons as fallback.
- `UiKit.cs` and `MainForm.cs`: added a rounded status menu renderer for card status dropdowns.

### Notes
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Builder polish and editable status badges

### Changed
- `BuilderForm.cs`: polished the Customize Dashboard modal with rounded window edges, a rounded content surface, tighter spacing, and drag handles for module and pipeline row reordering while keeping the existing arrow controls as fallback.
- `EntityCard.cs`: made configured status badges clickable and hoverable so dashboard records can open a status menu directly from the card.
- `MainForm.cs`: wired Lead, Appointment, and Quote card status menus to configured `DashboardConfig` pipeline stages and saved selected stage IDs back to the existing local data store.
- `MainForm.cs`: status badge colors now come from configured pipeline stage colors, with `Ui.StatusColor()` kept as a fallback for unknown legacy statuses.
- `MainForm.cs`: fixed a WinForms `ContextMenuStrip` disposal crash after selecting a card status.

### Notes
- No backend services, Twilio, Supabase, auth, payments, AI, customer messaging, export/import, backups, theme presets, or unrelated roadmap items were implemented.

## [2026-05-29] - Demo readiness polish D3-D6

### Changed
- `BuilderForm.cs`: enabled Reset to Defaults with confirmation, default config save, OK reload path, and graceful error handling.
- `BuilderForm.cs`: removed the Stage ID column from the Pipeline tab while preserving internal stage IDs.
- `BuilderForm.cs`: replaced raw Up/Down/Delete controls in Modules and Pipeline with cleaner compact icon buttons.
- `BuilderForm.cs`: added visible Save & Apply success feedback after a successful config save.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- MigrationRunner, backup logic, export/import, drag-and-drop, theme presets, backend integrations, Twilio, auth, payments, messaging, and AI features were not implemented.

## [2026-05-29] - BUILDER-10 Branding tab

### Added
- `DashboardConfig.cs`: added extended branding fields for tagline, contact info, brand colors, and logo path.
- `BuilderForm.cs`: implemented the Branding tab with identity fields, contact fields, brand color pickers, logo browsing, clearing, and preview.
- `MainForm.cs`: sidebar branding now attempts to render a configured logo and falls back safely when the file is missing or unreadable.

### Changed
- `ConfigManager.cs`: default branding now includes primary and secondary brand colors.
- `BuilderForm.cs`: working-copy cloning now carries all branding fields so Cancel still discards unsaved changes.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- MigrationRunner, backups, Reset to Defaults, theme presets, backend integration, SMS features, and later builder tasks were not implemented.

## [2026-05-29] - D1 Save & Apply persistence fix

### Changed
- `BuilderForm.cs`: wired `Save & Apply` to commit pending edits and save the working-copy `DashboardConfig` through `ConfigManager.Save()`.
- Existing `MainForm` behavior reloads the saved config with `ConfigManager.Load()` after the builder closes with `DialogResult.OK`.

### Notes
- Verified with `dotnet build .\dashboard\BusinessDashboard.csproj` and `dotnet run --project .\dashboard\BusinessDashboard.csproj`.
- Reset to Defaults, Branding, backup/migration behavior, backend work, provider integrations, auth, payments, and customer messaging were not implemented.

## [2026-05-29] - Clickable home + contact links + popups actually resize

### Fixed — popups now truly resize
- The borderless popups never received edge hit-tests because the content panel covered the whole form. Exposed a 6px border-colour **`Padding` ring** (`InfoPopupForm`, `FieldDialog`) so the form surface is hittable at the edges — combined with the existing `WndProc` hit-testing, the dialogs now resize from any edge/corner.

### Added — Home page is now fully interactive
- **Metric cards are clickable** → navigate to that tab. `MetricCard` raises `Clicked`; `HomePage.MetricClicked` passes the module id; `MainForm.NavigateTo(id)` selects the matching nav item/page. Cards show a hover lift.
- **Needs-attention cards open on single click.** Lead and appointment attention cards gained `onActivate` (messages already had it) — click any item to view/edit it without leaving Home.
- **Contact line links are usable.** The Home contact line is now a `LinkLabel`: the email opens a `mailto:` and the website opens in the browser (`https://` prepended if missing). Phone stays plain text. `SetIdentity` now takes phone/email/website separately and builds the link regions.

### Notes
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Fix Home greeting band overlap (DPI-safe stacking)

### Fixed — `dashboard/HomePage.cs`
- The greeting title, date/tagline line, and contact line could overlap (worse at higher display scaling) because they used fixed pixel heights while the 21pt title rendered taller. Replaced the absolutely-positioned fixed-height labels with **AutoSize labels in a top-down `FlowLayoutPanel`**, and made the greeting row `AutoSize`. The lines now stack by their natural height + margins and can't overlap at any DPI. Title trimmed 21→20pt.

### Notes
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Resizable dialogs, auto-hide scrollbars, click-to-view quotes

### Added
- **Click a quote to view all its details.** Quote cards gained `onActivate`; `MainForm.OpenQuote(id)` shows a popup with Service, Amount, Phone, Status, and Notes (single-click to view; edit via the ✎ icon — same pattern as messages).
- Generalised the message reader into **`InfoPopupForm`** (title + meta + body), now reused for both messages and quotes. Removed `MessageReaderForm.cs`.

### Changed
- **`FieldDialog` is now resizable** (edge/corner drag, `MinimumSize` 380×300, bottom-right grip). Field inputs widen to fill the dialog as it grows (`ResizeFields`).
- **Scrollbars only show when needed.** The dialog's multiline Notes field and the info popup body now use a `RichTextBox` (`ScrollBars = Vertical`), which auto-hides the scrollbar unless the text actually overflows — fixes the always-visible scrollbar on short content.
- `InfoPopupForm` carries the same resize/grip behaviour as the former message reader.

### Notes
- The big "Customize Dashboard" builder modal is intentionally left fixed-size for now (dense absolute layout); say the word if you want it resizable too.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Calendar: click-to-edit chips + new Week view with time axis

### Added
- **Click a calendar appointment to edit it.** `CalendarItem` now carries the source `Id`; `CalendarMonthView` and the new week view raise `ItemClicked`, which `CardListPage` forwards as `CalendarItemClicked`. `MainForm.OpenAppointment(id)` opens the edit dialog for the clicked chip.
- **New `CalendarWeekView`** (`dashboard/CalendarWeekView.cs`): a 7-day week with an **hourly time axis (7 AM–7 PM)** on the left. Appointment chips are positioned vertically to **correlate with their parsed start time** on the axis, with simple per-day overlap nudging. Prev/next week navigation, today highlight, click-to-edit, and double-click-day-to-add.
- **List / Month / Week toggle** on the Appointments page. `CardListPage` view mode is now a 3-state enum (`List`/`Month`/`Week`) hosting both calendar views; toggles appear when the header is wide enough (≥820px).

### Changed
- Month view hint updated to "Double-click a day to add • click an appointment to edit"; clicking a chip in the month view now edits it.

### Notes
- Time parsing uses `DateTime.TryParse` on the appointment's time string; unparseable times stack at the top of the day column.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Message reader is resizable + taller default

### Changed — `dashboard/MessageReaderForm.cs`
- The reader bubble is now **user-resizable**: added a `WndProc` override that reports edge/corner hit zones (`HTLEFT`/`RIGHT`/`TOP`/`BOTTOM` + corners) so the borderless rounded window can be dragged from any edge. Added a subtle three-dot resize grip in the bottom-right corner.
- Taller, more readable default (min body height 170, up to 420) and a `MinimumSize` of 360×240 so short messages are fully visible without resizing.
- Fully-qualified `System.Windows.Forms.Message` in `WndProc` (this namespace also defines a `Message` model class).

### Notes
- The content text box (`Dock=Fill`) grows with the window, so enlarging the bubble reveals the full message; the rounded region re-applies live during resize.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Live home metrics + message reader + message status dropdown

### Fixed
- **Home metrics were stale** (showed 0 while tabs had data). `MainForm.Select()` now calls `RefreshHome()` whenever Home is opened, so the metric cards always reflect current data. Counts also use a new robust `IsStage()` helper that resolves a stored status to its stage id (handles id-vs-label storage).

### Added
- **Click a message to read it.** `EntityCard` gained an optional `onActivate` (single-click on the card body). Message cards now open a new **`MessageReaderForm`** — a rounded read-only bubble showing sender, channel · date · phone, and the full message text. On close, an unread message is **automatically marked Read** (status → `read`), then the list, sidebar badge, and Home all refresh.
- **Message status dropdown.** Messages are now config-driven like Quotes/Leads: a new `messages` pipeline (Unread / Read / Replied / Archived, with colors) was added to `ConfigManager` defaults. The message status badge is clickable and opens the same rounded status menu as the other tabs; the edit dialog's Status field is config-driven; stored values use stable stage ids.

### Changed
- Sidebar unread badge and Home "Unread messages" metric now detect unread via `IsStage("messages", …, "unread")` instead of an exact `== "Unread"` string match.

### Notes
- Existing saved configs without a `messages` pipeline fall back to defaults automatically (no reset required); resetting also makes Messages editable in the builder's Pipeline tab.
- Home metrics are intentionally "today/actionable" (new leads, unread, pending quotes, appointments *today*) — these may differ from the sidebar's total counts by design.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Fixes: swatch sizing, button ampersand, home overlap + branding surfaced

### Fixed
- **`UiKit.cs` (PillButton):** added `TextFormatFlags.NoPrefix` so `&` renders literally. "Save & Apply" no longer shows as "Save _Apply" (the `&` was being eaten as a Windows mnemonic and underlining the following space).
- **`BuilderForm.cs` (AddThemeRow):** color swatches are now a fixed 72×28 centred via `Anchor.None` instead of `Dock.Fill`. Primary, Secondary, and all Appearance swatches now render pixel-identical regardless of each tab's row height (previously they could differ).
- **`HomePage.cs` (MetricCard):** reworked the metric card layout — value font 23→21, taller value rect, label moved down, card height 96→100 — so the big number no longer clips at the bottom and nothing overlaps the icon chip.

### Added
- **Branding now appears in the app.** `HomePage.SetIdentity(tagline, contact)` surfaces the Tagline next to the date in the greeting band and a combined Phone · Email · Website line beneath it. `MainForm.RefreshHome()` feeds these from `config.Branding`.
  - Full branding visibility map: Business Name → window title + persistent header; Sidebar Subtitle → sidebar; Logo + Primary/Secondary colours → sidebar logo block; Tagline + Phone/Email/Website → Home greeting band.

### Notes
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-16/17 pipeline funnel preview + redesigned empty states

### Changed — `dashboard/CardListPage.cs`
- Replaced the plain centered grey "No X yet" label with a new **`EmptyStatePanel`**: a soft accent icon circle (drawn vector icon), a headline, a subline, and a primary action button wired to the page's Add action. Empty screens now feel intentional instead of abandoned.

### Changed — `dashboard/BuilderForm.cs`
- Added a **`PipelinePreviewStrip`** above the stage editor: the current pipeline rendered as connected colour pills (`New › Contacted › Quoted › Won`) so the owner sees their funnel at a glance.
- `PickStageColor` now re-renders the pipeline tab so the preview strip reflects colour changes immediately (add/delete/reorder already re-rendered).

### Notes
- Both are visual-only; no data, config schema, or behaviour changed.
- Heavy timer-driven motion (UI-14/15) intentionally deferred — it's the one area that risks visible jank without runtime testing, and card/nav hover already repaints responsively.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-10..13 "Today" home page (overview as default landing)

### Added — `dashboard/HomePage.cs`
- New `HomePage` overview screen: time-aware greeting + date band, a row of metric cards, and a "NEEDS ATTENTION" list. Reads **no new data** — populated by `MainForm.RefreshHome()` from existing SQLite tables.
- New `MetricCard` painted control: big value, label, and a soft accent icon chip (same shadow/surface language as `EntityCard`).

### Changed — `dashboard/MainForm.cs`
- Generalised the page/route model from `CardListPage` to `Control` (`_navRoutes`, `Select`, `PageFor`, `NewNav`) so non-list pages can be hosted.
- Added `home` as a first-class module: `KnownModuleIds` now leads with `"home"`; `DefaultModule("home")` added and the other modules' default orders bumped (leads 1, appts 2, messages 3, quotes 4).
- `BuildPages` builds `HomePage` for the `home` module; `PageFor`/`SetNavFor` handle it; `_homePage`/`_navHome` fields added and reset in `RebuildLayout`.
- Added `RefreshHome()`: computes 4 metrics (new leads, unread messages, pending quotes, today's appointments) and builds up to 6 attention cards (new leads + unread messages + today's appointments). Cards reuse `EntityCard`; edit/delete route through existing dialogs + `RefreshAll`.
- `RefreshAll()` now also refreshes Home.

### Changed — `dashboard/ConfigManager.cs`
- `GetDefaults().Modules` includes the Home module at order 0 (others bumped). Existing saved configs without `home` still get it via `GetActiveModules` fallback, so Home appears for everyone and is the default landing screen.

### Notes
- Home is a normal configurable module — it can be renamed, reordered, or disabled in the builder like any other.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-04 card redesign (soft surfaces, status edge, calm rows)

### Changed — `dashboard/EntityCard.cs`
- **Removed the hard border** → replaced with a layered translucent **soft drop shadow** (3 offset rounded rects) + a whisper `Ui.Hairline` outline. Cards now read as surfaces, not spreadsheet cells.
- **Hover lift:** surface changes to `Ui.SurfaceAlt` and the shadow deepens on hover.
- **Status-coloured 3px left edge** added — the card's single source of colour/meaning.
- **Rainbow avatar removed** (folds in UI-05): the monogram chip is now a calm neutral `#EDEFF3` with `Ui.TextBody` initials instead of 1-of-8 saturated hues.
- **Status badge restyled:** soft `Ui.Soft()` fill, a 7px status **dot** before the label, no hard border (start of UI-06).
- **Edit/delete icons hidden until hover** — rows are calm at rest; actions fade in only when hovering the card.
- **Typography:** title bumped to 12pt and recoloured to `Ui.TextStrong`; subtitle stays muted.

### Notes
- Card height and the `Gap`/Dock-Top stacking model are unchanged, so list layout/scroll behaviour is identical.
- Status badge remains click-to-change (`onStatusClick` unchanged); hit-testing is unaffected because hovering is guaranteed before any click.
- Emoji action glyphs (✎ 🗑) are retained for now — a drawn icon set is the separate UI-07 task.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - UI-01 palette rework (calm/premium foundation)

### Changed — `dashboard/UiKit.cs`
- Reworked the `Ui` palette from saturated slate-navy + loud blue to a calm, premium system:
  - **Chrome desaturated to graphite:** `SidebarBg` 24,33,54 → 22,24,29; `SidebarHover`/`SidebarActive` retuned to graphite tints.
  - **Accent → calm indigo:** 56,132,255 → 91,91,214.
  - **Canvas → soft warm-grey:** `ContentBg` 243,245,249 → 246,247,249.
  - **Borders softened:** `CardBorder` 226,231,238 → 236,238,242 (now an alias of new `Hairline`).
  - **Text neutralised:** `TextDark` 28,37,56 → 30,32,38; `TextMuted` 120,132,153 → 138,144,156.
  - **Semantic colours calmed:** Success/Warning/Danger/Info retuned to less-shouty hues (status meaning only).
- Added new tokens (all additive, no existing name removed): `SurfaceAlt`, `Hairline`, `TextStrong`, `TextBody`, and `-Soft` tint variants `AccentSoft`/`SuccessSoft`/`WarningSoft`/`DangerSoft`/`InfoSoft`.
- Added `Ui.Soft(Color, alpha)` helper for translucent badge/chip fills from arbitrary (configured) colours.

### Changed — `dashboard/ConfigManager.cs`
- `GetDefaults().Theme` updated to match the new chrome (`#16181D` sidebar, `#5B5BD6` accent, `#F6F7F9` canvas) so a fresh install / Reset to Defaults reflects the new palette.

### Notes
- First task of the premium-UI redesign roadmap. Palette/token foundation only — no layout, card, or sidebar structure changed yet.
- Cards, text, borders, surfaces, and status colours re-theme immediately.
- Sidebar background + accent are overridden by any *saved* `dashboard.config.json`, so an existing config keeps its current chrome until the owner clicks **Reset to Defaults** (or a fresh config is created).
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - Appearance/Branding pickers, resizable sidebar, logo, Codex docs

### Changed — `dashboard/BuilderForm.cs`
- `AddThemeRow`: replaced flat `Button picker` with `ColorSwatchButton swatch` — Appearance and Branding color pickers now use the same rounded custom-painted swatch as Pipeline stages.
- `PickThemeColor`: updated parameter from `Button` to `ColorSwatchButton`; sets `SwatchColor + Invalidate()`.
- `UpdateThemeColor`: updated parameter from `Button` to `ColorSwatchButton`; reads previous color from `ColorToHex(swatch.SwatchColor)`.
- Added file-level architecture comment explaining the builder's tab structure, save flow, and inner control class map (for Codex).

### Changed — `dashboard/MainForm.cs`
- `RebuildLayout()`: replaced `TableLayoutPanel` 2-column fixed layout with `SplitContainer`. Owner can now drag the divider to resize the sidebar. `Panel1MinSize = 180`, `Panel2MinSize = 480`, default split at 232px. Splitter track color matches `Ui.SidebarBg`.
- `BuildSidebar()`: brand block height increased from 78 → 96 px. Logo size increased from 36×36 → 54×54. Logo is vertically centred in the block. Business name now uses `TextFormatFlags.WordBreak` so long names wrap to 2 lines instead of truncating. All text x/width values are computed from `brand.Width` dynamically — adapts when the owner resizes the sidebar. Added `brand.Resize` handler to repaint on width change.
- Added file-level architecture comment explaining layout, config-driven rendering, and pipeline/status helper methods (for Codex).

### Changed — documentation (Codex-targeted)
- `DashboardConfig.cs`: full XML doc comments on every class and property; architecture rules block explaining Id/Label stability contract and schema migration policy.
- `ConfigManager.cs`: file-level comment explaining Load/Save/GetDefaults contract and file locations.
- `Models.cs`: file-level comment explaining status ID storage rule and DB layer boundary.
- `Program.cs`: file-level comment explaining startup order and `--seed` flag.
- `UiKit.cs`: file-level comment explaining mutable colours, StatusColor fallback chain, RoundedRect disposal, and UserPaint pattern.
- `EntityCard.cs`: file-level comment explaining paint-only rendering, statusColor/onStatusClick parameters, and double-click behaviour.
- `CardListPage.cs`: file-level comment explaining config-driven construction, SetCards contract, and empty-state behaviour.

### Notes
- No backend, Twilio, Supabase, auth, payments, or messaging touched.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - GUI visual fixes — corner artifacts, color swatches, pipeline header

### Fixed — `dashboard/BuilderForm.cs`

**Root cause of right-side row artifacts:**
All custom-painted controls (`BuilderDropRow`, `BuilderSurfacePanel`, `ToggleSwitch`) that use `UserPaint` + `AntiAlias` were drawing only inside a rounded path — leaving the 4 corner pixels outside the rounded rect with undefined/dark buffer content. Anti-aliasing then blended the rounded edge against that dark fringe, producing the visible line on the right side of every row.

- `BuilderDropRow.OnPaintBackground`: now flood-fills `ClientRectangle` with white before drawing the rounded card. Removed the `Color.Transparent` border pen (GDI+ artifact risk) — replaced with `Color.FromArgb(18, 0, 0, 0)` at rest (subtle shadow border) and explicit `Pen(Ui.Accent)` on drag-over. Inset rect by 1px so the border renders fully within bounds.
- `BuilderSurfacePanel.OnPaint`: flood-fills `ClientRectangle` with `Ui.ContentBg` before drawing the white rounded card — corners now blend into the surrounding gray correctly.
- `ToggleSwitch.OnPaint`: flood-fills `ClientRectangle` with white before drawing the pill — eliminates corner dark-fringe artifact.

**`move` FlowLayoutPanel transparency:**
- Both `BuildModuleRow` and `BuildStageRow`: changed `move` FlowLayoutPanel `BackColor` from `Color.Transparent` to `Color.White`. `Color.Transparent` on a child of a `UserPaint` parent doesn't reliably show the parent's rendered background, causing subtle compositing artifacts on the right side of rows.

**Pipeline color swatches:**
- Added `ColorSwatchButton` inner class: custom-painted rounded color swatch. Fills full bounds with white first, draws a rounded rect filled with `SwatchColor`, subtle semi-transparent border, and a `✎` pencil glyph on hover to signal it's clickable. Replaces the rectangular `FlatStyle.Flat` system `Button`.
- `BuildStageRow`: replaced `Button` with `ColorSwatchButton`. Updated margin to `(4, 10, 10, 10)` for proper vertical centering.
- `PickStageColor`: updated parameter from `Button` to `ColorSwatchButton`; sets `swatch.SwatchColor` and `Invalidate()` instead of `BackColor`.

**Pipeline header "Remove" → "Del":**
- `BuildPipelineHeader`: changed column 4 header from `"Remove"` to `"Del"` — was being truncated to "Remov" at the column width.
- `AddPipelineColumns`: widened Color column (78→72), narrowed Del column (70→52) — Del is shorter text, Color swatch no longer needs full width button.

### Notes
- No architecture changes. `DashboardConfig` unchanged. No backend, Twilio, Supabase, auth, or messaging touched.
- Build: 0 C# warnings, 0 C# errors.

## [2026-05-29] - GUI premium polish — toggles, styled inputs

### Added — `dashboard/BuilderForm.cs`
- `ToggleSwitch` inner class: fully custom-painted pill-style on/off toggle. Replaces `CheckBox` in every module row. On state = Accent blue with white knob right; Off state = gray with white knob left. Hover darkens/lightens the track slightly.
- `StyledInputPanel` inner class: wraps a borderless `TextBox` inside a custom-painted rounded panel. On focus, border turns `Ui.Accent` (1.8 px); at rest, `Ui.CardBorder` (1 px). Inner TextBox is vertically centered in the panel. Click anywhere on the panel to focus the input.

### Changed — `dashboard/BuilderForm.cs`
- `BuildModuleRow`: replaced `CheckBox` with `ToggleSwitch`; replaced both `TextBox` name/add-button fields with `StyledInputPanel`. Event handlers attach to `StyledInputPanel.Inner` (the raw `TextBox`), so all save/validation logic is unchanged.
- `BuildStageRow`: replaced stage-label `TextBox` with `StyledInputPanel`.
- `AddBrandingTextRow`: replaced `TextBox` with `StyledInputPanel` — all Identity and Contact fields in the Branding tab now use the styled input.
- `AddThemeRow`: replaced hex `TextBox` with `StyledInputPanel` — Appearance and Brand Color hex fields now use the styled input.
- `BuildModuleHeader`: "Add button" → "Button label" column header.

### Notes
- No architecture changes. `DashboardConfig` is unchanged. No backend, Twilio, Supabase, auth, payments, or messaging was touched.
- Build confirmed clean: 0 C# warnings, 0 C# errors.

## [2026-05-29] - GUI polish pass

### Changed
- `dashboard/FieldDialog.cs`:
  - Added `using System.Drawing.Drawing2D`.
  - Added `ModalRadius = 12` and `ModalBorderColor = Color.FromArgb(132, 146, 170)` constants.
  - Added `ApplyRoundedRegion()` method; called in constructor after `ClientSize` is set and in `OnResize` override.
  - Updated `OnPaint` to draw a 2 px anti-aliased rounded border (replaces the old flat `CardBorder` rectangle). Add/edit dialogs now match the `BuilderForm` modal visual style.

- `dashboard/BuilderForm.cs`:
  - `BuildHeader`: changed close button `Text = "X"` to `Text = "✕"` to match `FieldDialog`.
  - `SaveAndApply`: removed the success `MessageBox.Show(...)` — the dashboard re-rendering immediately after close is the confirmation; errors still show a `MessageBox`.
  - `BuilderTabButton`: expanded from a simple `Active` auto-property to a full interactive control:
    - `Active` setter now calls `UpdateBackColor()` and `Invalidate()`.
    - Added `_hover` field, `OnMouseEnter`, `OnMouseLeave` overrides.
    - Added `UpdateBackColor()`: active → white background; hover → light accent tint `(231, 238, 252)`; default → `Ui.ContentBg`.
    - Updated `OnPaint` to adjust `ForeColor` across active/hover/default states (darker text on hover, `Ui.TextDark` when active).

### Notes
- No architecture changes. `DashboardConfig` remains the source of truth. No backend, Twilio, Supabase, auth, payments, or messaging was touched.
- Build confirmed clean: 0 C# warnings, 0 C# errors.
- The running app must be closed before `dotnet run` picks up the new exe (file was locked during build verification — expected).

## [2026-05-29] - Save/Load Reliability Tasks added

### Added
- `TASKS.md`: new **Save/Load Reliability Tasks** section with 6 Codex-ready tasks (SAVE-01 through SAVE-06).

### Task summary

| ID | Task | Files affected |
|---|---|---|
| SAVE-01 | Add `MigrationRunner` with `CurrentSchemaVersion = 1`; wire version extraction into `ConfigManager.Load()` | `ConfigManager.cs`, new `MigrationRunner.cs` |
| SAVE-02 | Backup current config to `.backup.json` before every save | `ConfigManager.cs` |
| SAVE-03 | Extend `Load()` with three-level fallback: main → backup → defaults | `ConfigManager.cs` |
| SAVE-04 | Fix critical bug: call `ConfigManager.Save(_workingConfig)` in `BuilderForm` Save & Apply | `BuilderForm.cs` |
| SAVE-05 | Enable Reset to Defaults button; confirmation → save defaults → reload | `BuilderForm.cs` |
| SAVE-06 | Create `dashboard/SMOKE_TESTS.md` with full manual end-to-end checklist | New `SMOKE_TESTS.md` |

### Notes
- No code was changed. Planning pass only.
- SAVE-04 is the highest-priority fix: the builder currently discards all changes on save.
- Correct implementation order: SAVE-01 → SAVE-02 → SAVE-03 → SAVE-04 → SAVE-05 → SAVE-06.
- SAVE-02 must exist before SAVE-05 so Reset to Defaults automatically backs up before overwriting.

## [2026-05-29] - BUILDER-09 Appearance tab editor

### Added
- `BuilderForm.cs`: implemented the Appearance tab against the working-copy `DashboardConfig`.
- `BuilderForm.cs`: added hex text boxes and color picker buttons for accent color, sidebar background, and content background.

### Notes
- Appearance tab edits are in-memory only and are not persisted yet.
- The current `DashboardConfig.Theme` model only supports accent, sidebar background, and content background, so card color, text color, radius, spacing, and theme mode were not added.
- Branding editing, save/apply persistence, drag-and-drop, backend changes, provider integrations, auth, payments, and message sending were not implemented.

## [2026-05-29] - BUILDER-08 Pipeline tab editor

### Added
- `BuilderForm.cs`: implemented the Pipeline tab against the working-copy `DashboardConfig`.
- `BuilderForm.cs`: added pipeline selection, stage order display, stage ID display, editable stage labels, color picker buttons, and up/down stage reordering.
- `BuilderForm.cs`: added in-memory add/delete stage controls from the BUILDER-08 task.

### Notes
- Pipeline tab edits are in-memory only and are not persisted yet.
- Existing dashboard status dropdowns continue to use `DashboardConfig` pipeline stages.
- Card badge color routing still uses the existing `Ui.StatusColor()` behavior and should be handled in a future task if stage colors need to render on dashboard cards.
- Save/load, drag-and-drop, appearance editing, branding editing, backend changes, provider integrations, auth, payments, and message sending were not implemented.

## [2026-05-29] - BUILDER-07 Modules tab working copy

### Added
- `BuilderForm.cs`: added a cloned working-copy `DashboardConfig` so builder edits do not mutate the live dashboard config.
- `BuilderForm.cs`: implemented the Modules tab with module order, enabled toggle, editable module name, editable add-button label, and up/down reorder controls.
- `BuilderForm.cs`: added named panels for Modules, Pipeline, Appearance, and Branding tabs.

### Notes
- Module tab edits are in-memory only and are not persisted yet.
- Save/load, drag-and-drop, pipeline editing, appearance editing, branding editing, validation-on-save, backend changes, provider integrations, auth, payments, and message sending were not implemented.

## [2026-05-29] - BUILDER-05/06 Customize entry point and builder shell

### Added
- `MainForm.cs`: added a sidebar `Customize` entry point that opens the dashboard builder dialog.
- `BuilderForm.cs`: added a modal shell with header, Modules/Pipeline/Appearance/Branding tab selectors, empty content panels, and footer controls.

### Notes
- `Save & Apply` closes the shell with `DialogResult.OK`; `MainForm` then reloads the existing local config and reapplies it.
- `Reset to Defaults` is present but disabled because reset/save behavior is deferred to later builder tasks.
- No tab content, module editing, pipeline editing, appearance editing, branding editing, database changes, backend changes, provider integrations, auth, payments, or message sending.

## [2026-05-29] - BUILDER-04 config-driven status dropdowns

### Changed
- `MainForm.cs`: Lead, Appointment, and Quote status dropdowns now use pipeline stages from `DashboardConfig`.
- Status values saved from those dialogs now prefer stable stage IDs instead of display labels.
- Cards and edit dialogs map stored stage IDs back to current configured labels for display.

### Notes
- Added centralized helpers for pipeline stage lookup, label display, label-to-ID conversion, and ID-to-label compatibility.
- Existing records that stored old labels such as `Won`, `Scheduled`, or `Pending` continue to display through compatibility mapping.
- No builder form, customize entry point, backend changes, provider integrations, auth, payments, or message sending.

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
