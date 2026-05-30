using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

public class MainForm : Form
{
    private Panel _content = null!;
    private readonly List<NavItem> _navItems = new();
    private readonly List<(NavItem Item, CardListPage Page)> _navRoutes = new();

    private CardListPage? _leadsPage, _apptPage, _msgPage, _quotePage;
    private NavItem? _navLeads, _navAppt, _navMsg, _navQuote;
    private DashboardConfig _config = ConfigManager.GetDefaults();
    private List<ModuleConfig> _activeModules = new();
    private static readonly string[] KnownModuleIds = ["leads", "appointments", "messages", "quotes"];

    public MainForm(DashboardConfig config)
    {
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(1180, 740);
        MinimumSize = new Size(960, 620);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        Font = Ui.F(10f);
        Icon = SystemIcons.Application;
        DoubleBuffered = true;

        ApplyConfig(config);
    }

    public void ApplyConfig(DashboardConfig config)
    {
        _config = config ?? ConfigManager.GetDefaults();
        Ui.ApplyTheme(_config.Theme);
        Text = TextOrDefault(_config.Branding?.BusinessName, "Business Hub");
        BackColor = Ui.ContentBg;
        RebuildLayout();
    }

    private void RebuildLayout()
    {
        var oldControls = Controls.Cast<Control>().ToList();
        Controls.Clear();
        foreach (var control in oldControls) control.Dispose();

        _navItems.Clear();
        _navRoutes.Clear();
        _leadsPage = _apptPage = _msgPage = _quotePage = null;
        _navLeads = _navAppt = _navMsg = _navQuote = null;

        _content = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };
        BuildPages();                  // fills _content with the four pages
        var sidebar = BuildSidebar();  // returns the sidebar panel (Dock=Fill)

