using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// CalendarWeekView — a 7-day week with an hourly time axis on the left.
//
// Appointment chips are positioned vertically to correlate with their parsed
// start time on the axis (7 AM – 7 PM window). Shares CalendarItem with the
// month view. Click a chip → ItemClicked; double-click an empty day column →
// DateDoubleClicked(thatDay).
// ---------------------------------------------------------------------------

/// <summary>A week calendar with an hourly time axis; chips sit at their time.</summary>
public class CalendarWeekView : Control
{
    private const int StartHour = 7;    // 7 AM
    private const int EndHour = 19;     // 7 PM
    private const int AxisW = 56;
    private const int DayHeaderH = 34;

    private readonly List<CalendarItem> _items = new();
    private readonly List<(Rectangle Rect, CalendarItem Item)> _itemRects = new();
    private readonly Dictionary<DateTime, Rectangle> _dayColumns = new();
    private readonly ToolTip _detailsTip = new()
    {
        AutomaticDelay = 180,
        AutoPopDelay = 12000,
        InitialDelay = 180,
        ReshowDelay = 80,
        ShowAlways = true,
    };

    private DateTime _weekStart = StartOfWeek(DateTime.Today);
    private CalendarItem? _hoverItem;
    private Rectangle _prevRect;
    private Rectangle _nextRect;

    public event Action<DateTime>? DateDoubleClicked;
    public event Action<CalendarItem>? ItemClicked;

