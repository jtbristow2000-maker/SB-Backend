using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// UiKit — shared colour palette, drawing primitives, and reusable controls.
//
// Architecture notes for Codex:
//  • Ui is a static class.  SidebarBg, Accent, and ContentBg are MUTABLE —
//    Ui.ApplyTheme(config.Theme) replaces them at startup and after Save & Apply.
//    All other colours are readonly constants.
//  • Ui.StatusColor(status) maps a stage ID/label to a semantic colour.
//    It is the FALLBACK when a pipeline stage does not have a colour in config.
//    MainForm passes explicit colours from StageConfig.Color to EntityCard,
//    so StatusColor is only reached for unmapped or legacy status strings.
//  • RoundedRect() returns a GraphicsPath — callers must dispose it.
//  • Custom controls in this file (PillButton, SearchBox) use UserPaint +
//    AllPaintingInWmPaint + OptimizedDoubleBuffer to eliminate flicker.
//    When adding new custom controls follow the same pattern.
// ---------------------------------------------------------------------------

/// <summary>Central color palette + drawing helpers for a consistent modern look.</summary>
public static class Ui
{
    // -----------------------------------------------------------------------
    // Calm, premium palette — graphite chrome, warm-grey canvas, indigo accent.
    // Chrome is near-neutral; saturated colour is reserved for status meaning.
    // SidebarBg / Accent / ContentBg stay mutable (overridden by ThemeConfig).
    // Every legacy field name is preserved so existing paint code keeps working.
    // -----------------------------------------------------------------------

    // Chrome (mutable — themed by ApplyTheme)
    public static Color SidebarBg   = Color.FromArgb(22, 24, 29);    // graphite, not navy
    public static Color Accent      = Color.FromArgb(91, 91, 214);   // calm indigo
    public static Color ContentBg   = Color.FromArgb(246, 247, 249); // soft warm-grey canvas

    // Sidebar states
    public static readonly Color SidebarHover  = Color.FromArgb(30, 33, 40);
    public static readonly Color SidebarActive = Color.FromArgb(38, 42, 51);

    // Surfaces
    public static readonly Color CardBg          = Color.White;                  // primary surface
    public static readonly Color SurfaceAlt      = Color.FromArgb(251, 251, 253); // hover / raised row
    public static readonly Color Hairline        = Color.FromArgb(236, 238, 242); // faint divider
    public static readonly Color CardBorder      = Color.FromArgb(236, 238, 242); // alias of Hairline (compat)
    public static readonly Color CardBorderHover = Color.FromArgb(110, 106, 224); // soft indigo

    // Text
    public static readonly Color TextStrong = Color.FromArgb(21, 23, 27);    // titles
    public static readonly Color TextDark   = Color.FromArgb(30, 32, 38);    // strong body (legacy name)
    public static readonly Color TextBody   = Color.FromArgb(60, 65, 75);    // body copy
    public static readonly Color TextMuted  = Color.FromArgb(138, 144, 156); // metadata only

    // Semantic — status meaning only, never chrome
    public static readonly Color Success = Color.FromArgb(31, 157, 107);
    public static readonly Color Warning = Color.FromArgb(199, 125, 20);
    public static readonly Color Danger  = Color.FromArgb(220, 76, 76);
    public static readonly Color Info    = Color.FromArgb(58, 123, 208);

    // Soft fills (~10% tint) for badges, chips, metric cards
    public static readonly Color AccentSoft  = Color.FromArgb(26, 91, 91, 214);
    public static readonly Color SuccessSoft = Color.FromArgb(26, 31, 157, 107);
    public static readonly Color WarningSoft = Color.FromArgb(26, 199, 125, 20);
    public static readonly Color DangerSoft  = Color.FromArgb(26, 220, 76, 76);
    public static readonly Color InfoSoft    = Color.FromArgb(26, 58, 123, 208);

    public static readonly string FontName = "Segoe UI";

    private static readonly Color[] AvatarColors =
    {
        Color.FromArgb(56,132,255), Color.FromArgb(139,92,246), Color.FromArgb(16,185,129),
        Color.FromArgb(244,114,22), Color.FromArgb(236,72,153), Color.FromArgb(14,165,164),
        Color.FromArgb(234,179,8),  Color.FromArgb(99,102,241),
    };

