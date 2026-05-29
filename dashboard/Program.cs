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
            Application.Run(new MainForm());
        }
        catch (Exception ex)
        {
            var log = Path.Combine(AppContext.BaseDirectory, "crash.log");
            File.WriteAllText(log, ex.ToString());
            MessageBox.Show(ex.Message, "Startup error");
        }
    }
}
