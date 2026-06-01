using System.Diagnostics;
using System.Drawing.Drawing2D;
using System.Text;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// HomePage — the "Today" overview screen (the default landing module).
//
// Why this exists (for Codex):
//  • Converts the app from a flat list viewer into a dashboard that answers
//    "what needs my attention / what changed / what next" the moment it opens.
//  • Reads NO new data — MainForm.RefreshHome() computes counts and builds the
//    attention cards from the same SQLite tables the list pages already use,
//    then pushes them in via SetMetrics() / SetAttentionCards() / SetIdentity().
//  • Surfaces branding: the greeting band shows the tagline + contact line so
//    the values entered in the Branding tab actually appear in the app.
// ---------------------------------------------------------------------------

/// <summary>The "Today" overview page: greeting, branding line, metric cards, needs-attention list.</summary>
public class HomePage : Panel
{
    /// <summary>A single headline metric shown as a card in the top row.</summary>
    public readonly record struct Metric(string Label, int Value, Color Accent, string IconKey);

    private readonly Label _greeting;
    private readonly Label _sub;            // date (+ tagline)
    private readonly LinkLabel _contact;    // phone · email · website (email/website clickable)
    private readonly FlowLayoutPanel _metrics;
    private readonly Panel _attentionHost;
    private readonly Label _attentionEmpty;

    private string _tagline = "";

    /// <summary>Raised when a metric card is clicked; argument is the module id (e.g. "leads").</summary>
    public event Action<string>? MetricClicked;

    public HomePage()
    {
        Dock = DockStyle.Fill;
        BackColor = Ui.ContentBg;
        Padding = new Padding(30, 22, 30, 14);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            BackColor = Ui.ContentBg,
        };
        root.RowStyles.Add(new RowStyle(SizeType.AutoSize));        // greeting band (sizes to content)
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 122));   // metric cards
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));    // attention

        // ---- Greeting band ----
        // AutoSize labels stacked top-down can never overlap, at any display scaling.
        var head = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            AutoSize = true,
            AutoSizeMode = AutoSizeMode.GrowAndShrink,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            BackColor = Ui.ContentBg,
            Margin = new Padding(0),
            Padding = new Padding(0, 0, 0, 10),
        };
        _greeting = new Label
        {
            AutoSize = true, Font = Ui.F(20f, FontStyle.Bold), ForeColor = Ui.TextStrong,
            Margin = new Padding(0, 0, 0, 3),
        };
        _sub = new Label
        {
            AutoSize = true, Font = Ui.F(10.5f), ForeColor = Ui.TextMuted,
            Margin = new Padding(2, 0, 0, 2),
        };
        _contact = new LinkLabel
        {
            AutoSize = true, Font = Ui.F(9f), ForeColor = Ui.TextMuted,
            LinkColor = Ui.Accent, ActiveLinkColor = Ui.Accent, VisitedLinkColor = Ui.Accent,
            LinkBehavior = LinkBehavior.HoverUnderline,
            Margin = new Padding(2, 0, 0, 0), Visible = false,
        };
        _contact.LinkClicked += (s, e) =>
        {
            if (e.Link?.LinkData is string url && !string.IsNullOrWhiteSpace(url))
                try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); } catch { /* ignore */ }
        };
        head.Controls.Add(_greeting);
        head.Controls.Add(_sub);
        head.Controls.Add(_contact);

        // ---- Metric row ----
        _metrics = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            BackColor = Ui.ContentBg,
            Padding = new Padding(0, 8, 0, 8),
        };

        // ---- Attention area ----
        var attention = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };
        var eyebrow = new Label
        {
            Text = "NEEDS ATTENTION",
            Dock = DockStyle.Top,
            Height = 26,
            Font = Ui.F(8.5f, FontStyle.Bold),
            ForeColor = Ui.TextMuted,
            TextAlign = ContentAlignment.BottomLeft,
            Padding = new Padding(2, 0, 0, 6),
        };
        _attentionHost = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            BackColor = Ui.ContentBg,
            Padding = new Padding(0, 8, 6, 8),
        };
        _attentionEmpty = new Label
        {
            Text = "You're all caught up — nothing needs attention right now.",
            Font = Ui.F(11f), ForeColor = Ui.TextMuted,
            TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Fill, Visible = false,
        };
        attention.Controls.Add(_attentionHost);
        attention.Controls.Add(_attentionEmpty);
        attention.Controls.Add(eyebrow);
        _attentionHost.BringToFront();

        root.Controls.Add(head, 0, 0);
        root.Controls.Add(_metrics, 0, 1);
        root.Controls.Add(attention, 0, 2);
        Controls.Add(root);

        UpdateGreeting();
    }

    private void UpdateGreeting()
    {
        var now = DateTime.Now;
        _greeting.Text = now.Hour < 12 ? "Good morning." : now.Hour < 18 ? "Good afternoon." : "Good evening.";
        var date = now.ToString("dddd, MMMM d");
        _sub.Text = string.IsNullOrWhiteSpace(_tagline) ? date : $"{date}     •     {_tagline}";
    }

    /// <summary>Surfaces branding: tagline beside the date, plus a contact line with clickable email/website.</summary>
    public void SetIdentity(string? tagline, string? phone, string? email, string? website)
    {
        _tagline = (tagline ?? "").Trim();
        UpdateGreeting();
        BuildContactLine(phone, email, website);
    }

    private void BuildContactLine(string? phone, string? email, string? website)
    {
        _contact.Links.Clear();
        var sb = new StringBuilder();
        var links = new List<(int start, int len, string url)>();
        const string sep = "     •     ";

        void Add(string? text, string? url)
        {
            if (string.IsNullOrWhiteSpace(text)) return;
            var t = text.Trim();
            if (sb.Length > 0) sb.Append(sep);
            if (url != null) links.Add((sb.Length, t.Length, url));
            sb.Append(t);
        }

        Add(phone, null);
        Add(email, string.IsNullOrWhiteSpace(email) ? null : "mailto:" + email!.Trim());
        Add(website, NormalizeUrl(website));

        _contact.Text = sb.ToString();
        foreach (var (start, len, url) in links)
            _contact.Links.Add(start, len, url);
        _contact.Visible = _contact.Text.Length > 0;
    }

    private static string? NormalizeUrl(string? website)
    {
        if (string.IsNullOrWhiteSpace(website)) return null;
        var w = website.Trim();
        if (!w.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
            !w.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            w = "https://" + w;
        return w;
    }

    public void SetMetrics(IEnumerable<Metric> metrics)
    {
        UpdateGreeting();
        _metrics.SuspendLayout();
        foreach (Control c in _metrics.Controls) c.Dispose();
        _metrics.Controls.Clear();
        foreach (var m in metrics)
        {
            var key = m.IconKey;
            var card = new MetricCard(m) { Margin = new Padding(0, 0, 14, 0) };
            card.Clicked += () => MetricClicked?.Invoke(key);
            _metrics.Controls.Add(card);
        }
        _metrics.ResumeLayout();
    }

    public void SetAttentionCards(List<EntityCard> cards)
    {
        _attentionHost.SuspendLayout();
        foreach (Control c in _attentionHost.Controls) c.Dispose();
        _attentionHost.Controls.Clear();

        // Reverse add: Dock=Top stacks last-added on top (cards[0] ends up at top).
        for (int i = cards.Count - 1; i >= 0; i--)
        {
            cards[i].Dock = DockStyle.Top;
            _attentionHost.Controls.Add(cards[i]);
        }
        _attentionHost.ResumeLayout();

        _attentionHost.Visible = cards.Count > 0;
        _attentionEmpty.Visible = cards.Count == 0;
        if (_attentionEmpty.Visible) _attentionEmpty.BringToFront();
    }
}