    public static GraphicsPath RoundedRect(Rectangle r, int radius)
    {
        int d = radius * 2;
        var p = new GraphicsPath();
        if (radius <= 0) { p.AddRectangle(r); return p; }
        p.AddArc(r.X, r.Y, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    public static Color AvatarColor(string name)
    {
        if (string.IsNullOrEmpty(name)) return AvatarColors[0];
        int h = 0; foreach (var c in name) h = (h * 31 + c) & 0x7fffffff;
        return AvatarColors[h % AvatarColors.Length];
    }

    public static string Initials(string name)
    {
        var parts = name.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 0) return "?";
        if (parts.Length == 1) return parts[0][..Math.Min(2, parts[0].Length)].ToUpper();
        return ($"{parts[0][0]}{parts[^1][0]}").ToUpper();
    }

    /// <summary>Returns a translucent tint of a colour for soft badge/chip fills (~12% by default).</summary>
    public static Color Soft(Color c, int alpha = 30) => Color.FromArgb(alpha, c.R, c.G, c.B);

    /// <summary>Maps a status string to a semantic color.</summary>
    public static Color StatusColor(string status) => status switch
    {
        "Completed" or "Accepted" or "Won" or "Replied" or "Confirmed" => Success,
        "Cancelled" or "Declined" or "Lost" or "No Show"               => Danger,
        "Pending" or "New" or "Unread"                                 => Accent,
        "Sent" or "Quoted" or "Contacted" or "Read" or "Scheduled"     => Warning,
        _ => Info,
    };

    public static void ApplyTheme(ThemeConfig? theme)
    {
        if (theme == null) return;
        if (TryHexColor(theme.SidebarBg, out var sidebarBg)) SidebarBg = sidebarBg;
        if (TryHexColor(theme.Accent, out var accent)) Accent = accent;
        if (TryHexColor(theme.ContentBg, out var contentBg)) ContentBg = contentBg;
    }

    public static Font F(float size, FontStyle style = FontStyle.Regular) => new(FontName, size, style);

    private static bool TryHexColor(string value, out Color color)
    {
        color = Color.Empty;
        if (string.IsNullOrWhiteSpace(value)) return false;

        try
        {
            color = ColorTranslator.FromHtml(value.Trim());
            return !color.IsEmpty;
        }
        catch (Exception)
        {
            return false;
        }
    }
}

public class RoundedContextMenuStrip : ContextMenuStrip
{
    private const int MenuRadius = 10;

    public RoundedContextMenuStrip()
    {
        Renderer = new RoundedContextMenuRenderer();
        BackColor = Color.White;
        ForeColor = Ui.TextDark;
        Padding = new Padding(6);
        ShowImageMargin = true;
    }

    protected override void OnOpened(EventArgs e)
    {
        base.OnOpened(e);
        ApplyRoundedRegion();
    }

    protected override void OnSizeChanged(EventArgs e)
    {
        base.OnSizeChanged(e);
        ApplyRoundedRegion();
    }

    protected override void OnPaintBackground(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new Rectangle(0, 0, Width - 1, Height - 1);

        using var path = Ui.RoundedRect(rect, MenuRadius);
        using var fill = new SolidBrush(Color.White);
        g.FillPath(fill, path);
    }

    private void ApplyRoundedRegion()
    {
        if (Width <= 0 || Height <= 0) return;

        var oldRegion = Region;
        using var path = Ui.RoundedRect(new Rectangle(0, 0, Width, Height), MenuRadius);
        Region = new Region(path);
        oldRegion?.Dispose();
    }
}

internal class RoundedContextMenuRenderer : ToolStripProfessionalRenderer
{
    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new Rectangle(0, 0, e.ToolStrip.Width - 1, e.ToolStrip.Height - 1);

