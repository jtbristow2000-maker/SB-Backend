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
    private readonly Panel _host;
    private readonly Label _empty;
    private readonly string _noun;

    public event EventHandler? AddClicked;
    public event EventHandler? SearchChanged;
    public string Query => _search.Query;

    public CardListPage(string title, string noun, string addLabel)
    {
        _noun = noun;
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
            }

            _title.Width = Math.Max(120, textRight);
            _count.Width = Math.Max(120, textRight - 2);
        }

        header.Resize += (s, e) => LayoutHeader();
        header.Layout += (s, e) => LayoutHeader();

        // ---- List area (host + empty-state overlay) ----
        var listArea = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };

        _empty = new Label
        {
            Text = $"No {noun} yet.\n\nClick \"{addLabel}\" to add your first one.",
            Font = Ui.F(11.5f), ForeColor = Ui.TextMuted,
            TextAlign = ContentAlignment.MiddleCenter, Dock = DockStyle.Fill, Visible = false,
        };

        // Plain AutoScroll panel: cards docked Top reliably stretch to the panel
        // width (minus scrollbar) and reflow on resize — no manual width math.
        _host = new Panel
        {
            Dock = DockStyle.Fill,
            AutoScroll = true,
            BackColor = Ui.ContentBg,
            Padding = new Padding(0, 14, 6, 8),
        };

        listArea.Controls.Add(_empty);
        listArea.Controls.Add(_host);
        _host.BringToFront();

        root.Controls.Add(header, 0, 0);
        root.Controls.Add(listArea, 0, 1);
        Controls.Add(root);
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

        _count.Text = cards.Count == 1 ? $"1 {_noun.TrimEnd('s')}" : $"{cards.Count} {_noun}";
        _host.Visible = cards.Count > 0;
        _empty.Visible = cards.Count == 0;
        if (_empty.Visible) _empty.BringToFront();
    }
}