/// <summary>A single headline metric: big number, label, and a soft accent icon chip.</summary>
internal class MetricCard : Panel
{
    private readonly HomePage.Metric _metric;
    private bool _hover;

    /// <summary>Raised on left-click — used to navigate to the matching tab.</summary>
    public event Action? Clicked;

    public MetricCard(HomePage.Metric metric)
    {
        _metric = metric;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Width = 198;
        Height = 100;
        BackColor = Ui.ContentBg;
        Cursor = Cursors.Hand;
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseClick(MouseEventArgs e)
    {
        base.OnMouseClick(e);
        if (e.Button == MouseButtons.Left) Clicked?.Invoke();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        int w = Width - 1;
        int h = Height - 3;

        // Soft shadow + white surface (consistent with EntityCard); lifts on hover.
        for (int s = 3; s >= 1; s--)
        {
            using var sp = Ui.RoundedRect(new Rectangle(0, s, w, h), 12);
            using var sb = new SolidBrush(Color.FromArgb(_hover ? 9 : 5, 17, 21, 28));
            g.FillPath(sb, sp);
        }
        using (var path = Ui.RoundedRect(new Rectangle(0, 0, w, h), 12))
        {
            using var fill = new SolidBrush(_hover ? Ui.SurfaceAlt : Ui.CardBg);
            g.FillPath(fill, path);
            using var pen = new Pen(_hover ? Ui.CardBorderHover : Ui.Hairline, _hover ? 1.4f : 1f);
            g.DrawPath(pen, path);
        }

        // Accent icon chip, top-right.
        var chip = new Rectangle(w - 14 - 28, 14, 28, 28);
        using (var cp = Ui.RoundedRect(chip, 9))
        using (var cb = new SolidBrush(Ui.Soft(_metric.Accent, 30)))
            g.FillPath(cb, cp);
        Icons.Draw(g, _metric.IconKey, new Rectangle(chip.X + 6, chip.Y + 6, 16, 16), _metric.Accent, 1.8f);

        // Big value — generous rect so the digits never clip, kept clear of the chip.
        TextRenderer.DrawText(g, _metric.Value.ToString(), Ui.F(21f, FontStyle.Bold),
            new Rectangle(16, 28, w - 60, 40), Ui.TextStrong,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.NoPrefix);

        // Label.
        TextRenderer.DrawText(g, _metric.Label, Ui.F(9.5f),
            new Rectangle(17, 72, w - 26, 18), Ui.TextMuted,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }
}
