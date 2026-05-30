using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

/// <summary>A sidebar navigation item: icon, label, count badge, active/hover states.</summary>
public class NavItem : Panel
{
    private readonly string _iconKey;
    private readonly string _glyph;
    private readonly string _label;
    private bool _active;
    private bool _hover;
    private int _count;

    public int Count { get => _count; set { _count = value; Invalidate(); } }

    public NavItem(string iconKey, string glyph, string label)
    {
        _iconKey = iconKey;
        _glyph = glyph;
        _label = label;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Height = 48;
        Dock = DockStyle.Top;
        Cursor = Cursors.Hand;
        BackColor = Ui.SidebarBg;
        Margin = new Padding(0);
    }

    public void SetActive(bool active) { _active = active; Invalidate(); }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); base.OnMouseLeave(e); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        // Active/hover background — a soft rounded pill inset from the edges,
        // rather than a full-width slab, for a calmer modern feel.
        if (_active || _hover)
        {
            var pill = new Rectangle(8, 5, Width - 16, Height - 10);
            using var path = Ui.RoundedRect(pill, 9);
            using var b = new SolidBrush(_active ? Ui.SidebarActive : Ui.SidebarHover);
            g.FillPath(b, path);
        }

        // Active accent bar on the left — rounded, indigo.
        if (_active)
            using (var path = Ui.RoundedRect(new Rectangle(0, 14, 3, Height - 28), 2))
            using (var b = new SolidBrush(Ui.Accent))
                g.FillPath(b, path);

        var textColor = _active ? Color.White : Color.FromArgb(168, 176, 190);

        // Icon: prefer the crisp vector icon; fall back to the configured glyph.
        var iconBox = new Rectangle(20, (Height - 20) / 2, 20, 20);
        if (Icons.Has(_iconKey))
            Icons.Draw(g, _iconKey, iconBox, textColor, _active ? 2f : 1.8f);
        else
            TextRenderer.DrawText(g, _glyph, Ui.F(13f),
                new Rectangle(18, 0, 28, Height), textColor,
                TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter);

        var labelLeft = 52;
        var labelRight = Width - 12;
        Rectangle? badgeRect = null;

        if (_count > 0)
        {
            string txt = _count.ToString();
            var sz = TextRenderer.MeasureText(g, txt, Ui.F(8.5f, FontStyle.Bold));
            int w = Math.Max(22, sz.Width + 14), h = 20;
            badgeRect = new Rectangle(Width - w - 16, (Height - h) / 2, w, h);
            labelRight = Math.Max(labelLeft + 24, badgeRect.Value.Left - 8);
        }

        TextRenderer.DrawText(g, _label, Ui.F(10.5f, _active ? FontStyle.Bold : FontStyle.Regular),
            new Rectangle(labelLeft, 0, Math.Max(24, labelRight - labelLeft), Height), textColor,
            TextFormatFlags.VerticalCenter | TextFormatFlags.Left | TextFormatFlags.EndEllipsis);

        if (badgeRect.HasValue)
        {
            string txt = _count.ToString();
            var rect = badgeRect.Value;
            using (var path = Ui.RoundedRect(rect, rect.Height / 2))
            {
                using var b = new SolidBrush(_active ? Ui.Accent : Color.FromArgb(58, 62, 72));
                g.FillPath(b, path);
            }
            TextRenderer.DrawText(g, txt, Ui.F(8.5f, FontStyle.Bold), rect, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }
}
