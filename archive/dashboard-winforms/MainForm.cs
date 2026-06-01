using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// MainForm — the owner dashboard shell.
//
// Architecture overview for Codex:
//
//  Layout:
//    SplitContainer (resizable — owner can drag the divider)
//      Panel1  →  sidebar (BuildSidebar)
//      Panel2  →  _content Panel containing one CardListPage per active module
//
//  Config-driven rendering (never hardcode):
//    • ApplyConfig(config) is the single entry point for applying a new config.
//      It is called on startup and after BuilderForm.Save & Apply.
//    • RebuildLayout() tears down and rebuilds all controls from the current config.
//    • Module visibility, order, labels, and add-button text come from config.Modules.
//    • Status dropdowns and card badge colours come from config.Pipelines.
//
//  Status / pipeline helpers (read these before editing status logic):
//    • PipelineStages(moduleId)          — stages from config, or defaults.
//    • StageLabelForStatus(id, status)   — maps stored id → current display label.
//    • StageIdForSelection(id, label)    — maps selected label → stable id to store.
//    • StageLabelsForDropdown(id, cur)   — builds the status ComboBox option list.
//
//  Database:
//    Status values stored in SQLite are stage IDs, NOT labels.
//    If an owner renames "Won" → "Closed", old records still load and display
//    correctly because FindStage() matches on both id and label.
// ---------------------------------------------------------------------------

/// <summary>The owner-facing dashboard shell. Reads DashboardConfig for all layout decisions.</summary>
public class MainForm : Form
{
    private Panel _content = null!;
    private readonly List<NavItem> _navItems = new();
    private readonly List<(NavItem Item, Control Page)> _navRoutes = new();

    private HomePage? _homePage;
    private CardListPage? _leadsPage, _apptPage, _msgPage, _quotePage;
    private NavItem? _navHome, _navLeads, _navAppt, _navMsg, _navQuote;
    private DashboardConfig _config = ConfigManager.GetDefaults();
    private List<ModuleConfig> _activeModules = new();
    private static readonly string[] KnownModuleIds = ["home", "leads", "appointments", "messages", "quotes"];
    private const int SidebarDefaultWidth = 232;
    private const int SidebarMinWidth = 180;
    private const int ContentMinWidth = 320;

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
        _homePage = null;
        _leadsPage = _apptPage = _msgPage = _quotePage = null;
        _navHome = _navLeads = _navAppt = _navMsg = _navQuote = null;

