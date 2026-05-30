using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

public sealed class CalendarItem
{
    public DateTime Date { get; init; }
    public string Time { get; init; } = "";
    public string Title { get; init; } = "";
    public string Subtitle { get; init; } = "";
    public string Details { get; init; } = "";
    public Color Color { get; init; } = Ui.Accent;
    public bool IsReminder { get; init; }
}

public class CalendarMonthView : Control
{
    private readonly List<CalendarItem> _items = new();
    private readonly Dictionary<DateTime, Rectangle> _dayRects = new();
    private readonly List<(Rectangle Rect, CalendarItem Item)> _itemRects = new();
    private readonly ToolTip _detailsTip = new()
    {
        AutomaticDelay = 180,
        AutoPopDelay = 12000,
        InitialDelay = 180,
        ReshowDelay = 80,
        ShowAlways = true,
    };
    private DateTime _month = new(DateTime.Today.Year, DateTime.Today.Month, 1);
    private DateTime? _hoverDate;
    private CalendarItem? _hoverItem;
    private Rectangle _prevRect;
    private Rectangle _nextRect;

    public event Action<DateTime>? DateDoubleClicked;

    public CalendarMonthView()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Ui.ContentBg;
        Cursor = Cursors.Default;
    }

    public void SetItems(IEnumerable<CalendarItem> items)
    {
        _items.Clear();
        _items.AddRange(items.OrderBy(item => item.Date).ThenBy(item => item.Time));
        Invalidate();
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        var hitItem = HitItem(e.Location);
        var hitDate = HitDate(e.Location);
        if (_hoverDate == hitDate && ReferenceEquals(_hoverItem, hitItem)) return;

        _hoverDate = hitDate;
        _hoverItem = hitItem;
        Cursor = hitDate.HasValue || hitItem != null ? Cursors.Hand : Cursors.Default;
        ShowDetailsTip(hitItem, e.Location);
        Invalidate();
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        _hoverDate = null;
        _hoverItem = null;
        Cursor = Cursors.Default;
        _detailsTip.Hide(this);
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left) return;

        if (_prevRect.Contains(e.Location))
        {
            _month = _month.AddMonths(-1);
            Invalidate();
        }
        else if (_nextRect.Contains(e.Location))
        {
            _month = _month.AddMonths(1);
            Invalidate();
        }
    }

    protected override void OnMouseDoubleClick(MouseEventArgs e)
    {
        base.OnMouseDoubleClick(e);
        if (HitDate(e.Location) is { } date)
            DateDoubleClicked?.Invoke(date);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;
        g.Clear(Ui.ContentBg);

        var outer = new Rectangle(0, 0, Width - 1, Height - 1);
        if (outer.Width < 240 || outer.Height < 220) return;

        using (var path = Ui.RoundedRect(outer, 14))
        using (var fill = new SolidBrush(Color.White))
        using (var pen = new Pen(Ui.CardBorder))
        {
            g.FillPath(fill, path);
            g.DrawPath(pen, path);
        }

        DrawHeader(g, outer);
        DrawGrid(g, outer);
    }

    private void DrawHeader(Graphics g, Rectangle outer)
    {
        var header = new Rectangle(18, 12, outer.Width - 36, 46);
        var monthText = _month.ToString("MMMM yyyy");
        TextRenderer.DrawText(g, monthText, Ui.F(14f, FontStyle.Bold), header, Ui.TextDark,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);

        _prevRect = new Rectangle(header.Left, header.Top + 7, 32, 32);
        _nextRect = new Rectangle(header.Right - 32, header.Top + 7, 32, 32);
        DrawHeaderButton(g, _prevRect, "<");
        DrawHeaderButton(g, _nextRect, ">");

        TextRenderer.DrawText(g, "Double-click a day to add an appointment", Ui.F(8.5f),
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

    private void DrawGrid(Graphics g, Rectangle outer)
    {
        _dayRects.Clear();
        _itemRects.Clear();
        var grid = new Rectangle(18, 76, outer.Width - 36, outer.Height - 94);
        var dayHeaderH = 26;
        var days = new[] { "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" };
        var colW = Math.Max(1, grid.Width / 7);
        var rowH = Math.Max(1, (grid.Height - dayHeaderH) / 6);

        for (var c = 0; c < 7; c++)
        {
            var r = new Rectangle(grid.Left + c * colW, grid.Top, c == 6 ? grid.Right - (grid.Left + c * colW) : colW, dayHeaderH);
            TextRenderer.DrawText(g, days[c], Ui.F(8.5f, FontStyle.Bold), r, Ui.TextMuted,
                TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        }

        var first = new DateTime(_month.Year, _month.Month, 1);
        var start = first.AddDays(-(int)first.DayOfWeek);
        var today = DateTime.Today;
        var itemsByDay = _items.GroupBy(item => item.Date.Date)
            .ToDictionary(group => group.Key, group => group.ToList());

        for (var i = 0; i < 42; i++)
        {
            var date = start.AddDays(i);
            var col = i % 7;
            var row = i / 7;
            var cell = new Rectangle(
                grid.Left + col * colW,
                grid.Top + dayHeaderH + row * rowH,
                col == 6 ? grid.Right - (grid.Left + col * colW) : colW,
                row == 5 ? grid.Bottom - (grid.Top + dayHeaderH + row * rowH) : rowH);
            cell.Inflate(-3, -3);
            _dayRects[date.Date] = cell;

            DrawDayCell(g, cell, date, date.Month == _month.Month, date.Date == today, itemsByDay);
        }
    }

    private void DrawDayCell(
        Graphics g,
        Rectangle cell,
        DateTime date,
        bool currentMonth,
        bool isToday,
        Dictionary<DateTime, List<CalendarItem>> itemsByDay)
    {
        var isHover = _hoverDate == date.Date;
        var fillColor = isToday
            ? Color.FromArgb(245, 249, 255)
            : isHover
                ? Color.FromArgb(248, 250, 253)
                : Color.White;
        var borderColor = isToday ? Ui.Accent : isHover ? Ui.CardBorderHover : Ui.CardBorder;

        using (var path = Ui.RoundedRect(cell, 10))
        using (var fill = new SolidBrush(fillColor))
        using (var pen = new Pen(borderColor, isToday ? 1.6f : 1f))
        {
            g.FillPath(fill, path);
            g.DrawPath(pen, path);
        }

        var numberColor = currentMonth ? Ui.TextDark : Color.FromArgb(168, 176, 190);
        TextRenderer.DrawText(g, date.Day.ToString(), Ui.F(8.5f, isToday ? FontStyle.Bold : FontStyle.Regular),
            new Rectangle(cell.Left + 7, cell.Top + 5, 34, 18), numberColor,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter);

        if (!itemsByDay.TryGetValue(date.Date, out var dayItems)) return;

        var chipY = cell.Top + 28;
        var maxVisible = Math.Max(1, (cell.Bottom - chipY - 6) / 22);
        foreach (var item in dayItems.Take(maxVisible))
        {
            var chip = new Rectangle(cell.Left + 6, chipY, cell.Width - 12, 19);
            DrawChip(g, chip, item);
            _itemRects.Add((chip, item));
            chipY += 22;
        }

        var hidden = dayItems.Count - maxVisible;
        if (hidden > 0)
        {
            TextRenderer.DrawText(g, $"+{hidden} more", Ui.F(8f, FontStyle.Bold),
                new Rectangle(cell.Left + 7, chipY, cell.Width - 14, 18), Ui.TextMuted,
                TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        }
    }

    private static void DrawChip(Graphics g, Rectangle chip, CalendarItem item)
    {
        var color = item.IsReminder ? Ui.Warning : item.Color;
        using (var path = Ui.RoundedRect(chip, 6))
        using (var fill = new SolidBrush(Color.FromArgb(28, color)))
            g.FillPath(fill, path);

        var text = string.IsNullOrWhiteSpace(item.Time)
            ? item.Title
            : $"{item.Time}  {item.Title}";
        TextRenderer.DrawText(g, text, Ui.F(7.8f, FontStyle.Bold), chip, color,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
    }

    private DateTime? HitDate(Point point)
    {
        foreach (var pair in _dayRects)
        {
            if (pair.Value.Contains(point))
                return pair.Key;
        }

        return null;
    }

    private CalendarItem? HitItem(Point point)
    {
        foreach (var pair in _itemRects)
        {
            if (pair.Rect.Contains(point))
                return pair.Item;
        }

        return null;
    }

    private void ShowDetailsTip(CalendarItem? item, Point location)
    {
        if (item == null || string.IsNullOrWhiteSpace(item.Details))
        {
            _detailsTip.Hide(this);
            return;
        }

        _detailsTip.Show(item.Details, this, location.X + 14, location.Y + 18, 12000);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
            _detailsTip.Dispose();

        base.Dispose(disposing);
    }
}
