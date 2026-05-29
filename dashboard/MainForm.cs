using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

public class MainForm : Form
{
    private Panel _content = null!;
    private readonly List<NavItem> _navItems = new();

    private CardListPage _leadsPage = null!, _apptPage = null!, _msgPage = null!, _quotePage = null!;
    private NavItem _navLeads = null!, _navAppt = null!, _navMsg = null!, _navQuote = null!;

    public MainForm()
    {
        Text = "Business Hub";
        AutoScaleMode = AutoScaleMode.Dpi;
        ClientSize = new Size(1180, 740);
        MinimumSize = new Size(960, 620);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;
        BackColor = Ui.ContentBg;
        Font = Ui.F(10f);
        Icon = SystemIcons.Application;
        DoubleBuffered = true;

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

        Select(_navLeads, _leadsPage);
        RefreshAll();
    }

    // ---------------------------------------------------------------- sidebar
    private Panel BuildSidebar()
    {
        var sidebar = new Panel { Dock = DockStyle.Fill, BackColor = Ui.SidebarBg };
        sidebar.Paint += (s, e) =>
        {
            // subtle right divider
            using var pen = new Pen(Color.FromArgb(40, 52, 80));
            e.Graphics.DrawLine(pen, sidebar.Width - 1, 0, sidebar.Width - 1, sidebar.Height);
        };

        // brand block
        var brand = new Panel { Dock = DockStyle.Top, Height = 78, BackColor = Ui.SidebarBg };
        brand.Paint += (s, e) =>
        {
            var g = e.Graphics;
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
            var logo = new Rectangle(20, 22, 36, 36);
            using (var path = Ui.RoundedRect(logo, 9))
            using (var b = new LinearGradientBrush(logo, Ui.Accent, Color.FromArgb(120, 90, 250), 45f))
                g.FillPath(b, path);
            TextRenderer.DrawText(g, "B", Ui.F(15f, FontStyle.Bold), logo, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            TextRenderer.DrawText(g, "Business Hub", Ui.F(13f, FontStyle.Bold),
                new Rectangle(66, 20, 150, 22), Color.White, TextFormatFlags.Left);
            TextRenderer.DrawText(g, "Owner Dashboard", Ui.F(8.5f),
                new Rectangle(66, 42, 150, 18), Color.FromArgb(150, 162, 185), TextFormatFlags.Left);
        };

        // nav items (added bottom-up because Dock=Top stacks reverse)
        _navQuote = NewNav("\U0001F4DD", "Quotes", _quotePage);
        _navMsg   = NewNav("\U0001F4AC", "Messages", _msgPage);
        _navAppt  = NewNav("\U0001F4C5", "Appointments", _apptPage);
        _navLeads = NewNav("\U0001F465", "Leads", _leadsPage);

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

        // footer
        var footer = new Label
        {
            Dock = DockStyle.Bottom,
            Height = 40,
            Text = "  Data saved locally • v2.0",
            ForeColor = Color.FromArgb(96, 108, 134),
            Font = Ui.F(8f),
            TextAlign = ContentAlignment.MiddleLeft,
        };

        sidebar.Controls.Add(_navQuote);
        sidebar.Controls.Add(_navMsg);
        sidebar.Controls.Add(_navAppt);
        sidebar.Controls.Add(_navLeads);
        sidebar.Controls.Add(navHeader);
        sidebar.Controls.Add(brand);
        sidebar.Controls.Add(footer);

        return sidebar;
    }

    private NavItem NewNav(string icon, string label, CardListPage page)
    {
        var item = new NavItem(icon, label);
        item.Click += (s, e) => Select(item, page);
        _navItems.Add(item);
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
        _leadsPage = new CardListPage("Leads", "leads", "+  Add Lead");
        _apptPage  = new CardListPage("Appointments", "appointments", "+  Add Appt");
        _msgPage   = new CardListPage("Messages", "messages", "+  Add Message");
        _quotePage = new CardListPage("Quotes", "quotes", "+  Add Quote");

        _leadsPage.AddClicked    += (s, e) => AddLead();
        _leadsPage.SearchChanged += (s, e) => RefreshLeads();
        _apptPage.AddClicked     += (s, e) => AddAppointment();
        _apptPage.SearchChanged  += (s, e) => RefreshAppointments();
        _msgPage.AddClicked      += (s, e) => AddMessage();
        _msgPage.SearchChanged   += (s, e) => RefreshMessages();
        _quotePage.AddClicked    += (s, e) => AddQuote();
        _quotePage.SearchChanged += (s, e) => RefreshQuotes();

        _content.Controls.Add(_leadsPage);
        _content.Controls.Add(_apptPage);
        _content.Controls.Add(_msgPage);
        _content.Controls.Add(_quotePage);
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
            new("Status", "Status", l.Status) { Kind = FieldKind.Combo, Options = ["New", "Contacted", "Quoted", "Won", "Lost"] },
        };
        using var d = new FieldDialog(l.Id == 0 ? "New Lead" : "Edit Lead", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        l.Name = d.Values["Name"]; l.Phone = d.Values["Phone"]; l.Email = d.Values["Email"];
        l.Source = d.Values["Source"]; l.Notes = d.Values["Notes"]; l.Status = d.Values["Status"];
        Database.SaveLead(l);
        RefreshLeads();
    }

    private void RefreshLeads()
    {
        var data = Database.GetLeads(_leadsPage.Query);
        var cards = data.Select(l => new EntityCard(
            l.Name,
            Join(l.Phone, l.Email, l.Source),
            l.Status,
            () => EditLeadDialog(l),
            () => Delete("lead", () => Database.DeleteLead(l.Id), RefreshLeads))).ToList();
        _leadsPage.SetCards(cards);
        _navLeads.Count = data.Count;
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
            new("Status", "Status", a.Status) { Kind = FieldKind.Combo, Options = ["Scheduled", "Confirmed", "Completed", "Cancelled", "No Show"] },
        };
        using var d = new FieldDialog(a.Id == 0 ? "New Appointment" : "Edit Appointment", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        a.CustomerName = d.Values["CustomerName"]; a.Phone = d.Values["Phone"];
        a.AppDate = d.Values["AppDate"]; a.AppTime = d.Values["AppTime"];
        a.Service = d.Values["Service"]; a.Notes = d.Values["Notes"]; a.Status = d.Values["Status"];
        Database.SaveAppointment(a);
        RefreshAppointments();
    }

    private void RefreshAppointments()
    {
        var data = Database.GetAppointments(_apptPage.Query);
        var cards = data.Select(a => new EntityCard(
            a.CustomerName,
            Join(Join2(a.AppDate, a.AppTime), a.Service, a.Phone),
            a.Status,
            () => EditAppointmentDialog(a),
            () => Delete("appointment", () => Database.DeleteAppointment(a.Id), RefreshAppointments))).ToList();
        _apptPage.SetCards(cards);
        _navAppt.Count = data.Count;
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
        var data = Database.GetMessages(_msgPage.Query);
        var cards = data.Select(m => new EntityCard(
            m.ContactName,
            Join(m.Channel, m.DateReceived, Snippet(m.Content)),
            m.Status,
            () => EditMessageDialog(m),
            () => Delete("message", () => Database.DeleteMessage(m.Id), RefreshMessages))).ToList();
        _msgPage.SetCards(cards);
        _navMsg.Count = data.Count(x => x.Status == "Unread");
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
            new("Status", "Status", q.Status) { Kind = FieldKind.Combo, Options = ["Pending", "Sent", "Accepted", "Declined", "Invoiced"] },
        };
        using var d = new FieldDialog(q.Id == 0 ? "New Quote" : "Edit Quote", fields);
        if (d.ShowDialog(this) != DialogResult.OK) return;
        q.CustomerName = d.Values["CustomerName"]; q.Phone = d.Values["Phone"];
        q.Service = d.Values["Service"]; q.Amount = d.Values["Amount"];
        q.QuoteDate = d.Values["QuoteDate"]; q.Notes = d.Values["Notes"]; q.Status = d.Values["Status"];
        Database.SaveQuote(q);
        RefreshQuotes();
    }

    private void RefreshQuotes()
    {
        var data = Database.GetQuotes(_quotePage.Query);
        var cards = data.Select(q => new EntityCard(
            q.CustomerName,
            Join(q.Service, FormatMoney(q.Amount), q.QuoteDate),
            q.Status,
            () => EditQuoteDialog(q),
            () => Delete("quote", () => Database.DeleteQuote(q.Id), RefreshQuotes))).ToList();
        _quotePage.SetCards(cards);
        _navQuote.Count = data.Count;
    }

    // ---------------------------------------------------------------- helpers
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
