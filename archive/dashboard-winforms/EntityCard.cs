using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// EntityCard — the full-width row card used across all four dashboard modules.
//
// Architecture notes for Codex:
//  • Everything is drawn via OnPaint (no child controls).  Hit-testing is done
//    manually in OnMouseMove / OnMouseDown for reliability.
//  • statusColor? — when null, falls back to Ui.StatusColor(status).
//    MainForm passes the explicit color from config.Pipelines[id].Stages[].Color.
//  • onStatusClick — optional callback.  When provided, clicking the status badge
//    calls the callback with the card Control and the badge's bottom-left Point
//    so MainForm can show a ContextMenu there. When null, the badge is display-only.
//  • Double-clicking anywhere except the action icons opens the edit dialog.
// ---------------------------------------------------------------------------

/// <summary>A full-width row card: avatar, title, subtitle, status badge, edit/delete.
/// Everything is painted (no child controls) and clicks are hit-tested for reliability.</summary>
public class EntityCard : Panel
{
    private readonly string _title;
    private readonly string _subtitle;
    private readonly string _status;
    private readonly string _statusText;
    private readonly Color? _statusColor;
    private readonly Color _avatarColor;
    private readonly Action _onEdit;
    private readonly Action _onDelete;
    private readonly Action<Control, Point>? _onStatusClick;
    private readonly Action? _onActivate;

    private bool _hover;
    private bool _hoverStatus;
    private bool _hoverEdit;
    private bool _hoverDelete;
    private Rectangle _editRect, _deleteRect, _badgeRect;

    private const int IconSize = 30;
    private const int Gap = 12;          // bottom spacing baked in (Dock ignores Margin)
    private int BodyH => Height - Gap;   // visible card body height

    public EntityCard(
        string title,
        string subtitle,
        string status,
        Action onEdit,
        Action onDelete,
        Color? statusColor = null,
        Action<Control, Point>? onStatusClick = null,
        Action? onActivate = null)
    {
        _title = title;
        _subtitle = subtitle;
        _status = string.IsNullOrWhiteSpace(status) ? "—" : status;
        _statusText = _status;
        _statusColor = statusColor;
        _avatarColor = Color.FromArgb(237, 239, 243); // calm neutral chip — no rainbow
        _onEdit = onEdit;
        _onDelete = onDelete;
        _onStatusClick = onStatusClick;
        _onActivate = onActivate;

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

        var sz = TextRenderer.MeasureText(g, _statusText, Ui.F(8.5f, FontStyle.Bold));
        int badgeW = sz.Width + 36, badgeH = 24;   // +36 = left pad + dot + gap + right pad
        _badgeRect = new Rectangle(_editRect.Left - badgeW - 14, (BodyH - badgeH) / 2, badgeW, badgeH);
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        bool hs = _onStatusClick != null && _badgeRect.Contains(e.Location);
        bool he = _editRect.Contains(e.Location);
        bool hd = _deleteRect.Contains(e.Location);
        if (hs != _hoverStatus || he != _hoverEdit || hd != _hoverDelete)
        {
            _hoverStatus = hs;
            _hoverEdit = he;
            _hoverDelete = hd;
            Invalidate();
        }
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e)
    {
        _hover = _hoverStatus = _hoverEdit = _hoverDelete = false;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left) return;
        if (_onStatusClick != null && _badgeRect.Contains(e.Location))
            _onStatusClick(this, new Point(_badgeRect.Left, _badgeRect.Bottom + 3));
        else if (_editRect.Contains(e.Location)) _onEdit();
        else if (_deleteRect.Contains(e.Location)) _onDelete();
        else if (_onActivate != null) _onActivate();   // single-click body opens (e.g. message reader)
    }

    protected override void OnMouseDoubleClick(MouseEventArgs e)
    {
        base.OnMouseDoubleClick(e);
        // When the card has a single-click activate action, don't also open the edit dialog on double-click.
        if (_onActivate != null) return;
        if (!_badgeRect.Contains(e.Location) && !_editRect.Contains(e.Location) && !_deleteRect.Contains(e.Location)) _onEdit();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        ComputeLayout(g);

        int w = Width - 1;
        int h = BodyH - 2;   // reserve 2px so the soft shadow shows beneath the card

        // Soft drop shadow — layered translucent rounded rects, no hard border.
        for (int s = 3; s >= 1; s--)
        {
            using var sp = Ui.RoundedRect(new Rectangle(0, s, w, h), 12);
            using var sb = new SolidBrush(Color.FromArgb(_hover ? 9 : 5, 17, 21, 28));
            g.FillPath(sb, sp);
        }

        // Card surface — lifts to SurfaceAlt on hover.
        var body = new Rectangle(0, 0, w, h);
        using (var path = Ui.RoundedRect(body, 12))
        {
            using var fill = new SolidBrush(_hover ? Ui.SurfaceAlt : Ui.CardBg);
            g.FillPath(fill, path);
            using var pen = new Pen(Ui.Hairline, 1f);
            g.DrawPath(pen, path);
        }

        var sc = _statusColor ?? Ui.StatusColor(_status);

        // Status-coloured left edge — the card's single source of colour/meaning.
        using (var ep = Ui.RoundedRect(new Rectangle(1, 14, 3, h - 28), 2))
        using (var eb = new SolidBrush(sc))
            g.FillPath(eb, ep);

        // Neutral monogram chip (replaces the old rainbow avatar).
        int av = 40, ax = 18, ay = (h - av) / 2;
        using (var ab = new SolidBrush(_avatarColor))
            g.FillEllipse(ab, ax, ay, av, av);
        TextRenderer.DrawText(g, Ui.Initials(_title), Ui.F(11f, FontStyle.Bold),
            new Rectangle(ax, ay, av, av), Ui.TextBody,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);

        // Title + subtitle
        int textX = ax + av + 14;
        int textRight = _badgeRect.Left - 12;
        if (textRight < textX + 60) textRight = textX + 60;
        TextRenderer.DrawText(g, _title, Ui.F(12f, FontStyle.Bold),
            new Rectangle(textX, 14, textRight - textX, 24), Ui.TextStrong,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        TextRenderer.DrawText(g, _subtitle, Ui.F(9.5f),
            new Rectangle(textX, 39, textRight - textX, 22), Ui.TextMuted,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);

        // Status badge — soft fill + dot, no hard border.
        DrawStatusBadge(g, sc);

        // Action icons — only visible on hover, so rows stay calm at rest.
        if (_hover)
        {
            DrawIcon(g, _editRect, "✎", _hoverEdit, Ui.Info);
            DrawIcon(g, _deleteRect, "🗑", _hoverDelete, Ui.Danger);
        }
    }

    private void DrawStatusBadge(Graphics g, Color sc)
    {
        using (var path = Ui.RoundedRect(_badgeRect, _badgeRect.Height / 2))
        using (var b = new SolidBrush(Ui.Soft(sc, _hoverStatus ? 46 : 28)))
            g.FillPath(b, path);

        // Status dot
        const int dot = 7;
        int dx = _badgeRect.Left + 12;
        int dy = _badgeRect.Top + (_badgeRect.Height - dot) / 2;
        using (var db = new SolidBrush(sc))
            g.FillEllipse(db, dx, dy, dot, dot);

        // Label, offset right of the dot
        int labelX = dx + dot + 5;
        var labelRect = new Rectangle(labelX, _badgeRect.Top, _badgeRect.Right - labelX - 8, _badgeRect.Height);
        TextRenderer.DrawText(g, _statusText, Ui.F(8.5f, FontStyle.Bold), labelRect, sc,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
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
