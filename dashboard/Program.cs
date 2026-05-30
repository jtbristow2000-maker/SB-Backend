// ---------------------------------------------------------------------------
// Program — WinForms entry point.
//
// Startup order (for Codex):
//   1. ApplicationConfiguration.Initialize()  — DPI awareness, visual styles.
//   2. Database.Initialize()                  — creates SQLite tables if missing.
//   3. SampleData.Seed() (--seed flag only)   — wipes and re-seeds demo data + config.
//   4. ConfigManager.Load()                   — reads dashboard.config.json (or defaults).
//   5. new MainForm(config)                   — applies config, builds UI, starts the loop.
//
// --seed flag: dotnet run -- --seed
//   Resets both the database records and the dashboard config to factory defaults.
//   Safe to use during development to return to a known clean state.
// ---------------------------------------------------------------------------

namespace BusinessDashboard;

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        try
        {
            ApplicationConfiguration.Initialize();
            Database.Initialize();
            if (args.Contains("--seed")) SampleData.Seed();
            var config = ConfigManager.Load();
            Application.Run(new MainForm(config));
        }
        catch (Exception ex)
        {
            var log = Path.Combine(AppContext.BaseDirectory, "crash.log");
            File.WriteAllText(log, ex.ToString());
            MessageBox.Show(ex.Message, "Startup error");
        }
    }
}
