using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

/// <summary>A full-width row card: avatar, title, subtitle, status badge, edit/delete.
/// Everything is painted (no child controls) and clicks are hit-tested for reliability.</summary>
public class EntityCard : Panel
{
    private readonly string _title;
    private readonly string _subtitle;
    private readonly string _status;
    private readonly Color _avatarColor;
    private readonly Action _onEdit;
    private readonly Action _onDelete;

    private bool _hover;
    private bool _hoverEdit;
    private bool _hoverDelete;
    private Rectangle _editRect, _deleteRect, _badgeRect;

    private const int IconSize = 30;
    private const int Gap = 12;          // bottom spacing baked in (Dock ignores Margin)
    private int BodyH => Height - Gap;   // visible card body height

    public EntityCard(string title, string subtitle, string status, Action onEdit, Action onDelete)
    {
        _title = title;
        _subtitle = subtitle;
        _status = string.IsNullOrWhiteSpace(status) ? "—" : status;
        _avatarColor = Ui.AvatarColor(title);
        _onEdit = onEdit;
        _onDelete = onDelete;

        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Height = 78 + Gap;
        BackColor = Ui.ContentBg;
        Cursor = Cursors.Hand;
    }

    private void ComputeLayout(Graphics g)
    {
        int pad = 16;
        _deleteRect = new Rectangle(Width - pad - IconSize, (BodyH - IconSize) / 2, IconSize, IconSize);
        _editRect = new Rectangle(_deleteRect.Left - IconSize - 4, (BodyH - IconSize) / 2, IconSize, IconSize);

        var sz = TextRenderer.MeasureText(g, _status, Ui.F(8.5f, FontStyle.Bold));
        int badgeW = sz.Width + 24, badgeH = 24;
        _badgeRect = new Rectangle(_editRect.Left - badgeW - 14, (BodyH - badgeH) / 2, badgeW, badgeH);
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        bool he = _editRect.Contains(e.Location);
        bool hd = _deleteRect.Contains(e.Location);
        if (he != _hoverEdit || hd != _hoverDelete) { _hoverEdit = he; _hoverDelete = hd; Invalidate(); }
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e)
    {
        _hover = _hoverEdit = _hoverDelete = false;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left) return;
        if (_editRect.Contains(e.Location)) _onEdit();
        else if (_deleteRect.Contains(e.Location)) _onDelete();
    }

    protected override void OnMouseDoubleClick(MouseEventArgs e)
    {
        base.OnMouseDoubleClick(e);
        if (!_editRect.Contains(e.Location) && !_deleteRect.Contains(e.Location)) _onEdit();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        ComputeLayout(g);

        // Card body (top portion; Gap px left at bottom for spacing)
        var body = new Rectangle(0, 0, Width - 1, BodyH - 1);
        using (var path = Ui.RoundedRect(body, 12))
        {
            using var fill = new SolidBrush(Ui.CardBg);
            g.FillPath(fill, path);
            using var pen = new Pen(_hover ? Ui.CardBorderHover : Ui.CardBorder, _hover ? 1.6f : 1f);
            g.DrawPath(pen, path);
        }

        // Avatar
        int av = 44, ax = 16, ay = (BodyH - av) / 2;
        using (var ab = new SolidBrush(_avatarColor))
            g.FillEllipse(ab, ax, ay, av, av);
        TextRenderer.DrawText(g, Ui.Initials(_title), Ui.F(12f, FontStyle.Bold),
            new Rectangle(ax, ay, av, av), Color.White,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        // Title + subtitle
        int textX = ax + av + 14;
        int textRight = _badgeRect.Left - 12;
        if (textRight < textX + 60) textRight = textX + 60;
        TextRenderer.DrawText(g, _title, Ui.F(11.5f, FontStyle.Bold),
            new Rectangle(textX, 15, textRight - textX, 24), Ui.TextDark,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        TextRenderer.DrawText(g, _subtitle, Ui.F(9.5f),
            new Rectangle(textX, 40, textRight - textX, 22), Ui.TextMuted,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);

        // Status badge
        var sc = Ui.StatusColor(_status);
        using (var path = Ui.RoundedRect(_badgeRect, _badgeRect.Height / 2))
        {
            using var b = new SolidBrush(Color.FromArgb(30, sc));
            g.FillPath(b, path);
        }
        TextRenderer.DrawText(g, _status, Ui.F(8.5f, FontStyle.Bold), _badgeRect, sc,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        // Action icons
        DrawIcon(g, _editRect, "✎", _hoverEdit, Ui.Info);
        DrawIcon(g, _deleteRect, "🗑", _hoverDelete, Ui.Danger);
    }

    private static void DrawIcon(Graphics g, Rectangle r, string glyph, bool hover, Color hoverColor)
    {
        if (hover)
        {
            using var b = new SolidBrush(Color.FromArgb(28, hoverColor));
            using var path = Ui.RoundedRect(r, 7);
            g.FillPath(b, path);
        }
        TextRenderer.DrawText(g, glyph, Ui.F(11f), r, hover ? hoverColor : Ui.TextMuted,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }
}