    public CalendarWeekView()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Ui.ContentBg;
        Cursor = Cursors.Default;
    }

    public void SetItems(IEnumerable<CalendarItem> items)
    {
        _items.Clear();
        _items.AddRange(items.OrderBy(i => i.Date).ThenBy(i => i.Time));
        Invalidate();
    }

    private static DateTime StartOfWeek(DateTime d) => d.Date.AddDays(-(int)d.DayOfWeek); // Sunday start

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        var hit = HitItem(e.Location);
        Cursor = hit != null || _prevRect.Contains(e.Location) || _nextRect.Contains(e.Location)
            ? Cursors.Hand : Cursors.Default;
        if (!ReferenceEquals(hit, _hoverItem))
        {
            _hoverItem = hit;
            ShowTip(hit, e.Location);
            Invalidate();
        }
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        _hoverItem = null;
        _detailsTip.Hide(this);
        Cursor = Cursors.Default;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left) return;

        if (_prevRect.Contains(e.Location)) { _weekStart = _weekStart.AddDays(-7); Invalidate(); }
        else if (_nextRect.Contains(e.Location)) { _weekStart = _weekStart.AddDays(7); Invalidate(); }
        else if (HitItem(e.Location) is { } item) ItemClicked?.Invoke(item);
    }

    protected override void OnMouseDoubleClick(MouseEventArgs e)
    {
        base.OnMouseDoubleClick(e);
        if (HitItem(e.Location) != null) return;
        foreach (var pair in _dayColumns)
            if (pair.Value.Contains(e.Location)) { DateDoubleClicked?.Invoke(pair.Key); return; }
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
        g.Clear(Ui.ContentBg);

        var outer = new Rectangle(0, 0, Width - 1, Height - 1);
        if (outer.Width < 320 || outer.Height < 240) return;

        using (var path = Ui.RoundedRect(outer, 14))
        using (var fill = new SolidBrush(Color.White))
        using (var pen = new Pen(Ui.CardBorder))
        {
            g.FillPath(fill, path);
            g.DrawPath(pen, path);
        }

        DrawHeader(g, outer);
        DrawWeek(g, outer);
    }

    private void DrawHeader(Graphics g, Rectangle outer)
    {
        var header = new Rectangle(18, 12, outer.Width - 36, 46);
        var weekEnd = _weekStart.AddDays(6);
        var rangeText = _weekStart.Month == weekEnd.Month
            ? $"{_weekStart:MMMM d} – {weekEnd.Day}, {weekEnd:yyyy}"
            : $"{_weekStart:MMM d} – {weekEnd:MMM d, yyyy}";
        TextRenderer.DrawText(g, rangeText, Ui.F(14f, FontStyle.Bold), header, Ui.TextDark,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);

        _prevRect = new Rectangle(header.Left, header.Top + 7, 32, 32);
        _nextRect = new Rectangle(header.Right - 32, header.Top + 7, 32, 32);
        DrawHeaderButton(g, _prevRect, "<");
        DrawHeaderButton(g, _nextRect, ">");

        TextRenderer.DrawText(g, "Double-click a day to add • click an appointment to edit", Ui.F(8.5f),
            new Rectangle(header.Left, header.Bottom - 5, header.Width, 20), Ui.TextMuted,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
    }

    private static void DrawHeaderButton(Graphics g, Rectangle rect, string text)
    {
        using var path = Ui.RoundedRect(rect, rect.Height / 2);
        using var fill = new SolidBrush(Color.FromArgb(246, 248, 251));
        using var pen = new Pen(Ui.CardBorder);
        g.FillPath(fill, path);
        g.DrawPath(pen, path);
        TextRenderer.DrawText(g, text, Ui.F(10f, FontStyle.Bold), rect, Ui.TextMuted,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }

    private void DrawWeek(Graphics g, Rectangle outer)
    {
        _itemRects.Clear();
        _dayColumns.Clear();

        var area = new Rectangle(18, 76, outer.Width - 36, outer.Height - 94);
        var gridLeft = area.Left + AxisW;
        var gridTop = area.Top + DayHeaderH;
        var gridW = area.Right - gridLeft;
        var gridH = area.Bottom - gridTop;
        if (gridW < 7 || gridH < 24) return;

        var colW = gridW / 7f;
        var hours = EndHour - StartHour;
        var rowH = gridH / (float)hours;
        var today = DateTime.Today;

        // Hour gridlines + axis labels.
        using (var linePen = new Pen(Color.FromArgb(238, 240, 244)))
        {
            for (var h = 0; h <= hours; h++)
            {
                var y = gridTop + (int)(h * rowH);
                g.DrawLine(linePen, gridLeft, y, area.Right, y);
                if (h < hours)
                {
                    var hr = StartHour + h;
                    var label = hr == 12 ? "12 PM" : hr < 12 ? $"{hr} AM" : $"{hr - 12} PM";
                    TextRenderer.DrawText(g, label, Ui.F(7.5f, FontStyle.Bold),
                        new Rectangle(area.Left, y + 2, AxisW - 8, 16), Ui.TextMuted,
                        TextFormatFlags.Right | TextFormatFlags.Top);
                }
            }
        }

        // Day headers + column separators.
        using (var sepPen = new Pen(Color.FromArgb(238, 240, 244)))
        {
            for (var c = 0; c < 7; c++)
            {
                var date = _weekStart.AddDays(c);
                var x = (int)(gridLeft + c * colW);
                var nextX = (int)(gridLeft + (c + 1) * colW);
                var colRect = new Rectangle(x, gridTop, nextX - x, gridH);
                _dayColumns[date] = colRect;

                if (c > 0) g.DrawLine(sepPen, x, gridTop, x, area.Bottom);

                var isToday = date == today;
                var hdr = new Rectangle(x, area.Top, nextX - x, DayHeaderH);
                if (isToday)
                {
                    using var tb = new SolidBrush(Color.FromArgb(245, 249, 255));
                    using var tp = Ui.RoundedRect(new Rectangle(hdr.X + 3, hdr.Y + 2, hdr.Width - 6, hdr.Height - 4), 8);
                    g.FillPath(tb, tp);
                }
                TextRenderer.DrawText(g, $"{date:ddd} {date.Day}", Ui.F(8.5f, isToday ? FontStyle.Bold : FontStyle.Regular),
                    hdr, isToday ? Ui.Accent : Ui.TextDark,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
            }
        }

        // Items positioned by start time (with simple per-column overlap nudging).
        var spanMin = hours * 60.0;
        var lastBottom = new int[7];
        for (var c = 0; c < 7; c++) lastBottom[c] = gridTop;

        foreach (var group in _items
                     .Where(i => i.Date.Date >= _weekStart && i.Date.Date <= _weekStart.AddDays(6))
                     .GroupBy(i => i.Date.Date))
        {
            var c = (int)(group.Key - _weekStart).TotalDays;
            if (c < 0 || c > 6) continue;
            var x = (int)(gridLeft + c * colW);
            var nextX = (int)(gridLeft + (c + 1) * colW);

            foreach (var item in group.OrderBy(i => ParseMinutes(i.Time) ?? 0))
            {
                int y;
                if (ParseMinutes(item.Time) is double m)
                {
                    var rel = Math.Clamp((m - StartHour * 60) / spanMin, 0, 1);
                    y = gridTop + (int)(rel * gridH);
                }
                else y = gridTop;

                const int chipH = 20;
                if (y < lastBottom[c]) y = lastBottom[c];
                if (y + chipH > area.Bottom) y = area.Bottom - chipH;

                var chip = new Rectangle(x + 3, y, (nextX - x) - 6, chipH);
                DrawChip(g, chip, item);
                _itemRects.Add((chip, item));
                lastBottom[c] = y + chipH + 2;
            }
        }
    }

    private static double? ParseMinutes(string time)
    {
        if (string.IsNullOrWhiteSpace(time)) return null;
        return DateTime.TryParse(time, out var dt) ? dt.TimeOfDay.TotalMinutes : null;
    }

    private static void DrawChip(Graphics g, Rectangle chip, CalendarItem item)
    {
        var color = item.IsReminder ? Ui.Warning : item.Color;
        using (var path = Ui.RoundedRect(chip, 6))
        using (var fill = new SolidBrush(Color.FromArgb(36, color)))
        using (var pen = new Pen(Color.FromArgb(90, color)))
        {
            g.FillPath(fill, path);
            g.DrawPath(pen, path);
        }
        using (var bar = new SolidBrush(color))
            g.FillRectangle(bar, chip.X + 2, chip.Y + 3, 3, chip.Height - 6);

        var text = string.IsNullOrWhiteSpace(item.Time) ? item.Title : $"{item.Time}  {item.Title}";
        TextRenderer.DrawText(g, text, Ui.F(7.8f, FontStyle.Bold),
            new Rectangle(chip.X + 9, chip.Y, chip.Width - 12, chip.Height), color,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
    }

    private CalendarItem? HitItem(Point p)
    {
        foreach (var pair in _itemRects)
            if (pair.Rect.Contains(p)) return pair.Item;
        return null;
    }

    private void ShowTip(CalendarItem? item, Point loc)
    {
        if (item == null || string.IsNullOrWhiteSpace(item.Details)) { _detailsTip.Hide(this); return; }
        _detailsTip.Show(item.Details, this, loc.X + 14, loc.Y + 18, 12000);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _detailsTip.Dispose();
        base.Dispose(disposing);
    }
}
