using System.Drawing.Drawing2D;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// Icons — a small, single-weight, hand-drawn line-icon set.
//
// Why this exists (for Codex):
//  • Replaces emoji glyphs (👥 📅 💬 📝) which render inconsistently across
//    machines and look like clip-art.  These are GraphicsPath/line drawings:
//    crisp at any DPI and recolourable to match state.
//  • Draw(g, key, box, color, stroke) renders the icon named `key` inside `box`.
//  • Has(key) reports whether a vector icon exists; callers fall back to text.
//
// Coordinate system: each icon is authored in a 0..1 unit square and scaled
// into `box` by the P(x,y) helper, so icons are resolution-independent.
// ---------------------------------------------------------------------------

/// <summary>Resolution-independent line icons drawn with GDI+ paths.</summary>
public static class Icons
{
    private static readonly HashSet<string> Known = new(StringComparer.OrdinalIgnoreCase)
    {
        "home", "leads", "appointments", "messages", "quotes",
        "gear", "search", "plus", "chevron", "trash", "bell", "dollar", "clock",
    };

    public static bool Has(string? key) => key != null && Known.Contains(key);

    /// <summary>Draw a named line icon inside <paramref name="box"/> in <paramref name="color"/>.</summary>
    public static void Draw(Graphics g, string key, Rectangle box, Color color, float stroke = 1.8f)
    {
        var prevSmoothing = g.SmoothingMode;
        g.SmoothingMode = SmoothingMode.AntiAlias;

        using var pen = new Pen(color, stroke)
        {
            StartCap = LineCap.Round,
            EndCap = LineCap.Round,
            LineJoin = LineJoin.Round,
        };
        using var fill = new SolidBrush(color);

        PointF P(float x, float y) => new(box.X + x * box.Width, box.Y + y * box.Height);
        RectangleF R(float x, float y, float w, float h) =>
            new(box.X + x * box.Width, box.Y + y * box.Height, w * box.Width, h * box.Height);

        switch (key.ToLowerInvariant())
        {
            case "home":
                g.DrawLines(pen, new[] { P(0.15f, 0.52f), P(0.5f, 0.2f), P(0.85f, 0.52f) });
                g.DrawLines(pen, new[] { P(0.25f, 0.46f), P(0.25f, 0.82f), P(0.75f, 0.82f), P(0.75f, 0.46f) });
                g.DrawLines(pen, new[] { P(0.43f, 0.82f), P(0.43f, 0.62f), P(0.57f, 0.62f), P(0.57f, 0.82f) });
                break;

            case "leads": // two people
                g.DrawEllipse(pen, R(0.30f, 0.22f, 0.20f, 0.20f));
                DrawArc(g, pen, R(0.20f, 0.50f, 0.40f, 0.40f), 180, 180);
                g.DrawEllipse(pen, R(0.58f, 0.27f, 0.16f, 0.16f));
                DrawArc(g, pen, R(0.54f, 0.52f, 0.34f, 0.34f), 270, 160);
                break;

            case "appointments": // calendar
                DrawRoundedPath(g, pen, R(0.18f, 0.24f, 0.64f, 0.6f), 0.06f * box.Width);
                g.DrawLine(pen, P(0.18f, 0.4f), P(0.82f, 0.4f));
                g.DrawLine(pen, P(0.34f, 0.16f), P(0.34f, 0.3f));
                g.DrawLine(pen, P(0.66f, 0.16f), P(0.66f, 0.3f));
                break;

            case "messages": // chat bubble
                DrawRoundedPath(g, pen, R(0.16f, 0.22f, 0.68f, 0.46f), 0.1f * box.Width);
                g.DrawLines(pen, new[] { P(0.32f, 0.68f), P(0.30f, 0.84f), P(0.46f, 0.68f) });
                break;

            case "quotes": // document with lines
                g.DrawLines(pen, new[]
                {
                    P(0.27f, 0.16f), P(0.6f, 0.16f), P(0.73f, 0.3f),
                    P(0.73f, 0.84f), P(0.27f, 0.84f), P(0.27f, 0.16f),
                });
                g.DrawLines(pen, new[] { P(0.6f, 0.16f), P(0.6f, 0.3f), P(0.73f, 0.3f) });
                g.DrawLine(pen, P(0.37f, 0.5f), P(0.63f, 0.5f));
                g.DrawLine(pen, P(0.37f, 0.64f), P(0.63f, 0.64f));
                break;

            case "gear":
                g.DrawEllipse(pen, R(0.36f, 0.36f, 0.28f, 0.28f));
                for (var i = 0; i < 8; i++)
                {
                    var a = i * Math.PI / 4;
                    var cx = box.X + 0.5f * box.Width;
                    var cy = box.Y + 0.5f * box.Height;
                    var r1 = 0.32f * box.Width;
                    var r2 = 0.46f * box.Width;
                    g.DrawLine(pen,
                        new PointF((float)(cx + Math.Cos(a) * r1), (float)(cy + Math.Sin(a) * r1)),
                        new PointF((float)(cx + Math.Cos(a) * r2), (float)(cy + Math.Sin(a) * r2)));
                }
                break;

            case "search":
                g.DrawEllipse(pen, R(0.22f, 0.22f, 0.4f, 0.4f));
                g.DrawLine(pen, P(0.6f, 0.6f), P(0.82f, 0.82f));
                break;

            case "plus":
                g.DrawLine(pen, P(0.5f, 0.22f), P(0.5f, 0.78f));
                g.DrawLine(pen, P(0.22f, 0.5f), P(0.78f, 0.5f));
                break;

            case "chevron":
                g.DrawLines(pen, new[] { P(0.3f, 0.42f), P(0.5f, 0.62f), P(0.7f, 0.42f) });
                break;

            case "trash":
                g.DrawLine(pen, P(0.24f, 0.3f), P(0.76f, 0.3f));
                g.DrawLines(pen, new[] { P(0.32f, 0.3f), P(0.36f, 0.82f), P(0.64f, 0.82f), P(0.68f, 0.3f) });
                g.DrawLine(pen, P(0.42f, 0.22f), P(0.58f, 0.22f));
                g.DrawLine(pen, P(0.46f, 0.44f), P(0.46f, 0.7f));
                g.DrawLine(pen, P(0.54f, 0.44f), P(0.54f, 0.7f));
                break;

            case "bell":
                g.DrawLines(pen, new[]
                {
                    P(0.28f, 0.66f), P(0.32f, 0.4f), P(0.5f, 0.24f),
                    P(0.68f, 0.4f), P(0.72f, 0.66f), P(0.28f, 0.66f),
                });
                DrawArc(g, pen, R(0.43f, 0.66f, 0.14f, 0.14f), 0, 180);
                break;

            case "clock":
                g.DrawEllipse(pen, R(0.2f, 0.2f, 0.6f, 0.6f));
                g.DrawLine(pen, P(0.5f, 0.5f), P(0.5f, 0.3f));
                g.DrawLine(pen, P(0.5f, 0.5f), P(0.64f, 0.58f));
                break;

            case "dollar":
                g.DrawLine(pen, P(0.5f, 0.16f), P(0.5f, 0.84f));
                g.DrawLines(pen, new[]
                {
                    P(0.66f, 0.32f), P(0.4f, 0.32f), P(0.34f, 0.44f), P(0.66f, 0.56f),
                    P(0.6f, 0.68f), P(0.34f, 0.68f),
                });
                break;
        }

        g.SmoothingMode = prevSmoothing;
    }

    private static void DrawArc(Graphics g, Pen pen, RectangleF r, float start, float sweep)
    {
        if (r.Width <= 0 || r.Height <= 0) return;
        g.DrawArc(pen, r.X, r.Y, r.Width, r.Height, start, sweep);
    }

    private static void DrawRoundedPath(Graphics g, Pen pen, RectangleF r, float radius)
    {
        if (r.Width <= 0 || r.Height <= 0) return;
        float d = Math.Min(radius * 2, Math.Min(r.Width, r.Height));
        using var path = new GraphicsPath();
        path.AddArc(r.X, r.Y, d, d, 180, 90);
        path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        g.DrawPath(pen, path);
    }
}
