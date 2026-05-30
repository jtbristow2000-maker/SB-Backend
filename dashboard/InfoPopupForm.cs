using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// InfoPopupForm — a small, resizable, read-only popup for viewing one record.
//
// Used by MainForm to show a message (click a message card) or a quote
// (click a quote card). Title + meta line + body text. The body is a
// RichTextBox so the scrollbar only appears when the text actually overflows.
// The borderless rounded window is user-resizable (WndProc edge hit-testing).
// ---------------------------------------------------------------------------

/// <summary>A rounded, resizable, read-only popup that displays a title, meta line, and body.</summary>
public class InfoPopupForm : Form
{
    private const int FormWidth = 460;
    private const int HeaderH = 64;
    private const int FooterH = 60;
    private const int ModalRadius = 12;
    private static readonly Color ModalBorderColor = Color.FromArgb(132, 146, 170);

    public InfoPopupForm(string title, string meta, string body)
    {
        Text = title;
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterParent;
        BackColor = Color.White;
        Font = Ui.F(10f);
        ShowInTaskbar = false;

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            BackColor = Color.White,
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, HeaderH));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, FooterH));

        // ---- Header (title + close) ----
        var header = new Panel { Dock = DockStyle.Fill, BackColor = Ui.SidebarBg };
        var titleLabel = new Label
        {
            Text = string.IsNullOrWhiteSpace(title) ? "Details" : title,
            ForeColor = Color.White, Font = Ui.F(13.5f, FontStyle.Bold),
            Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(22, 0, 0, 0),
        };
        var close = new Label
        {
            Text = "✕", ForeColor = Color.FromArgb(180, 190, 210), Font = Ui.F(12f),
            Dock = DockStyle.Right, Width = 52, TextAlign = ContentAlignment.MiddleCenter, Cursor = Cursors.Hand,
        };
        close.Click += (s, e) => Close();
        close.MouseEnter += (s, e) => close.ForeColor = Color.White;
        close.MouseLeave += (s, e) => close.ForeColor = Color.FromArgb(180, 190, 210);
        header.Controls.Add(titleLabel);
        header.Controls.Add(close);
        header.MouseDown += (s, e) => DragWindow();
        titleLabel.MouseDown += (s, e) => DragWindow();

        // ---- Body (meta + content) ----
        var bodyPanel = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(22, 14, 22, 10) };
        var metaLabel = new Label
        {
            Text = meta,
            Dock = DockStyle.Top, Height = 22,
            ForeColor = Ui.TextMuted, Font = Ui.F(9.5f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft,
        };
        // RichTextBox hides its scrollbar automatically when the text fits.
        var content = new RichTextBox
        {
            Text = string.IsNullOrWhiteSpace(body) ? "(No details)" : body,
            Dock = DockStyle.Fill,
            ReadOnly = true,
            BorderStyle = BorderStyle.None,
            BackColor = Color.White,
            ForeColor = Ui.TextBody,
            Font = Ui.F(11f),
            ScrollBars = RichTextBoxScrollBars.Vertical,
            TabStop = false,
            Cursor = Cursors.Default,
        };
        bodyPanel.Controls.Add(content);
        bodyPanel.Controls.Add(metaLabel);

        // ---- Footer (Close) ----
        var footer = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
        var ok = new PillButton { Text = "Close", BaseColor = Ui.Accent, Width = 110, Height = 38 };
        ok.Click += (s, e) => Close();
        footer.Controls.Add(ok);
        footer.Resize += (s, e) => ok.Location = new Point(footer.Width - 22 - ok.Width, 11);
        content.GotFocus += (s, e) => ok.Focus();   // avoid a blinking caret in the read-only body

        root.Controls.Add(header, 0, 0);
        root.Controls.Add(bodyPanel, 0, 1);
        root.Controls.Add(footer, 0, 2);
        Controls.Add(root);

        int bodyTextH = Math.Min(420, Math.Max(150, MeasureBody(body)));
        ClientSize = new Size(FormWidth, HeaderH + bodyTextH + FooterH);
        MinimumSize = new Size(360, 240);
        ApplyRoundedRegion();
    }

    private static int MeasureBody(string body)
    {
        using var f = Ui.F(11f);
        var sz = TextRenderer.MeasureText(body ?? "", f, new Size(FormWidth - 44, 0),
            TextFormatFlags.WordBreak | TextFormatFlags.TextBoxControl);
        return sz.Height + 44;   // + meta line + padding
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

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var pen = new Pen(ModalBorderColor, 2f);
        using var path = Ui.RoundedRect(new Rectangle(1, 1, Width - 3, Height - 3), ModalRadius);
        e.Graphics.DrawPath(pen, path);

        // Resize grip — three small dots in the bottom-right corner.
        using var grip = new SolidBrush(Color.FromArgb(110, 150, 158, 172));
        int gx = Width - 9, gy = Height - 9;
        for (int i = 0; i < 3; i++)
            for (int j = 0; j <= i; j++)
                e.Graphics.FillEllipse(grip, gx - i * 4, gy - j * 4, 2, 2);
    }

    // Make the borderless window resizable by reporting edge/corner hit zones.
    // NOTE: fully-qualified Message — this namespace also defines a Message model class.
    protected override void WndProc(ref System.Windows.Forms.Message m)
    {
        const int WM_NCHITTEST = 0x0084;
        if (m.Msg == WM_NCHITTEST)
        {
            int lp = (int)m.LParam.ToInt64();
            int sx = unchecked((short)(lp & 0xFFFF));
            int sy = unchecked((short)((lp >> 16) & 0xFFFF));
            var p = PointToClient(new Point(sx, sy));

            const int g = 8;
            bool left = p.X <= g, right = p.X >= ClientSize.Width - g;
            bool top = p.Y <= g, bottom = p.Y >= ClientSize.Height - g;

            int ht =
                (right && bottom) ? 17 :
                (left && bottom) ? 16 :
                (right && top) ? 14 :
                (left && top) ? 13 :
                right ? 11 :
                left ? 10 :
                bottom ? 15 :
                top ? 12 : 0;

            if (ht != 0) { m.Result = (IntPtr)ht; return; }
        }
        base.WndProc(ref m);
    }

    private const int WM_NCLBUTTONDOWN = 0xA1;
    private const int HTCAPTION = 0x2;
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr h, int m, int w, int l);
    private void DragWindow() { ReleaseCapture(); SendMessage(Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0); }
}
