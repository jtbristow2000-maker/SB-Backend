using System.Text.Json;

namespace BusinessDashboard;

public static class ConfigManager
{
    private static readonly string ConfigDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "BusinessDashboard");

    private static readonly string ConfigPath = Path.Combine(ConfigDirectory, "dashboard.config.json");

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    public static DashboardConfig Load()
    {
        try
        {
            if (!File.Exists(ConfigPath)) return GetDefaults();

            var json = File.ReadAllText(ConfigPath);
            return JsonSerializer.Deserialize<DashboardConfig>(json, JsonOptions) ?? GetDefaults();
        }
        catch (JsonException)
        {
            return GetDefaults();
        }
        catch (IOException)
        {
            return GetDefaults();
        }
        catch (UnauthorizedAccessException)
        {
            return GetDefaults();
        }
    }

    public static void Save(DashboardConfig config)
    {
        Directory.CreateDirectory(ConfigDirectory);

        var tempPath = ConfigPath + ".tmp";
        var json = JsonSerializer.Serialize(config, JsonOptions);

        File.WriteAllText(tempPath, json);
        File.Move(tempPath, ConfigPath, overwrite: true);
    }

    public static DashboardConfig GetDefaults() => new()
    {
        Version = 1,
        Branding = new BrandingConfig
        {
            BusinessName = "Business Hub",
            DashboardSubtitle = "Owner Dashboard",
            Tagline = "",
            Phone = "",
            Email = "",
            Website = "",
            PrimaryColor = "#3884FF",
            SecondaryColor = "#7C3AED",
            LogoPath = "",
        },
        Theme = new ThemeConfig
        {
            SidebarBg = "#182136",
            Accent = "#3884FF",
            ContentBg = "#F3F5F9",
        },
        Modules =
        [
            new ModuleConfig { Id = "leads", Label = "Leads", Icon = "\U0001F465", AddButtonLabel = "+  Add Lead", Enabled = true, Order = 0 },
            new ModuleConfig { Id = "appointments", Label = "Appointments", Icon = "\U0001F4C5", AddButtonLabel = "+  Add Appt", Enabled = true, Order = 1 },
            new ModuleConfig { Id = "messages", Label = "Messages", Icon = "\U0001F4AC", AddButtonLabel = "+  Add Message", Enabled = true, Order = 2 },
            new ModuleConfig { Id = "quotes", Label = "Quotes", Icon = "\U0001F4DD", AddButtonLabel = "+  Add Quote", Enabled = true, Order = 3 },
        ],
        Pipelines = new Dictionary<string, PipelineConfig>
        {
            ["leads"] = new PipelineConfig
            {
                Stages =
                [
                    new StageConfig { Id = "new", Label = "New", Color = "#3884FF", Description = "New lead to review." },
                    new StageConfig { Id = "contacted", Label = "Contacted", Color = "#CA8A04", Description = "Lead has been contacted." },
                    new StageConfig { Id = "quoted", Label = "Quoted", Color = "#CA8A04", Description = "Quote has been prepared or sent." },
                    new StageConfig { Id = "won", Label = "Won", Color = "#16A34A", Description = "Lead became a customer." },
                    new StageConfig { Id = "lost", Label = "Lost", Color = "#DC2626", Description = "Lead did not convert." },
                ],
            },
            ["appointments"] = new PipelineConfig
            {
                Stages =
                [
                    new StageConfig { Id = "scheduled", Label = "Scheduled", Color = "#CA8A04", Description = "Appointment is scheduled." },
                    new StageConfig { Id = "confirmed", Label = "Confirmed", Color = "#16A34A", Description = "Appointment has been confirmed." },
                    new StageConfig { Id = "completed", Label = "Completed", Color = "#16A34A", Description = "Appointment is complete." },
                    new StageConfig { Id = "cancelled", Label = "Cancelled", Color = "#DC2626", Description = "Appointment was cancelled." },
                    new StageConfig { Id = "no_show", Label = "No Show", Color = "#DC2626", Description = "Customer did not show." },
                ],
            },
            ["quotes"] = new PipelineConfig
            {
                Stages =
                [
                    new StageConfig { Id = "pending", Label = "Pending", Color = "#3884FF", Description = "Quote is pending." },
                    new StageConfig { Id = "sent", Label = "Sent", Color = "#CA8A04", Description = "Quote has been sent." },
                    new StageConfig { Id = "accepted", Label = "Accepted", Color = "#16A34A", Description = "Quote was accepted." },
                    new StageConfig { Id = "declined", Label = "Declined", Color = "#DC2626", Description = "Quote was declined." },
                    new StageConfig { Id = "invoiced", Label = "Invoiced", Color = "#0284C7", Description = "Quote has been invoiced." },
                ],
            },
        },
    };
}
