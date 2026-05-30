using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// CardListPage — the content panel for each dashboard module section.
//
// Architecture notes for Codex:
//  • One CardListPage is created per enabled module in MainForm.BuildPages().
//  • The page is config-driven: title, noun, and addLabel come from ModuleConfig.
//  • SetCards() rebuilds the scrollable list; caller passes pre-built EntityCard list.
//  • SearchChanged event fires on every keystroke; caller re-queries the database.
//  • Empty-state label is shown automatically when SetCards() receives an empty list.
// ---------------------------------------------------------------------------

/// <summary>A section page: title + count, search, "Add" button, and a scrollable list of cards.</summary>
public class CardListPage : Panel
{
    private readonly Label _title;
    private readonly Label _count;
    private readonly SearchBox _search;
    private readonly PillButton _add;
    private readonly PillButton? _listToggle;
    private readonly PillButton? _calendarToggle;
    private readonly Panel _host;
    private readonly Panel _listArea;
    private readonly EmptyStatePanel _empty;
    private readonly CalendarMonthView? _calendar;
    private readonly string _noun;
    private readonly bool _calendarEnabled;
    private bool _showCalendar;

    public event EventHandler? AddClicked;
    public event EventHandler? SearchChanged;
    public event Action<DateTime>? CalendarDateDoubleClicked;
    public string Query => _search.Query;

    public CardListPage(string title, string noun, string addLabel, bool showCalendar = false)
    {
        _noun = noun;
        _calendarEnabled = showCalendar;
        _showCalendar = showCalendar;
        Dock = DockStyle.Fill;
        BackColor = Ui.ContentBg;
        Padding = new Padding(30, 24, 30, 14);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 2,
            BackColor = Ui.ContentBg,
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, 92));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));

        // ---- Header ----
        var header = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };
        _title = new Label
        {
            Text = title, Font = Ui.F(20f, FontStyle.Bold), ForeColor = Ui.TextDark,
            AutoSize = false, Location = new Point(0, 4), Width = 320, Height = 46,
            TextAlign = ContentAlignment.MiddleLeft,
        };
        _count = new Label
        {
            Font = Ui.F(10f), ForeColor = Ui.TextMuted, AutoSize = false, Location = new Point(2, 52),
            Height = 22, TextAlign = ContentAlignment.MiddleLeft,
        };
        _add = new PillButton { Text = addLabel, BaseColor = Ui.Accent, Width = 140, Height = 42 };
        _add.Click += (s, e) => AddClicked?.Invoke(this, EventArgs.Empty);
        _search = new SearchBox($"Search {noun}...") { Width = 250, Height = 42 };
        _search.QueryChanged += (s, e) => SearchChanged?.Invoke(this, EventArgs.Empty);
        if (_calendarEnabled)
        {
            _listToggle = new PillButton { Text = "List", Width = 76, Height = 34, Radius = 9 };
            _calendarToggle = new PillButton { Text = "Calendar", Width = 104, Height = 34, Radius = 9 };
            _listToggle.Click += (s, e) => SetViewMode(showCalendar: false);
            _calendarToggle.Click += (s, e) => SetViewMode(showCalendar: true);
            header.Controls.Add(_listToggle);
            header.Controls.Add(_calendarToggle);
        }

        header.Controls.Add(_title);
        header.Controls.Add(_count);
        header.Controls.Add(_add);
        header.Controls.Add(_search);
        void LayoutHeader()
        {
            var showActions = header.Width >= 560;
            _add.Visible = showActions;
            _search.Visible = showActions;

            var textRight = header.Width;
            if (showActions)
            {
                _add.Location = new Point(header.Width - _add.Width, 12);
                _search.Location = new Point(_add.Left - _search.Width - 12, 12);
                textRight = Math.Max(120, _search.Left - 16);

                if (_calendarEnabled && _listToggle != null && _calendarToggle != null)
                {
                    var showToggles = header.Width >= 760;
                    _listToggle.Visible = showToggles;
                    _calendarToggle.Visible = showToggles;
                    if (showToggles)
                    {
                        _calendarToggle.Location = new Point(_search.Left - _calendarToggle.Width - 12, 16);
                        _listToggle.Location = new Point(_calendarToggle.Left - _listToggle.Width - 6, 16);
                        textRight = Math.Max(120, _listToggle.Left - 16);
                    }
                }
            }
            else if (_calendarEnabled && _listToggle != null && _calendarToggle != null)
            {
                _listToggle.Visible = false;
                _calendarToggle.Visible = false;
            }

            _title.Width = Math.Max(120, textRight);
            _count.Width = Math.Max(120, textRight - 2);
        }

        header.Resize += (s, e) => LayoutHeader();
        header.Layout += (s, e) => LayoutHeader();
        UpdateToggleStyles();

        // ---- List area (host + empty-state overlay) ----
        _listArea = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };

        _empty = new EmptyStatePanel(noun, $"No {noun} yet", $"Add your first {noun.TrimEnd('s')} to get started.", addLabel)
        {
            Dock = DockStyle.Fill, Visible = false,
        };
        _empty.ActionClicked += (s, e) => AddClicked?.Invoke(this, EventArgs.Empty);

        // Plain AutoScroll panel: cards docked Top reliably stretch to the panel
        // width (minus scrollbar) and reflow on resize — no manual width math.
        _host = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            BackColor = Ui.ContentBg,
            Padding = new Padding(0, 14, 6, 8),
        };

        if (_calendarEnabled)
        {
            _calendar = new CalendarMonthView
            {
                Dock = DockStyle.Fill,
                Visible = _showCalendar,
                Margin = new Padding(0),
            };
            _calendar.DateDoubleClicked += date => CalendarDateDoubleClicked?.Invoke(date);
            _listArea.Controls.Add(_calendar);
        }

        _listArea.Controls.Add(_empty);
        _listArea.Controls.Add(_host);
        _host.BringToFront();

        root.Controls.Add(header, 0, 0);
        root.Controls.Add(_listArea, 0, 1);
        Controls.Add(root);
        UpdateContentVisibility(0);
    }

    public void SetCards(List<EntityCard> cards)
    {
        _host.SuspendLayout();
        foreach (Control c in _host.Controls) c.Dispose();
        _host.Controls.Clear();

        // Add in reverse: Dock=Top stacks last-added on top, so this yields
        // cards[0] at the top down to cards[^1] at the bottom.
        for (int i = cards.Count - 1; i >= 0; i--)
        {
            cards[i].Dock = DockStyle.Top;
            _host.Controls.Add(cards[i]);
        }
        _host.ResumeLayout();

        UpdateContentVisibility(cards.Count);
    }

    public void SetCalendarItems(List<CalendarItem> items)
    {
        if (_calendar == null) return;

        _calendar.SetItems(items);
        UpdateContentVisibility(_host.Controls.Count);
    }

    private void SetViewMode(bool showCalendar)
    {
        if (!_calendarEnabled) return;

        _showCalendar = showCalendar;
        UpdateToggleStyles();
        UpdateContentVisibility(_host.Controls.Count);
    }

    private void UpdateContentVisibility(int cardCount)
    {
        _count.Text = cardCount == 1 ? $"1 {_noun.TrimEnd('s')}" : $"{cardCount} {_noun}";

        if (_calendarEnabled && _showCalendar && _calendar != null)
        {
            _host.Visible = false;
            _empty.Visible = false;
            _calendar.Visible = true;
            _calendar.BringToFront();
            return;
        }

        if (_calendar != null) _calendar.Visible = false;
        _host.Visible = cardCount > 0;
        _empty.Visible = cardCount == 0;
        if (_empty.Visible) _empty.BringToFront();
    }

    private void UpdateToggleStyles()
    {
        if (_listToggle == null || _calendarToggle == null) return;

        StyleToggle(_listToggle, !_showCalendar);
        StyleToggle(_calendarToggle, _showCalendar);
    }

    private static void StyleToggle(PillButton button, bool selected)
    {
        button.BaseColor = selected ? Ui.Accent : Color.FromArgb(228, 232, 238);
        button.ForeColor = selected ? Color.White : Ui.TextDark;
        button.Invalidate();
    }
}