        _content = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };
        BuildPages();                  // fills _content with the four pages
        var sidebar = BuildSidebar();  // returns the sidebar panel (Dock=Fill)
        var mainArea = BuildMainArea();

        // SplitContainer gives the owner a draggable divider to resize the sidebar.
        // Panel1 = sidebar (dark nav), Panel2 = main content area.
        // NOTE: SplitterDistance cannot be set here — the control has no width yet
        // (RebuildLayout runs before the form is shown).  It is applied on first Layout.
        var split = new SplitContainer
        {
            Dock = DockStyle.Fill,
            SplitterWidth = 5,
            BackColor = Ui.SidebarBg,  // splitter track matches sidebar colour
            BorderStyle = BorderStyle.None,
        };
        split.Panel1.Controls.Add(sidebar);
        split.Panel2.BackColor = Ui.ContentBg;
        split.Panel2.Controls.Add(mainArea);

        var splitterInitialized = false;
        void ApplyInitialSplitterBounds()
        {
            if (splitterInitialized || split.Width <= 0) return;

            ApplySidebarSplitterBounds(split, preserveCurrentDistance: false);
            splitterInitialized = true;
        }

        split.HandleCreated += (s, e) => ApplyInitialSplitterBounds();
        split.Layout += (s, e) => ApplyInitialSplitterBounds();
        split.SizeChanged += (s, e) =>
            ApplySidebarSplitterBounds(split, preserveCurrentDistance: splitterInitialized);

        Controls.Add(split);
        ApplyInitialSplitterBounds();

        if (_navRoutes.Count > 0) Select(_navRoutes[0].Item, _navRoutes[0].Page);
        RefreshAll();
    }

    private Control BuildMainArea()
    {
        var main = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Ui.ContentBg,
        };
        main.RowStyles.Add(new RowStyle(SizeType.Absolute, 56));
        main.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        main.Controls.Add(BuildPersistentBrandHeader(), 0, 0);
        main.Controls.Add(_content, 0, 1);
        return main;
    }

    private Control BuildPersistentBrandHeader()
    {
        var header = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Ui.ContentBg,
            Padding = new Padding(28, 0, 28, 0),
        };
        var name = new Label
        {
            Dock = DockStyle.Fill,
            Text = TextOrDefault(_config.Branding?.BusinessName, "Business Hub"),
            ForeColor = Ui.TextDark,
            Font = Ui.F(12f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleCenter,
            AutoEllipsis = true,
        };

        header.Paint += (s, e) =>
        {
            using var pen = new Pen(Ui.CardBorder);
            e.Graphics.DrawLine(pen, 0, header.Height - 1, header.Width, header.Height - 1);
        };
        header.Controls.Add(name);
        return header;
    }

    private static void ApplySidebarSplitterBounds(SplitContainer split, bool preserveCurrentDistance)
    {
        if (split.IsDisposed || split.Width <= 0) return;

        var maxDistance = split.Width - ContentMinWidth;
        if (maxDistance <= 0) return;

        split.Panel1MinSize = 0;
        split.Panel2MinSize = 0;

        var desired = preserveCurrentDistance && split.SplitterDistance > 0
            ? split.SplitterDistance
            : SidebarDefaultWidth;

        desired = maxDistance < SidebarMinWidth
            ? Math.Max(0, maxDistance)
            : Math.Clamp(desired, SidebarMinWidth, maxDistance);

        split.SplitterDistance = desired;

        if (maxDistance >= SidebarMinWidth)
        {
            split.Panel1MinSize = SidebarMinWidth;
            split.Panel2MinSize = ContentMinWidth;
        }
    }

    // ---------------------------------------------------------------- sidebar
    private Panel BuildSidebar()
    {
        var sidebar = new Panel { Dock = DockStyle.Fill, BackColor = Ui.SidebarBg };
        var logoImage = TryLoadImageCopy(_config.Branding?.LogoPath);
        var brandPrimary = ColorFromHex(_config.Branding?.PrimaryColor, Ui.Accent);
        var brandSecondary = ColorFromHex(_config.Branding?.SecondaryColor, Color.FromArgb(120, 90, 250));

        sidebar.Paint += (s, e) =>
        {
            // subtle right divider
            using var pen = new Pen(Color.FromArgb(40, 52, 80));
            e.Graphics.DrawLine(pen, sidebar.Width - 1, 0, sidebar.Width - 1, sidebar.Height);
        };

        // Logo-only brand block. The business name now lives in the persistent
        // content header, so the sidebar stays readable at minimum width.
        const int LogoSize = 84;
        const int LogoLeft = 12;
        const int BrandBlockH = 112;

        var brand = new Panel { Dock = DockStyle.Top, Height = BrandBlockH, BackColor = Ui.SidebarBg };
        brand.Disposed += (s, e) => logoImage?.Dispose();
        brand.Resize += (s, e) => brand.Invalidate();   // repaint when sidebar is resized
        brand.Paint += (s, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

            // Vertically centre the larger logo in the brand block.
            var logo = new Rectangle(LogoLeft, (BrandBlockH - LogoSize) / 2, LogoSize, LogoSize);
            if (logoImage != null)
            {
                DrawBrandLogo(g, logoImage, logo);
            }
            else
            {
                using (var path = Ui.RoundedRect(logo, 12))
                using (var b = new LinearGradientBrush(logo, brandPrimary, brandSecondary, 45f))
                    g.FillPath(b, path);
                TextRenderer.DrawText(g, "B", Ui.F(18f, FontStyle.Bold), logo, Color.White,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }

        };

        var navItems = new List<NavItem>();
        foreach (var module in _activeModules)
        {
            var page = PageFor(module.Id);
            if (page == null) continue;

            var nav = NewNav(module.Id, module.Icon, module.Label, page);
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

    private NavItem NewNav(string iconKey, string glyph, string label, Control page)
    {
        // iconKey resolves to a crisp vector icon (Icons); glyph is the emoji fallback.
        var item = new NavItem(iconKey, glyph, label);
        item.Click += (s, e) => Select(item, page);
        _navItems.Add(item);
        _navRoutes.Add((item, page));
        return item;
    }

    private void Select(NavItem active, Control page)
    {
        foreach (var n in _navItems) n.SetActive(n == active);
        foreach (Control c in _content.Controls) c.Visible = false;
        page.Visible = true;
        page.BringToFront();

        // Home metrics are derived from the other tabs' data, so recompute them
        // every time Home is opened — keeps the numbers in sync without rebuilding
        // Home on every search keystroke elsewhere.
        if (page == _homePage) RefreshHome();
    }

    // ---------------------------------------------------------------- pages
    private void BuildPages()
    {
        _activeModules = GetActiveModules(_config);

        foreach (var module in _activeModules)
        {
            switch (module.Id)
            {
                case "home":
                    _homePage = new HomePage();
                    _homePage.MetricClicked += NavigateTo;   // click a metric card → open that tab
                    _content.Controls.Add(_homePage);
                    break;

                case "leads":
                    _leadsPage = new CardListPage(module.Label, "leads", module.AddButtonLabel);
                    _leadsPage.AddClicked += (s, e) => AddLead();
                    _leadsPage.SearchChanged += (s, e) => RefreshLeads();
                    _content.Controls.Add(_leadsPage);
                    break;

                case "appointments":
                    _apptPage = new CardListPage(module.Label, "appointments", module.AddButtonLabel, showCalendar: true);
                    _apptPage.AddClicked += (s, e) => AddAppointment();
                    _apptPage.CalendarDateDoubleClicked += date => AddAppointment(date);
                    _apptPage.CalendarItemClicked += item => OpenAppointment(item.Id);
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
        RefreshHome();
    }

    // ---------------------------------------------------------------- Home (Today)
    private void RefreshHome()
    {
        if (_homePage == null) return;

        // Surface branding entered in the builder (tagline + clickable contact line).
        var b = _config.Branding;
        _homePage.SetIdentity(b?.Tagline, b?.Phone, b?.Email, b?.Website);

        var leads = Database.GetLeads();
        var messages = Database.GetMessages();
        var quotes = Database.GetQuotes();
        var appts = Database.GetAppointments();
        var today = DateTime.Today.ToString("MM/dd/yyyy");

        bool IsToday(string d) => SameText(d, today);

        _homePage.SetMetrics(new[]
        {
            new HomePage.Metric("New leads", leads.Count(l => IsStage("leads", l.Status, "new")), Ui.Accent, "leads"),
            new HomePage.Metric("Unread messages", messages.Count(m => IsStage("messages", m.Status, "unread")), Ui.Info, "messages"),
            new HomePage.Metric("Quotes pending", quotes.Count(q => IsStage("quotes", q.Status, "pending")), Ui.Warning, "quotes"),
            new HomePage.Metric("Appointments today", appts.Count(a => IsToday(a.AppDate)), Ui.Success, "appointments"),
        });

        var cards = new List<EntityCard>();

        foreach (var lead in leads.Where(l => IsStage("leads", l.Status, "new")).Take(4))
        {
            var l = lead;
            cards.Add(new EntityCard(l.Name, Join("New lead", l.Phone, l.Source),
                StageLabelForStatus("leads", l.Status),
                () => { EditLeadDialog(l); RefreshAll(); },
                () => Delete("lead", () => Database.DeleteLead(l.Id), RefreshAll),
                StageColorForStatus("leads", l.Status),
                onActivate: () => { EditLeadDialog(l); RefreshAll(); }));
        }

        foreach (var message in messages.Where(m => IsStage("messages", m.Status, "unread")).Take(4))
        {
            var m = message;
            cards.Add(new EntityCard(m.ContactName, Join("Unread", m.Channel, m.Phone),
                StageLabelForStatus("messages", m.Status),
                () => { EditMessageDialog(m); RefreshAll(); },
                () => Delete("message", () => Database.DeleteMessage(m.Id), RefreshAll),
                StageColorForStatus("messages", m.Status),
                onActivate: () => OpenMessageReader(m)));
        }

        foreach (var appointment in appts.Where(a => IsToday(a.AppDate)).Take(4))
        {
            var a = appointment;
            cards.Add(new EntityCard(a.CustomerName, Join("Today", a.AppTime, a.Service),
                StageLabelForStatus("appointments", a.Status),
                () => { EditAppointmentDialog(a); RefreshAll(); },
                () => Delete("appointment", () => Database.DeleteAppointment(a.Id), RefreshAll),
                StageColorForStatus("appointments", a.Status),
                onActivate: () => { EditAppointmentDialog(a); RefreshAll(); }));
        }

        _homePage.SetAttentionCards(cards.Take(6).ToList());
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
            () => Delete("lead", () => Database.DeleteLead(l.Id), RefreshLeads),
            StageColorForStatus("leads", l.Status),
            (owner, location) => ShowStatusMenu(owner, location, "leads", l.Status, status =>
            {
                l.Status = status;
                Database.SaveLead(l);
            }, RefreshLeads))).ToList();
        _leadsPage.SetCards(cards);
        if (_navLeads != null) _navLeads.Count = data.Count;
    }

    // ---------------------------------------------------------------- Appointments
    private void AddAppointment() => AddAppointment(DateTime.Today);
    private void AddAppointment(DateTime date) =>
        EditAppointmentDialog(new Appointment { AppDate = date.ToString("MM/dd/yyyy") });
    private void EditAppointmentDialog(Appointment a)
    {
        var fields = new List<FieldDef>
        {
            new("CustomerName", "Customer", a.CustomerName, required: true),
            new("Phone", "Phone", a.Phone),
            new("Address", "Address", a.Address),
            new("AppDate", "Date", a.AppDate) { Kind = FieldKind.Date },
            new("AppTime", "Time", a.AppTime) { Kind = FieldKind.Time },
            new("Service", "Service / Job", a.Service),
            new("Notes", "Notes", a.Notes) { Kind = FieldKind.Multiline },
            new("Status", "Status", StageLabelForStatus("appointments", a.Status)) { Kind = FieldKind.Combo, Options = StageLabelsForDropdown("appointments", a.Status) },
        };
        using var d = new FieldDialog(a.Id == 0 ? "New Appointment" : "Edit Appointment", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        a.CustomerName = d.Values["CustomerName"]; a.Phone = d.Values["Phone"];
        a.Address = d.Values["Address"];
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
            Join(Join2(a.AppDate, a.AppTime), a.Service, a.Phone, a.Address),
            StageLabelForStatus("appointments", a.Status),
            () => EditAppointmentDialog(a),
            () => Delete("appointment", () => Database.DeleteAppointment(a.Id), RefreshAppointments),
            StageColorForStatus("appointments", a.Status),
            (owner, location) => ShowStatusMenu(owner, location, "appointments", a.Status, status =>
            {
                a.Status = status;
                Database.SaveAppointment(a);
            }, RefreshAppointments))).ToList();
        _apptPage.SetCards(cards);
        _apptPage.SetCalendarItems(data
            .Select(AppointmentCalendarItem)
            .Where(item => item != null)
            .Cast<CalendarItem>()
            .ToList());
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
            new("DateReceived", "Date", m.DateReceived) { Kind = FieldKind.Date },
            new("Content", "Message", m.Content) { Kind = FieldKind.Multiline },
            new("Status", "Status", StageLabelForStatus("messages", m.Status)) { Kind = FieldKind.Combo, Options = StageLabelsForDropdown("messages", m.Status) },
        };
        using var d = new FieldDialog(m.Id == 0 ? "New Message" : "Edit Message", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        m.ContactName = d.Values["ContactName"]; m.Phone = d.Values["Phone"];
        m.Channel = d.Values["Channel"]; m.DateReceived = d.Values["DateReceived"];
        m.Content = d.Values["Content"]; m.Status = StageIdForSelection("messages", d.Values["Status"]);
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
            StageLabelForStatus("messages", m.Status),
            () => EditMessageDialog(m),
            () => Delete("message", () => Database.DeleteMessage(m.Id), RefreshMessages),
            StageColorForStatus("messages", m.Status),
            (owner, location) => ShowStatusMenu(owner, location, "messages", m.Status, status =>
            {
                m.Status = status;
                Database.SaveMessage(m);
            }, RefreshMessages),
            () => OpenMessageReader(m))).ToList();
        _msgPage.SetCards(cards);
        if (_navMsg != null) _navMsg.Count = data.Count(x => IsStage("messages", x.Status, "unread"));
    }

    // Opens a read-only message bubble, then marks an unread message as read.
    private void OpenMessageReader(Message m)
    {
        using (var reader = new InfoPopupForm(m.ContactName, Join(m.Channel, m.DateReceived, m.Phone), m.Content))
            reader.ShowDialog(this);

        if (IsStage("messages", m.Status, "unread"))
        {
            m.Status = ReadStatusId();
            Database.SaveMessage(m);
        }
        RefreshMessages();
        RefreshHome();
    }

    private string ReadStatusId()
    {
        var read = PipelineStages("messages").FirstOrDefault(s => SameText(s.Id, "read"));
        return read != null ? read.Id : "read";
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
            new("QuoteDate", "Date", q.QuoteDate) { Kind = FieldKind.Date },
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
            () => Delete("quote", () => Database.DeleteQuote(q.Id), RefreshQuotes),
            StageColorForStatus("quotes", q.Status),
            (owner, location) => ShowStatusMenu(owner, location, "quotes", q.Status, status =>
            {
                q.Status = status;
                Database.SaveQuote(q);
            }, RefreshQuotes),
            () => OpenQuote(q.Id))).ToList();
        _quotePage.SetCards(cards);
        if (_navQuote != null) _navQuote.Count = data.Count;
    }

    // Click a quote card to view all its details in a popup.
    private void OpenQuote(int id)
    {
        var q = Database.GetQuotes().FirstOrDefault(x => x.Id == id);
        if (q == null) return;

        var lines = new List<string>();
        AddDetail(lines, "Service", q.Service);
        AddDetail(lines, "Amount", FormatMoney(q.Amount));
        AddDetail(lines, "Phone", q.Phone);
        AddDetail(lines, "Status", StageLabelForStatus("quotes", q.Status));
        AddDetail(lines, "Notes", q.Notes);

        using var popup = new InfoPopupForm(
            TextOrDefault(q.CustomerName, "Quote"),
            Join("Quote", q.QuoteDate),
            string.Join(Environment.NewLine, lines));
        popup.ShowDialog(this);
    }

    // ---------------------------------------------------------------- helpers
    private Control? PageFor(string moduleId) => moduleId switch
    {
        "home" => _homePage,
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
            case "home": _navHome = nav; break;
            case "leads": _navLeads = nav; break;
            case "appointments": _navAppt = nav; break;
            case "messages": _navMsg = nav; break;
            case "quotes": _navQuote = nav; break;
        }
    }

    private NavItem? NavFor(string moduleId) => moduleId switch
    {
        "home" => _navHome,
        "leads" => _navLeads,
        "appointments" => _navAppt,
        "messages" => _navMsg,
        "quotes" => _navQuote,
        _ => null,
    };

    // Selects a module's nav item + page (used by Home metric cards).
    private void NavigateTo(string moduleId)
    {
        var page = PageFor(moduleId);
        var nav = NavFor(moduleId);
        if (page != null && nav != null) Select(nav, page);
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
        "home" => new ModuleConfig { Id = "home", Label = "Home", Icon = "\U0001F3E0", AddButtonLabel = "", Enabled = true, Order = 0 },
        "leads" => new ModuleConfig { Id = "leads", Label = "Leads", Icon = "\U0001F465", AddButtonLabel = "+  Add Lead", Enabled = true, Order = 1 },
        "appointments" => new ModuleConfig { Id = "appointments", Label = "Appointments", Icon = "\U0001F4C5", AddButtonLabel = "+  Add Appt", Enabled = true, Order = 2 },
        "messages" => new ModuleConfig { Id = "messages", Label = "Messages", Icon = "\U0001F4AC", AddButtonLabel = "+  Add Message", Enabled = true, Order = 3 },
        "quotes" => new ModuleConfig { Id = "quotes", Label = "Quotes", Icon = "\U0001F4DD", AddButtonLabel = "+  Add Quote", Enabled = true, Order = 4 },
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

    private void ShowStatusMenu(Control owner, Point location, string pipelineId, string currentStatus, Action<string> saveStatus, Action refresh)
    {
        var stages = PipelineStages(pipelineId);
        if (stages.Count == 0) return;

        var currentLabel = StageLabelForStatus(pipelineId, currentStatus);
        var menu = new RoundedContextMenuStrip { Font = Ui.F(9.5f) };

        foreach (var stage in stages)
        {
            var label = StageDisplayText(stage);
            var stageId = TextOrDefault(stage.Id, label);
            var color = ColorFromHex(stage.Color, Ui.StatusColor(label));
            var item = new ToolStripMenuItem(label)
            {
                Checked = SameText(stageId, currentStatus) || SameText(label, currentLabel),
                Image = StatusSwatch(color),
            };

            item.Click += (s, e) =>
            {
                saveStatus(stageId);
                refresh();
            };

            menu.Items.Add(item);
        }

        menu.Show(owner, location);
    }

    private Color StageColorForStatus(string pipelineId, string status)
    {
        var stage = FindStage(pipelineId, status);
        return stage == null
            ? Ui.StatusColor(status)
            : ColorFromHex(stage.Color, Ui.StatusColor(StageDisplayText(stage)));
    }

    // True when a stored status resolves to the given stable stage id (matches id or label,
    // case-insensitive). Robust to whether the DB stored the id ("new") or a legacy label ("New").
    private bool IsStage(string pipelineId, string status, string stageId)
    {
        var resolved = FindStage(pipelineId, status)?.Id ?? status;
        return SameText(resolved, stageId);
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

    private static Bitmap StatusSwatch(Color color)
    {
        var bitmap = new Bitmap(14, 14);
        using var graphics = Graphics.FromImage(bitmap);
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var brush = new SolidBrush(color);
        graphics.FillEllipse(brush, 2, 2, 10, 10);
        return bitmap;
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
        graphics.DrawImage(image, CoverImageRect(image, bounds));
        graphics.Restore(state);
        graphics.DrawPath(border, path);
    }

    private static Rectangle CoverImageRect(Image image, Rectangle bounds)
    {
        if (image.Width <= 0 || image.Height <= 0) return bounds;

        var scale = Math.Max((float)bounds.Width / image.Width, (float)bounds.Height / image.Height);
        var width = Math.Max(1, (int)Math.Round(image.Width * scale));
        var height = Math.Max(1, (int)Math.Round(image.Height * scale));
        return new Rectangle(
            bounds.Left + (bounds.Width - width) / 2,
            bounds.Top + (bounds.Height - height) / 2,
            width,
            height);
    }

    // Opens the edit dialog for an appointment clicked in the calendar.
    private void OpenAppointment(int id)
    {
        var appointment = Database.GetAppointments().FirstOrDefault(a => a.Id == id);
        if (appointment != null) EditAppointmentDialog(appointment);
    }

    private CalendarItem? AppointmentCalendarItem(Appointment appointment)
    {
        if (!DateTime.TryParse(appointment.AppDate, out var date)) return null;
        var status = StageLabelForStatus("appointments", appointment.Status);

        return new CalendarItem
        {
            Id = appointment.Id,
            Date = date.Date,
            Time = appointment.AppTime,
            Title = TextOrDefault(appointment.CustomerName, "Appointment"),
            Subtitle = Join(appointment.Service, appointment.Phone),
            Details = AppointmentDetailsText(appointment, status),
            Color = StageColorForStatus("appointments", appointment.Status),
            IsReminder = false,
        };
    }

    private static string AppointmentDetailsText(Appointment appointment, string status)
    {
        var lines = new List<string>
        {
            TextOrDefault(appointment.CustomerName, "Appointment"),
            Join(appointment.AppDate, appointment.AppTime),
        };

        AddDetail(lines, "Service", appointment.Service);
        AddDetail(lines, "Phone", appointment.Phone);
        AddDetail(lines, "Address", appointment.Address);
        AddDetail(lines, "Status", status);
        AddDetail(lines, "Notes", appointment.Notes);

        return string.Join(Environment.NewLine, lines.Where(line => !string.IsNullOrWhiteSpace(line)));
    }

    private static void AddDetail(List<string> lines, string label, string value)
    {
        if (!string.IsNullOrWhiteSpace(value))
            lines.Add($"{label}: {value.Trim()}");
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
