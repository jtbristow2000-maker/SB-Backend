namespace BusinessDashboard;

public class DashboardConfig
{
    public int Version { get; set; } = 1;
    public BrandingConfig Branding { get; set; } = new();
    public ThemeConfig Theme { get; set; } = new();
    public List<ModuleConfig> Modules { get; set; } = new();
    public Dictionary<string, PipelineConfig> Pipelines { get; set; } = new();
}

public class BrandingConfig
{
    public string BusinessName { get; set; } = "";
    public string DashboardSubtitle { get; set; } = "";
}

public class ThemeConfig
{
    public string SidebarBg { get; set; } = "";
    public string Accent { get; set; } = "";
    public string ContentBg { get; set; } = "";
}

public class ModuleConfig
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Icon { get; set; } = "";
    public string AddButtonLabel { get; set; } = "";
    public bool Enabled { get; set; } = true;
    public int Order { get; set; }
}

public class PipelineConfig
{
    public List<StageConfig> Stages { get; set; } = new();
}

public class StageConfig
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Color { get; set; } = "";
    public string Description { get; set; } = "";
}
