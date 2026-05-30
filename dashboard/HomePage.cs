using System.Drawing.Drawing2D;
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
    private readonly Label _sub;       // date (+ tagline)
    private readonly Label _contact;   // phone · email · website
    private readonly FlowLayoutPanel _metrics;
    private readonly Panel _attentionHost;
    private readonly Label _attentionEmpty;

    private string _tagline = "";

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
        _contact = new Label
        {
            AutoSize = true, Font = Ui.F(9f), ForeColor = Ui.TextMuted,
            Margin = new Padding(2, 0, 0, 0), Visible = false,
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

    /// <summary>Surfaces branding entered in the builder: tagline + a combined contact line.</summary>
    public void SetIdentity(string? tagline, string? contact)
    {
        _tagline = (tagline ?? "").Trim();
        UpdateGreeting();
        _contact.Text = (contact ?? "").Trim();
        _contact.Visible = _contact.Text.Length > 0;
    }

    public void SetMetrics(IEnumerable<Metric> metrics)
    {
        UpdateGreeting();
        _metrics.SuspendLayout();
        foreach (Control c in _metrics.Controls) c.Dispose();
        _metrics.Controls.Clear();
        foreach (var m in metrics)
            _metrics.Controls.Add(new MetricCard(m) { Margin = new Padding(0, 0, 14, 0) });
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

    public MetricCard(HomePage.Metric metric)
    {
        _metric = metric;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Width = 198;
        Height = 100;
        BackColor = Ui.ContentBg;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        int w = Width - 1;
        int h = Height - 3;

        // Soft shadow + white surface (consistent with EntityCard).
        for (int s = 3; s >= 1; s--)
        {
            using var sp = Ui.RoundedRect(new Rectangle(0, s, w, h), 12);
            using var sb = new SolidBrush(Color.FromArgb(5, 17, 21, 28));
            g.FillPath(sb, sp);
        }
        using (var path = Ui.RoundedRect(new Rectangle(0, 0, w, h), 12))
        {
            using var fill = new SolidBrush(Ui.CardBg);
            g.FillPath(fill, path);
            using var pen = new Pen(Ui.Hairline, 1f);
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