/// <summary>A calm, centered empty state: soft icon, headline, subline, and a primary action.</summary>
internal class EmptyStatePanel : Panel
{
    private readonly string _iconKey;
    private readonly string _title;
    private readonly string _subtitle;
    private readonly PillButton _action;

    public event EventHandler? ActionClicked;

    public EmptyStatePanel(string iconKey, string title, string subtitle, string actionLabel)
    {
        _iconKey = iconKey;
        _title = title;
        _subtitle = subtitle;
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Ui.ContentBg;

        _action = new PillButton { Text = actionLabel, BaseColor = Ui.Accent, Width = 168, Height = 42 };
        _action.Click += (s, e) => ActionClicked?.Invoke(this, EventArgs.Empty);
        Controls.Add(_action);
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (_action == null) return;
        _action.Location = new Point((Width - _action.Width) / 2, Height / 2 + 52);
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        int cx = Width / 2;
        int cy = Height / 2;

        // Soft accent icon circle.
        const int d = 72;
        var circle = new Rectangle(cx - d / 2, cy - 98, d, d);
        using (var b = new SolidBrush(Ui.Soft(Ui.Accent, 22)))
            g.FillEllipse(b, circle);
        if (Icons.Has(_iconKey))
            Icons.Draw(g, _iconKey, new Rectangle(circle.X + 20, circle.Y + 20, 32, 32), Ui.Accent, 2f);

        TextRenderer.DrawText(g, _title, Ui.F(14f, FontStyle.Bold),
            new Rectangle(0, cy - 16, Width, 26), Ui.TextStrong,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
        TextRenderer.DrawText(g, _subtitle, Ui.F(10.5f),
            new Rectangle(0, cy + 12, Width, 22), Ui.TextMuted,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter);
    }
}
