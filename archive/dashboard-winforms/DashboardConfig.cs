namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// DashboardConfig — the owner-facing no-code customisation model.
//
// This is the SINGLE SOURCE OF TRUTH for every visual and workflow setting
// the admin can change without editing code.  It is serialised to:
//   %LOCALAPPDATA%\BusinessDashboard\dashboard.config.json
//
// Architecture rules (for Codex):
//  • Never hardcode display names, stage lists, or colours in UI code.
//    Always read from DashboardConfig (loaded via ConfigManager).
//  • Id fields (ModuleConfig.Id, StageConfig.Id) are STABLE internal keys.
//    They are stored in the SQLite database and must NEVER change once created.
//    Only Label/Color are editable display values.
//  • Adding a new optional field is safe without a schema migration because
//    System.Text.Json leaves missing fields at their C# default value.
//    Only destructive changes (renames, removals, type changes) need a
//    MigrationRunner entry and a Version bump.
// ---------------------------------------------------------------------------

/// <summary>
/// Root configuration object for the dashboard builder.
/// Loaded on startup by ConfigManager.Load() and passed into MainForm.
/// Written by BuilderForm after Save &amp; Apply.
/// </summary>
public class DashboardConfig
{
    /// <summary>Schema version. Increment only when a migration is required.</summary>
    public int Version { get; set; } = 1;

    /// <summary>Business identity, contact info, logo path, and brand colours.</summary>
    public BrandingConfig Branding { get; set; } = new();

    /// <summary>
    /// Dashboard UI colours (sidebar, accent, content background).
    /// Applied to Ui.SidebarBg / Ui.Accent / Ui.ContentBg via Ui.ApplyTheme().
    /// </summary>
    public ThemeConfig Theme { get; set; } = new();

    /// <summary>
    /// Ordered list of nav modules (Leads, Appointments, Messages, Quotes).
    /// Disabled modules are excluded from the sidebar at startup.
    /// </summary>
    public List<ModuleConfig> Modules { get; set; } = new();

    /// <summary>
    /// Status-stage definitions keyed by module Id ("leads", "appointments", "quotes").
    /// MainForm reads these to populate FieldDialog status dropdowns and
    /// EntityCard badge colours. Status IDs are stored in SQLite; Labels are display-only.
    /// </summary>
    public Dictionary<string, PipelineConfig> Pipelines { get; set; } = new();
}

/// <summary>
/// Business identity and customer-facing contact information.
/// Most fields are stored now and consumed by the backend / SMS templates later.
/// </summary>
public class BrandingConfig
{
    /// <summary>Shown in the sidebar header and window title bar.</summary>
    public string BusinessName { get; set; } = "";

    /// <summary>Shown below the business name in the sidebar (e.g. "Owner Dashboard").</summary>
    public string DashboardSubtitle { get; set; } = "";

    /// <summary>Customer-facing tagline. Reserved for future SMS / web-page templates.</summary>
    public string Tagline { get; set; } = "";

    /// <summary>Business phone. Used in auto-text templates when Twilio is connected.</summary>
    public string Phone { get; set; } = "";

    /// <summary>Business email. Optional. Validated loosely (must contain @) on save.</summary>
    public string Email { get; set; } = "";

    /// <summary>Business website. Stored as entered; no protocol enforcement.</summary>
    public string Website { get; set; } = "";

    /// <summary>
    /// Primary brand identity colour as a hex string (e.g. "#3884FF").
    /// Used in the sidebar logo gradient. NOT the same as ThemeConfig.Accent
    /// (which controls dashboard UI chrome). Reserved for customer-facing use.
    /// </summary>
    public string PrimaryColor { get; set; } = "";

    /// <summary>Secondary brand colour. Used in the sidebar logo gradient.</summary>
    public string SecondaryColor { get; set; } = "";

    /// <summary>
    /// Absolute path to the logo image file (.png/.jpg/.bmp).
    /// Empty = show the default "B" gradient block in the sidebar.
    /// If the file is missing at runtime, falls back to gradient silently.
    /// </summary>
    public string LogoPath { get; set; } = "";
}

/// <summary>
/// Controls the three mutable Ui colour fields.
/// Applied at startup via Ui.ApplyTheme(config.Theme).
/// </summary>
public class ThemeConfig
{
    /// <summary>Hex colour for the left sidebar panel (default #182136).</summary>
    public string SidebarBg { get; set; } = "";

    /// <summary>Hex accent colour — buttons, active nav bar, focus rings (default #3884FF).</summary>
    public string Accent { get; set; } = "";

    /// <summary>Hex colour for the main content area background (default #F3F5F9).</summary>
    public string ContentBg { get; set; } = "";
}

/// <summary>
/// Configuration for a single navigation module (e.g. Leads, Appointments).
/// </summary>
public class ModuleConfig
{
    /// <summary>
    /// Stable internal key. Matches the switch cases in MainForm.BuildPages()
    /// ("leads", "appointments", "messages", "quotes").
    /// NEVER change this value — it is used to identify the module in code.
    /// </summary>
    public string Id { get; set; } = "";

    /// <summary>Display name shown in the sidebar nav and as the section page title.</summary>
    public string Label { get; set; } = "";

    /// <summary>Emoji icon shown in the sidebar nav item.</summary>
    public string Icon { get; set; } = "";

    /// <summary>Text on the "+ Add" button at the top right of the section page.</summary>
    public string AddButtonLabel { get; set; } = "";

    /// <summary>When false, the module is hidden from the sidebar and no page is built for it.</summary>
    public bool Enabled { get; set; } = true;

    /// <summary>Zero-based position in the sidebar. Lower = higher in the list.</summary>
    public int Order { get; set; }
}

/// <summary>Status stage definitions for one pipeline (Leads, Appointments, or Quotes).</summary>
public class PipelineConfig
{
    public List<StageConfig> Stages { get; set; } = new();
}

/// <summary>
/// A single status stage within a pipeline.
/// </summary>
public class StageConfig
{
    /// <summary>
    /// Stable internal key stored in the SQLite database (e.g. "won", "no_show").
    /// Custom stages use generated keys like "custom_1".
    /// NEVER rename this after records have been saved — use Label for display changes.
    /// </summary>
    public string Id { get; set; } = "";

    /// <summary>Display label shown in dropdowns and status badges. Editable by the owner.</summary>
    public string Label { get; set; } = "";

    /// <summary>Hex colour for the status badge (e.g. "#16A34A"). Applied to EntityCard.</summary>
    public string Color { get; set; } = "";

    /// <summary>Optional tooltip/description. Stored but not yet surfaced in the UI.</summary>
    public string Description { get; set; } = "";
}