        // Deterministic 2-column layout: fixed sidebar + fill content.
        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 2,
            RowCount = 1,
            BackColor = Ui.ContentBg,
        };
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 232));
        root.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.Controls.Add(sidebar, 0, 0);
        root.Controls.Add(_content, 1, 0);
        Controls.Add(root);

        if (_navRoutes.Count > 0) Select(_navRoutes[0].Item, _navRoutes[0].Page);
        RefreshAll();
    }

    // ---------------------------------------------------------------- sidebar
    private Panel BuildSidebar()
    {
        var sidebar = new Panel { Dock = DockStyle.Fill, BackColor = Ui.SidebarBg };
        var businessName = TextOrDefault(_config.Branding?.BusinessName, "Business Hub");
        var subtitle = TextOrDefault(_config.Branding?.DashboardSubtitle, "Owner Dashboard");
        var logoImage = TryLoadImageCopy(_config.Branding?.LogoPath);
        var brandPrimary = ColorFromHex(_config.Branding?.PrimaryColor, Ui.Accent);
        var brandSecondary = ColorFromHex(_config.Branding?.SecondaryColor, Color.FromArgb(120, 90, 250));

        sidebar.Paint += (s, e) =>
        {
            // subtle right divider
            using var pen = new Pen(Color.FromArgb(40, 52, 80));
            e.Graphics.DrawLine(pen, sidebar.Width - 1, 0, sidebar.Width - 1, sidebar.Height);
        };

        // brand block
        var brand = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = Ui.SidebarBg };
        brand.Disposed += (s, e) => logoImage?.Dispose();
        brand.Paint += (s, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            var logo = new Rectangle(20, 22, 36, 36);
            if (logoImage != null)
            {
                DrawBrandLogo(g, logoImage, logo);
            }
            else
            {
                using (var path = Ui.RoundedRect(logo, 9))
                using (var b = new LinearGradientBrush(logo, brandPrimary, brandSecondary, 45f))
                    g.FillPath(b, path);
                TextRenderer.DrawText(g, "B", Ui.F(15f, FontStyle.Bold), logo, Color.White,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }

            TextRenderer.DrawText(g, businessName, Ui.F(13f, FontStyle.Bold),
                new Rectangle(66, 20, 150, 22), Color.White, TextFormatFlags.Left | TextFormatFlags.EndEllipsis);
            TextRenderer.DrawText(g, subtitle, Ui.F(8.5f),
                new Rectangle(66, 42, 150, 18), Color.FromArgb(150, 162, 185), TextFormatFlags.Left | TextFormatFlags.EndEllipsis);
        };

        var navItems = new List<NavItem>();
        foreach (var module in _activeModules)
        {
            var page = PageFor(module.Id);
            if (page == null) continue;

            var nav = NewNav(module.Icon, module.Label, page);
            SetNavFor(module.Id, nav);
            navItems.Add(nav);
        }

        var navHeader = new Label
        {
            Text = "  MENU",
            Dock = DockStyle.Top,
            Height = 34,
            ForeColor = Color.FromArgb(120, 132, 158),
            Font = Ui.F(8f, FontStyle.Bold),
            TextAlign = ContentAlignment.BottomLeft,
            Padding = new Padding(16, 0, 0, 6),
        };

        var footer = BuildSidebarFooter();

        foreach (var nav in navItems.AsEnumerable().Reverse())
            sidebar.Controls.Add(nav);
        sidebar.Controls.Add(navHeader);
        sidebar.Controls.Add(brand);
        sidebar.Controls.Add(footer);

        return sidebar;
    }

    private Control BuildSidebarFooter()
    {
        var footer = new Panel { Dock = DockStyle.Bottom, Height = 82, BackColor = Ui.SidebarBg };
        var customize = new Label
        {
            Dock = DockStyle.Top,
            Height = 42,
            Text = "  Customize",
            ForeColor = Color.FromArgb(180, 190, 210),
            Font = Ui.F(9f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(16, 0, 0, 0),
            Cursor = Cursors.Hand,
        };
        var version = new Label
        {
            Dock = DockStyle.Bottom,
            Height = 32,
            Text = "  Data saved locally • v2.0",
            ForeColor = Color.FromArgb(96, 108, 134),
            Font = Ui.F(8f),
            TextAlign = ContentAlignment.MiddleLeft,
        };

        customize.Click += (s, e) => OpenBuilder();
        customize.MouseEnter += (s, e) => customize.ForeColor = Color.White;
        customize.MouseLeave += (s, e) => customize.ForeColor = Color.FromArgb(180, 190, 210);

        footer.Controls.Add(customize);
        footer.Controls.Add(version);
        return footer;
    }

    private void OpenBuilder()
    {
        using var builder = new BuilderForm(_config);
        if (builder.ShowDialog(this) != DialogResult.OK) return;

        ApplyConfig(ConfigManager.Load());
    }

    private NavItem NewNav(string icon, string label, CardListPage page)
    {
        var item = new NavItem(icon, label);
        item.Click += (s, e) => Select(item, page);
        _navItems.Add(item);
        _navRoutes.Add((item, page));
        return item;
    }

    private void Select(NavItem active, CardListPage page)
    {
        foreach (var n in _navItems) n.SetActive(n == active);
        foreach (Control c in _content.Controls) c.Visible = false;
        page.Visible = true;
        page.BringToFront();
    }

    // ---------------------------------------------------------------- pages
    private void BuildPages()
    {
        _activeModules = GetActiveModules(_config);

        foreach (var module in _activeModules)
        {
            switch (module.Id)
            {
                case "leads":
                    _leadsPage = new CardListPage(module.Label, "leads", module.AddButtonLabel);
                    _leadsPage.AddClicked += (s, e) => AddLead();
                    _leadsPage.SearchChanged += (s, e) => RefreshLeads();
                    _content.Controls.Add(_leadsPage);
                    break;

                case "appointments":
                    _apptPage = new CardListPage(module.Label, "appointments", module.AddButtonLabel);
                    _apptPage.AddClicked += (s, e) => AddAppointment();
                    _apptPage.SearchChanged += (s, e) => RefreshAppointments();
                    _content.Controls.Add(_apptPage);
                    break;

                case "messages":
                    _msgPage = new CardListPage(module.Label, "messages", module.AddButtonLabel);
                    _msgPage.AddClicked += (s, e) => AddMessage();
                    _msgPage.SearchChanged += (s, e) => RefreshMessages();
                    _content.Controls.Add(_msgPage);
                    break;

                case "quotes":
                    _quotePage = new CardListPage(module.Label, "quotes", module.AddButtonLabel);
                    _quotePage.AddClicked += (s, e) => AddQuote();
                    _quotePage.SearchChanged += (s, e) => RefreshQuotes();
                    _content.Controls.Add(_quotePage);
                    break;
            }
        }
    }

    private void RefreshAll()
    {
        RefreshLeads();
        RefreshAppointments();
        RefreshMessages();
        RefreshQuotes();
    }

    // ---------------------------------------------------------------- Leads
    private void AddLead() => EditLeadDialog(new Lead());
    private void EditLeadDialog(Lead l)
    {
        var fields = new List<FieldDef>
        {
            new("Name", "Name", l.Name, required: true),
            new("Phone", "Phone", l.Phone),
            new("Email", "Email", l.Email),
            new("Source", "Source (referral, web, etc.)", l.Source),
            new("Notes", "Notes", l.Notes) { Kind = FieldKind.Multiline },
            new("Status", "Status", StageLabelForStatus("leads", l.Status)) { Kind = FieldKind.Combo, Options = StageLabelsForDropdown("leads", l.Status) },
        };
        using var d = new FieldDialog(l.Id == 0 ? "New Lead" : "Edit Lead", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        l.Name = d.Values["Name"]; l.Phone = d.Values["Phone"]; l.Email = d.Values["Email"];
        l.Source = d.Values["Source"]; l.Notes = d.Values["Notes"]; l.Status = StageIdForSelection("leads", d.Values["Status"]);
        Database.SaveLead(l);
        RefreshLeads();
    }

    private void RefreshLeads()
    {
        if (_leadsPage == null) return;
        var data = Database.GetLeads(_leadsPage.Query);
        var cards = data.Select(l => new EntityCard(
            l.Name,
            Join(l.Phone, l.Email, l.Source),
            StageLabelForStatus("leads", l.Status),
            () => EditLeadDialog(l),
            () => Delete("lead", () => Database.DeleteLead(l.Id), RefreshLeads))).ToList();
        _leadsPage.SetCards(cards);
        if (_navLeads != null) _navLeads.Count = data.Count;
    }

    // ---------------------------------------------------------------- Appointments
    private void AddAppointment() => EditAppointmentDialog(new Appointment { AppDate = DateTime.Today.ToString("MM/dd/yyyy") });
    private void EditAppointmentDialog(Appointment a)
    {
        var fields = new List<FieldDef>
        {
            new("CustomerName", "Customer", a.CustomerName, required: true),
            new("Phone", "Phone", a.Phone),
            new("AppDate", "Date", a.AppDate),
            new("AppTime", "Time", a.AppTime),
            new("Service", "Service / Job", a.Service),
            new("Notes", "Notes", a.Notes) { Kind = FieldKind.Multiline },
            new("Status", "Status", StageLabelForStatus("appointments", a.Status)) { Kind = FieldKind.Combo, Options = StageLabelsForDropdown("appointments", a.Status) },
        };
        using var d = new FieldDialog(a.Id == 0 ? "New Appointment" : "Edit Appointment", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        a.CustomerName = d.Values["CustomerName"]; a.Phone = d.Values["Phone"];
        a.AppDate = d.Values["AppDate"]; a.AppTime = d.Values["AppTime"];
        a.Service = d.Values["Service"]; a.Notes = d.Values["Notes"]; a.Status = StageIdForSelection("appointments", d.Values["Status"]);
        Database.SaveAppointment(a);
        RefreshAppointments();
    }

    private void RefreshAppointments()
    {
        if (_apptPage == null) return;
        var data = Database.GetAppointments(_apptPage.Query);
        var cards = data.Select(a => new EntityCard(
            a.CustomerName,
            Join(Join2(a.AppDate, a.AppTime), a.Service, a.Phone),
            StageLabelForStatus("appointments", a.Status),
            () => EditAppointmentDialog(a),
            () => Delete("appointment", () => Database.DeleteAppointment(a.Id), RefreshAppointments))).ToList();
        _apptPage.SetCards(cards);
        if (_navAppt != null) _navAppt.Count = data.Count;
    }

    // ---------------------------------------------------------------- Messages
    private void AddMessage() => EditMessageDialog(new Message { DateReceived = DateTime.Today.ToString("MM/dd/yyyy") });
    private void EditMessageDialog(Message m)
    {
        var fields = new List<FieldDef>
        {
            new("ContactName", "From (name)", m.ContactName, required: true),
            new("Phone", "Phone", m.Phone),
            new("Channel", "Channel", m.Channel) { Kind = FieldKind.Combo, Options = ["Phone Call", "Text", "Email", "Voicemail", "Website"] },
            new("DateReceived", "Date", m.DateReceived),
            new("Content", "Message", m.Content) { Kind = FieldKind.Multiline },
            new("Status", "Status", m.Status) { Kind = FieldKind.Combo, Options = ["Unread", "Read", "Replied", "Archived"] },
        };
        using var d = new FieldDialog(m.Id == 0 ? "New Message" : "Edit Message", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        m.ContactName = d.Values["ContactName"]; m.Phone = d.Values["Phone"];
        m.Channel = d.Values["Channel"]; m.DateReceived = d.Values["DateReceived"];
        m.Content = d.Values["Content"]; m.Status = d.Values["Status"];
        Database.SaveMessage(m);
        RefreshMessages();
    }

    private void RefreshMessages()
    {
        if (_msgPage == null) return;
        var data = Database.GetMessages(_msgPage.Query);
        var cards = data.Select(m => new EntityCard(
            m.ContactName,
            Join(m.Channel, m.DateReceived, Snippet(m.Content)),
            m.Status,
            () => EditMessageDialog(m),
            () => Delete("message", () => Database.DeleteMessage(m.Id), RefreshMessages))).ToList();
        _msgPage.SetCards(cards);
        if (_navMsg != null) _navMsg.Count = data.Count(x => x.Status == "Unread");
    }

    // ---------------------------------------------------------------- Quotes
    private void AddQuote() => EditQuoteDialog(new Quote { QuoteDate = DateTime.Today.ToString("MM/dd/yyyy") });
    private void EditQuoteDialog(Quote q)
    {
        var fields = new List<FieldDef>
        {
            new("CustomerName", "Customer", q.CustomerName, required: true),
            new("Phone", "Phone", q.Phone),
            new("Service", "Service / Job", q.Service),
            new("Amount", "Amount ($)", q.Amount),
            new("QuoteDate", "Date", q.QuoteDate),
            new("Notes", "Notes", q.Notes) { Kind = FieldKind.Multiline },
            new("Status", "Status", StageLabelForStatus("quotes", q.Status)) { Kind = FieldKind.Combo, Options = StageLabelsForDropdown("quotes", q.Status) },
        };
        using var d = new FieldDialog(q.Id == 0 ? "New Quote" : "Edit Quote", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        q.CustomerName = d.Values["CustomerName"]; q.Phone = d.Values["Phone"];
        q.Service = d.Values["Service"]; q.Amount = d.Values["Amount"];
        q.QuoteDate = d.Values["QuoteDate"]; q.Notes = d.Values["Notes"]; q.Status = StageIdForSelection("quotes", d.Values["Status"]);
        Database.SaveQuote(q);
        RefreshQuotes();
    }

    private void RefreshQuotes()
    {
        if (_quotePage == null) return;
        var data = Database.GetQuotes(_quotePage.Query);
        var cards = data.Select(q => new EntityCard(
            q.CustomerName,
            Join(q.Service, FormatMoney(q.Amount), q.QuoteDate),
            StageLabelForStatus("quotes", q.Status),
            () => EditQuoteDialog(q),
            () => Delete("quote", () => Database.DeleteQuote(q.Id), RefreshQuotes))).ToList();
        _quotePage.SetCards(cards);
        if (_navQuote != null) _navQuote.Count = data.Count;
    }

    // ---------------------------------------------------------------- helpers
    private CardListPage? PageFor(string moduleId) => moduleId switch
    {
        "leads" => _leadsPage,
        "appointments" => _apptPage,
        "messages" => _msgPage,
        "quotes" => _quotePage,
        _ => null,
    };

    private void SetNavFor(string moduleId, NavItem nav)
    {
        switch (moduleId)
        {
            case "leads": _navLeads = nav; break;
            case "appointments": _navAppt = nav; break;
            case "messages": _navMsg = nav; break;
            case "quotes": _navQuote = nav; break;
        }
    }

    private static List<ModuleConfig> GetActiveModules(DashboardConfig config)
    {
        var configured = config.Modules ?? [];
        var modules = KnownModuleIds
            .Select(id =>
            {
                var fallback = DefaultModule(id);
                var module = configured.FirstOrDefault(m =>
                    string.Equals(m.Id, id, StringComparison.OrdinalIgnoreCase));

                return new ModuleConfig
                {
                    Id = fallback.Id,
                    Label = TextOrDefault(module?.Label, fallback.Label),
                    Icon = TextOrDefault(module?.Icon, fallback.Icon),
                    AddButtonLabel = TextOrDefault(module?.AddButtonLabel, fallback.AddButtonLabel),
                    Enabled = module?.Enabled ?? fallback.Enabled,
                    Order = module?.Order ?? fallback.Order,
                };
            })
            .Where(m => m.Enabled)
            .OrderBy(m => m.Order)
            .ThenBy(m => Array.IndexOf(KnownModuleIds, m.Id))
            .ToList();

        return modules.Count > 0
            ? modules
            : KnownModuleIds.Select(DefaultModule).ToList();
    }

    private static ModuleConfig DefaultModule(string id) => id switch
    {
        "leads" => new ModuleConfig { Id = "leads", Label = "Leads", Icon = "\U0001F465", AddButtonLabel = "+  Add Lead", Enabled = true, Order = 0 },
        "appointments" => new ModuleConfig { Id = "appointments", Label = "Appointments", Icon = "\U0001F4C5", AddButtonLabel = "+  Add Appt", Enabled = true, Order = 1 },
        "messages" => new ModuleConfig { Id = "messages", Label = "Messages", Icon = "\U0001F4AC", AddButtonLabel = "+  Add Message", Enabled = true, Order = 2 },
        "quotes" => new ModuleConfig { Id = "quotes", Label = "Quotes", Icon = "\U0001F4DD", AddButtonLabel = "+  Add Quote", Enabled = true, Order = 3 },
        _ => new ModuleConfig { Id = id, Label = id, Icon = "", AddButtonLabel = "+  Add", Enabled = false, Order = int.MaxValue },
    };

    private string[] StageLabelsForDropdown(string pipelineId, string currentStatus)
    {
        var labels = PipelineStages(pipelineId)
            .Select(StageDisplayText)
            .Where(label => !string.IsNullOrWhiteSpace(label))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var currentLabel = StageLabelForStatus(pipelineId, currentStatus);

        if (!string.IsNullOrWhiteSpace(currentLabel) && !labels.Any(label => SameText(label, currentLabel)))
            labels.Add(currentLabel);

        return labels.ToArray();
    }

    private string StageLabelForStatus(string pipelineId, string status)
    {
        var stage = FindStage(pipelineId, status);
        return stage == null ? status : StageDisplayText(stage);
    }

    private string StageIdForSelection(string pipelineId, string selectedLabel)
    {
        var stage = FindStage(pipelineId, selectedLabel);
        return stage == null ? selectedLabel.Trim() : TextOrDefault(stage.Id, StageDisplayText(stage));
    }

    private StageConfig? FindStage(string pipelineId, string value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var stages = PipelineStages(pipelineId);
        var stage = stages.FirstOrDefault(s => SameText(s.Id, value))
            ?? stages.FirstOrDefault(s => SameText(s.Label, value));
        if (stage != null) return stage;

        var defaultStage = DefaultPipelineStages(pipelineId).FirstOrDefault(s =>
            SameText(s.Id, value) || SameText(s.Label, value));
        if (defaultStage == null) return null;

        return stages.FirstOrDefault(s => SameText(s.Id, defaultStage.Id)) ?? defaultStage;
    }

    private List<StageConfig> PipelineStages(string pipelineId)
    {
        var stages = StagesFrom(_config.Pipelines, pipelineId);
        return stages.Count > 0 ? stages : DefaultPipelineStages(pipelineId);
    }

    private static List<StageConfig> DefaultPipelineStages(string pipelineId) =>
        StagesFrom(ConfigManager.GetDefaults().Pipelines, pipelineId);

    private static List<StageConfig> StagesFrom(Dictionary<string, PipelineConfig>? pipelines, string pipelineId)
    {
        if (pipelines == null || string.IsNullOrWhiteSpace(pipelineId)) return [];

        var pipeline = pipelines.FirstOrDefault(pair =>
            SameText(pair.Key, pipelineId)).Value;
        return pipeline?.Stages?
            .Where(stage => !string.IsNullOrWhiteSpace(stage.Id) || !string.IsNullOrWhiteSpace(stage.Label))
            .ToList() ?? [];
    }

    private static string StageDisplayText(StageConfig stage) =>
        TextOrDefault(stage.Label, stage.Id);

    private static bool SameText(string? left, string? right) =>
        string.Equals(left?.Trim(), right?.Trim(), StringComparison.OrdinalIgnoreCase);

    private static string TextOrDefault(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private static Color ColorFromHex(string? value, Color fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;

        try
        {
            var color = ColorTranslator.FromHtml(value.Trim());
            return color.IsEmpty ? fallback : color;
        }
        catch (ArgumentException)
        {
            return fallback;
        }
    }

    private static Image? TryLoadImageCopy(string? imagePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(imagePath) || !File.Exists(imagePath)) return null;

            using var stream = File.OpenRead(imagePath);
            using var image = Image.FromStream(stream);
            return new Bitmap(image);
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static void DrawBrandLogo(Graphics graphics, Image image, Rectangle bounds)
    {
        using var background = new SolidBrush(Color.White);
        using var border = new Pen(Color.FromArgb(45, 55, 72));
        using var path = Ui.RoundedRect(bounds, 9);
        var state = graphics.Save();

        graphics.FillPath(background, path);
        graphics.SetClip(path);
        graphics.DrawImage(image, FitImageRect(image, bounds));
        graphics.Restore(state);
        graphics.DrawPath(border, path);
    }

    private static Rectangle FitImageRect(Image image, Rectangle bounds)
    {
        if (image.Width <= 0 || image.Height <= 0) return bounds;

        var scale = Math.Min((float)bounds.Width / image.Width, (float)bounds.Height / image.Height);
        var width = Math.Max(1, (int)Math.Round(image.Width * scale));
        var height = Math.Max(1, (int)Math.Round(image.Height * scale));
        return new Rectangle(
            bounds.Left + (bounds.Width - width) / 2,
            bounds.Top + (bounds.Height - height) / 2,
            width,
            height);
    }

    private void Delete(string noun, Action doDelete, Action refresh)
    {
        if (MessageBox.Show($"Delete this {noun}? This can't be undone.", "Confirm delete",
                MessageBoxButtons.YesNo, MessageBoxIcon.Warning) == DialogResult.Yes)
        {
            doDelete();
            refresh();
        }
    }

    private static string Join(params string[] parts) =>
        string.Join("   •   ", parts.Where(p => !string.IsNullOrWhiteSpace(p)));

    private static string Join2(string a, string b) =>
        string.Join(" ", new[] { a, b }.Where(p => !string.IsNullOrWhiteSpace(p)));

    private static string Snippet(string s) =>
        string.IsNullOrWhiteSpace(s) ? "" : (s.Length > 50 ? s[..50].Replace("\n", " ") + "…" : s.Replace("\n", " "));

    private static string FormatMoney(string amount)
    {
        if (string.IsNullOrWhiteSpace(amount)) return "";
        var trimmed = amount.TrimStart('$', ' ');
        return decimal.TryParse(trimmed, out var v) ? v.ToString("C0") : "$" + amount;
    }
}
