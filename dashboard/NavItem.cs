using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

/// <summary>A sidebar navigation item: icon, label, count badge, active/hover states.</summary>
public class NavItem : Panel
{
    private readonly string _icon;
    private readonly string _label;
    private bool _active;
    private bool _hover;
    private int _count;

    public int Count { get => _count; set { _count = value; Invalidate(); } }

    public NavItem(string icon, string label)
    {
        _icon = icon;
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

        var bg = _active ? Ui.SidebarActive : _hover ? Ui.SidebarHover : Ui.SidebarBg;
        using (var b = new SolidBrush(bg))
            g.FillRectangle(b, ClientRectangle);

        // active accent bar on the left
        if (_active)
            using (var b = new SolidBrush(Ui.Accent))
                g.FillRectangle(b, 0, 8, 4, Height - 16);

        var textColor = _active ? Color.White : Color.FromArgb(186, 196, 214);

        TextRenderer.DrawText(g, _icon, Ui.F(13f),
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
                using var b = new SolidBrush(_active ? Ui.Accent : Color.FromArgb(48, 60, 88));
                g.FillPath(b, path);
            }
            TextRenderer.DrawText(g, txt, Ui.F(8.5f, FontStyle.Bold), rect, Color.White,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }
    }
}