        using var path = Ui.RoundedRect(rect, 10);
        using var pen = new Pen(Ui.CardBorder);
        g.DrawPath(pen, path);
    }

    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        if (!e.Item.Selected && !e.Item.Pressed) return;

        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new Rectangle(3, 1, e.Item.Width - 6, e.Item.Height - 2);
        if (rect.Width <= 0 || rect.Height <= 0) return;

        using var path = Ui.RoundedRect(rect, 7);
        using var fill = new SolidBrush(Color.FromArgb(e.Item.Pressed ? 42 : 28, Ui.Accent));
        g.FillPath(fill, path);
    }

    protected override void OnRenderImageMargin(ToolStripRenderEventArgs e)
    {
        using var fill = new SolidBrush(Color.White);
        e.Graphics.FillRectangle(fill, e.AffectedBounds);
    }
}

/// <summary>A flat, rounded, hover-aware button drawn entirely by us.</summary>
public class PillButton : Control
{
    public Color BaseColor { get; set; } = Ui.Accent;
    public int Radius { get; set; } = 8;
    public bool Ghost { get; set; } = false;   // transparent until hover

    private bool _hover, _down;

    public PillButton()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        Cursor = Cursors.Hand;
        ForeColor = Color.White;
        Font = Ui.F(9.5f, FontStyle.Bold);
        Height = 38;
        BackColor = Color.Transparent;
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; _down = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e) { _down = true; Invalidate(); base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { _down = false; Invalidate(); base.OnMouseUp(e); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        var rect = new Rectangle(0, 0, Width - 1, Height - 1);
        var fill = BaseColor;
        if (_down) fill = ControlPaint.Dark(BaseColor, 0.08f);
        else if (_hover) fill = ControlPaint.Light(BaseColor, 0.12f);

        using var path = Ui.RoundedRect(rect, Radius);
        if (Ghost)
        {
            if (_hover || _down)
            {
                using var b = new SolidBrush(Color.FromArgb(28, BaseColor));
                g.FillPath(b, path);
            }
        }
        else
        {
            using var b = new SolidBrush(fill);
            g.FillPath(b, path);
        }

        TextRenderer.DrawText(g, Text, Font, rect,
            Ghost ? BaseColor : ForeColor,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter |
            TextFormatFlags.EndEllipsis | TextFormatFlags.NoPrefix);
    }
}

/// <summary>Rounded search box with a magnifier glyph and placeholder.</summary>
public class SearchBox : Panel
{
    private readonly TextBox _tb;
    private readonly string _placeholder;
    public event EventHandler? QueryChanged;
    public string Query => _tb.ForeColor == Ui.TextMuted ? "" : _tb.Text;

    public SearchBox(string placeholder)
    {
        _placeholder = placeholder;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
        BackColor = Ui.ContentBg;
        Height = 38; Width = 260;

        _tb = new TextBox
        {
            BorderStyle = BorderStyle.None,
            Font = Ui.F(10f),
            Text = placeholder,
            ForeColor = Ui.TextMuted,
            BackColor = Color.White,
        };
        _tb.GotFocus  += (s, e) => { if (_tb.ForeColor == Ui.TextMuted) { _tb.Text = ""; _tb.ForeColor = Ui.TextDark; } };
        _tb.LostFocus += (s, e) => { if (string.IsNullOrEmpty(_tb.Text)) { _tb.Text = _placeholder; _tb.ForeColor = Ui.TextMuted; } };
        _tb.TextChanged += (s, e) => QueryChanged?.Invoke(this, EventArgs.Empty);
        Controls.Add(_tb);
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (_tb == null) return; // can fire during construction before _tb is assigned
        _tb.SetBounds(38, (Height - _tb.PreferredHeight) / 2, Width - 48, _tb.PreferredHeight);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new Rectangle(0, 0, Width - 1, Height - 1);
        using var path = Ui.RoundedRect(rect, 10);
        using var b = new SolidBrush(Color.White);
        using var pen = new Pen(Ui.CardBorder);
        g.FillPath(b, path);
        g.DrawPath(pen, path);
        TextRenderer.DrawText(g, "\U0001F50D", Ui.F(10f), new Rectangle(10, 0, 22, Height),
            Ui.TextMuted, TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter);
    }
}
