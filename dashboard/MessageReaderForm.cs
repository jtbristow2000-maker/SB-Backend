using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// MessageReaderForm — a small rounded popup for reading a single message.
//
// Opened from MainForm.OpenMessageReader() when the owner clicks a message card.
// Read-only: shows sender, channel/date/phone, and the full message body.
// MainForm handles the "mark as read" side-effect after this closes.
// ---------------------------------------------------------------------------

/// <summary>A rounded, read-only popup that displays one message's full content.</summary>
public class MessageReaderForm : Form
{
    private const int FormWidth = 460;
    private const int HeaderH = 64;
    private const int FooterH = 60;
    private const int ModalRadius = 12;
    private static readonly Color ModalBorderColor = Color.FromArgb(132, 146, 170);

    public MessageReaderForm(string sender, string meta, string body)
    {
        Text = "Message";
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

        // ---- Header (sender + close) ----
        var header = new Panel { Dock = DockStyle.Fill, BackColor = Ui.SidebarBg };
        var title = new Label
        {
            Text = string.IsNullOrWhiteSpace(sender) ? "Message" : sender,
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
        header.Controls.Add(title);
        header.Controls.Add(close);
        header.MouseDown += (s, e) => DragWindow();
        title.MouseDown += (s, e) => DragWindow();

        // ---- Body (meta + message text) ----
        var bodyPanel = new Panel { Dock = DockStyle.Fill, BackColor = Color.White, Padding = new Padding(22, 14, 22, 8) };
        var metaLabel = new Label
        {
            Text = meta,
            Dock = DockStyle.Top, Height = 22,
            ForeColor = Ui.TextMuted, Font = Ui.F(9.5f, FontStyle.Bold),
            TextAlign = ContentAlignment.MiddleLeft,
        };
        var content = new TextBox
        {
            Text = string.IsNullOrWhiteSpace(body) ? "(No message content)" : body,
            Dock = DockStyle.Fill,
            Multiline = true,
            ReadOnly = true,
            BorderStyle = BorderStyle.None,
            BackColor = Color.White,
            ForeColor = Ui.TextBody,
            Font = Ui.F(11f),
            ScrollBars = ScrollBars.Vertical,
            Cursor = Cursors.Default,
            TabStop = false,
        };
        content.GotFocus += (s, e) => close.Focus();   // avoid the caret/selection look
        bodyPanel.Controls.Add(content);
        bodyPanel.Controls.Add(metaLabel);

        // ---- Footer (Close) ----
        var footer = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
        var ok = new PillButton { Text = "Close", BaseColor = Ui.Accent, Width = 110, Height = 38 };
        ok.Click += (s, e) => Close();
        footer.Controls.Add(ok);
        footer.Resize += (s, e) => ok.Location = new Point(footer.Width - 22 - ok.Width, 11);

        root.Controls.Add(header, 0, 0);
        root.Controls.Add(bodyPanel, 0, 1);
        root.Controls.Add(footer, 0, 2);
        Controls.Add(root);

        // Size to fit the body (clamped to a readable default), then round the window.
        // The window is user-resizable (see WndProc) so long messages can be enlarged.
        int bodyTextH = Math.Min(420, Math.Max(170, MeasureBody(body)));
        ClientSize = new Size(FormWidth, HeaderH + bodyTextH + FooterH);
        MinimumSize = new Size(360, 240);
        ApplyRoundedRegion();
    }

    private static int MeasureBody(string body)
    {
        using var f = Ui.F(11f);
        var sz = TextRenderer.MeasureText(body ?? "", f, new Size(FormWidth - 44, 0),
            TextFormatFlags.WordBreak | TextFormatFlags.TextBoxControl);
        return sz.Height + 40;   // + meta line + padding
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

        // Resize grip — three small dots in the bottom-right corner (drag to resize).
        using var grip = new SolidBrush(Color.FromArgb(110, 150, 158, 172));
        int gx = Width - 9, gy = Height - 9;
        for (int i = 0; i < 3; i++)
            for (int j = 0; j <= i; j++)
                e.Graphics.FillEllipse(grip, gx - i * 4, gy - j * 4, 2, 2);
    }

    // Make the borderless window resizable by reporting edge/corner hit zones to Windows.
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
                (right && bottom) ? 17 :   // HTBOTTOMRIGHT
                (left && bottom) ? 16 :    // HTBOTTOMLEFT
                (right && top) ? 14 :      // HTTOPRIGHT
                (left && top) ? 13 :       // HTTOPLEFT
                right ? 11 :               // HTRIGHT
                left ? 10 :                // HTLEFT
                bottom ? 15 :              // HTBOTTOM
                top ? 12 : 0;              // HTTOP

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
