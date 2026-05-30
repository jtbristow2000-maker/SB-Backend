using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

public enum FieldKind { Text, Multiline, Combo, Date, Time }

public class FieldDef
{
    public string Key = "";
    public string Label = "";
    public FieldKind Kind = FieldKind.Text;
    public string Value = "";
    public string[]? Options;
    public bool Required;

    public FieldDef() { }
    public FieldDef(string key, string label, string value = "", bool required = false)
    { Key = key; Label = label; Value = value; Required = required; }
}

/// <summary>A reusable, styled add/edit dialog built from a list of fields.</summary>
public class FieldDialog : Form
{
    private readonly Dictionary<string, Control> _inputs = new();
    private readonly Dictionary<string, FieldDef> _defs = new();
    public Dictionary<string, string> Values { get; } = new();

    private const int FormWidth = 460;
    private const int HeaderH = 62;
    private const int FooterH = 66;
    private const int ModalRadius = 16;
    private const int BorderPad = 2;
    private static readonly Color ModalBorderColor = Color.FromArgb(132, 146, 170);

    public FieldDialog(string title, List<FieldDef> fields)
    {
        Text = title;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterParent;
        BackColor = ModalBorderColor;
        Font = Ui.F(10f);
        ShowInTaskbar = false;
        Padding = new Padding(BorderPad);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            BackColor = Ui.ContentBg,
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, HeaderH));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, FooterH));

        // ---- Header ----
        var header = new Panel { Dock = DockStyle.Fill, BackColor = Ui.SidebarBg };
        var hTitle = new Label
        {
            Text = title, ForeColor = Color.White, Font = Ui.F(14f, FontStyle.Bold),
            Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft, Padding = new Padding(22, 0, 0, 0),
        };
        var close = new Label
        {
            Text = "✕", ForeColor = Color.FromArgb(180, 190, 210), Font = Ui.F(12f),
            Dock = DockStyle.Right, Width = 52, TextAlign = ContentAlignment.MiddleCenter, Cursor = Cursors.Hand,
        };
        close.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
        close.MouseEnter += (s, e) => close.ForeColor = Color.White;
        close.MouseLeave += (s, e) => close.ForeColor = Color.FromArgb(180, 190, 210);
        header.Controls.Add(hTitle);
        header.Controls.Add(close);
        header.MouseDown += (s, e) => DragWindow();
        hTitle.MouseDown += (s, e) => DragWindow();

        // ---- Body (stacked fields) ----
        var body = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            BackColor = Ui.ContentBg,
            Padding = new Padding(22, 16, 22, 10),
        };

        foreach (var f in fields)
        {
            _defs[f.Key] = f;
            body.Controls.Add(new Label
            {
                Text = f.Required ? f.Label + "  *" : f.Label,
                Font = Ui.F(9f, FontStyle.Bold), ForeColor = Ui.TextMuted,
                AutoSize = true, Margin = new Padding(2, 8, 0, 4),
            });

            Control input;
            if (f.Kind == FieldKind.Combo)
            {
                var cb = new ComboBox
                {
                    DropDownStyle = ComboBoxStyle.DropDownList, Font = Ui.F(10.5f),
                    Width = FormWidth - 56, Height = 36, FlatStyle = FlatStyle.Flat, Margin = new Padding(0, 0, 0, 4),
                    BackColor = Color.White,
                };
                cb.Items.AddRange(f.Options ?? []);
                cb.SelectedItem = f.Value;
                if (cb.SelectedIndex < 0 && cb.Items.Count > 0) cb.SelectedIndex = 0;
                input = cb;
            }
            else if (f.Kind == FieldKind.Date)
            {
                var picker = new DateTimePicker
                {
                    Font = Ui.F(10.5f),
                    Width = FormWidth - 56,
                    Height = 36,
                    Format = DateTimePickerFormat.Custom,
                    CustomFormat = "MM/dd/yyyy",
                    CalendarFont = Ui.F(10f),
                    Margin = new Padding(0, 0, 0, 4),
                };
                picker.Value = ParseDate(f.Value, DateTime.Today);
                input = picker;
            }
            else if (f.Kind == FieldKind.Time)
            {
                var picker = new DateTimePicker
                {
                    Font = Ui.F(10.5f),
                    Width = FormWidth - 56,
                    Height = 36,
                    Format = DateTimePickerFormat.Custom,
                    CustomFormat = "h:mm tt",
                    ShowUpDown = true,
                    Margin = new Padding(0, 0, 0, 4),
                };
                picker.Value = ParseTime(f.Value, DateTime.Today.AddHours(9));
                input = picker;
            }
            else if (f.Kind == FieldKind.Multiline)
            {
                var tb = new TextBox
                {
                    Font = Ui.F(10.5f),
                    Width = FormWidth - 56,
                    Height = 70,
                    Text = f.Value,
                    Multiline = true,
                    ScrollBars = ScrollBars.Vertical,
                    BorderStyle = BorderStyle.FixedSingle,
                    Margin = new Padding(0, 0, 0, 4),
                };
                input = tb;
            }
            else
            {
                var wrapped = new StyledInputPanel(f.Value)
                {
                    Width = FormWidth - 56,
                    Height = 36,
                    Margin = new Padding(0, 0, 0, 4),
                };
                input = wrapped.Inner;
                body.Controls.Add(wrapped);
                _inputs[f.Key] = input;
                continue;
            }
            _inputs[f.Key] = input;
            body.Controls.Add(input);
        }

        // ---- Footer (buttons) ----
        var footer = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };
        var save = new PillButton { Text = "Save", BaseColor = Ui.Accent, Width = 112, Height = 40 };
        var cancel = new PillButton { Text = "Cancel", BaseColor = Color.FromArgb(228, 232, 238), ForeColor = Ui.TextDark, Width = 104, Height = 40 };
        save.Click += Save_Click;
        cancel.Click += (s, e) => { DialogResult = DialogResult.Cancel; Close(); };
        footer.Controls.Add(save);
        footer.Controls.Add(cancel);
        footer.Resize += (s, e) =>
        {
            save.Location = new Point(footer.Width - 22 - save.Width, 13);
            cancel.Location = new Point(save.Left - cancel.Width - 8, 13);
        };

        root.Controls.Add(header, 0, 0);
        root.Controls.Add(body, 0, 1);
        root.Controls.Add(footer, 0, 2);
        Controls.Add(root);

        // Size the form to fit the fields.
        body.PerformLayout();
        int bodyH = Math.Min(590, body.PreferredSize.Height + 6);
        ClientSize = new Size(FormWidth, HeaderH + bodyH + FooterH);
        ApplyRoundedRegion();
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        ApplyRoundedRegion();
    }

    private void ApplyRoundedRegion()
    {
        if (Width <= 0 || Height <= 0) return;
        var oldRegion = Region;
        using var path = Ui.RoundedRect(new Rectangle(0, 0, Width, Height), ModalRadius);
        Region = new Region(path);
        oldRegion?.Dispose();
    }

    private void Save_Click(object? sender, EventArgs e)
    {
        foreach (var (key, ctrl) in _inputs)
        {
            string val = ReadInputValue(ctrl);
            if (_defs[key].Required && string.IsNullOrWhiteSpace(val))
            {
                MessageBox.Show($"\"{_defs[key].Label}\" is required.", "Required field",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                ctrl.Focus();
                return;
            }
            Values[key] = val;
        }
        DialogResult = DialogResult.OK;
        Close();
    }

    private static string ReadInputValue(Control ctrl) => ctrl switch
    {
        ComboBox cb => cb.SelectedItem?.ToString() ?? "",
        DateTimePicker { ShowUpDown: true } picker => picker.Value.ToString("h:mm tt"),
        DateTimePicker picker => picker.Value.ToString("MM/dd/yyyy"),
        _ => ctrl.Text.Trim(),
    };

    private static DateTime ParseDate(string? value, DateTime fallback) =>
        DateTime.TryParse(value, out var parsed) ? parsed : fallback;

    private static DateTime ParseTime(string? value, DateTime fallback)
    {
        if (DateTime.TryParse(value, out var parsed))
            return DateTime.Today.Add(parsed.TimeOfDay);

        return fallback;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        var rect = new Rectangle(1, 1, Width - 3, Height - 3);
        using var pen = new Pen(ModalBorderColor, 2f);
        using var path = Ui.RoundedRect(rect, ModalRadius);
        e.Graphics.DrawPath(pen, path);
    }

    private const int WM_NCLBUTTONDOWN = 0xA1;
    private const int HTCAPTION = 0x2;
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr h, int m, int w, int l);
    private void DragWindow() { ReleaseCapture(); SendMessage(Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0); }
}
