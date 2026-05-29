using System.Windows.Forms;

namespace BusinessDashboard;

public class BuilderForm : Form
{
    private readonly DashboardConfig _workingConfig;
    private readonly List<BuilderTabButton> _tabs = new();
    private Panel _modulesPanel = null!;
    private Panel _pipelinePanel = null!;
    private Panel _appearancePanel = null!;
    private Panel _brandingPanel = null!;
    private string _selectedPipelineId = "";

    private const int FormWidth = 780;
    private const int FormHeight = 580;
    private const int HeaderH = 62;
    private const int TabsH = 46;
    private const int FooterH = 72;

    public BuilderForm(DashboardConfig config)
    {
        _workingConfig = CloneConfig(config);

        Text = "Customize Dashboard";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterParent;
        BackColor = Color.White;
        Font = Ui.F(10f);
        ShowInTaskbar = false;
        ClientSize = new Size(FormWidth, FormHeight);

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 4,
            BackColor = Color.White,
        };
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, HeaderH));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, TabsH));
        root.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        root.RowStyles.Add(new RowStyle(SizeType.Absolute, FooterH));

        root.Controls.Add(BuildHeader(), 0, 0);
        root.Controls.Add(BuildTabs(), 0, 1);
        root.Controls.Add(BuildContent(), 0, 2);
        root.Controls.Add(BuildFooter(), 0, 3);
        Controls.Add(root);

        ShowTab(0);
    }

    private Panel BuildHeader()
    {
        var header = new Panel { Dock = DockStyle.Fill, BackColor = Ui.SidebarBg };
        var title = new Label
        {
            Text = "Customize Dashboard",
            ForeColor = Color.White,
            Font = Ui.F(14f, FontStyle.Bold),
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(24, 0, 0, 0),
        };
        var close = new Label
        {
            Text = "X",
            ForeColor = Color.FromArgb(180, 190, 210),
            Font = Ui.F(11f, FontStyle.Bold),
            Dock = DockStyle.Right,
            Width = 52,
            TextAlign = ContentAlignment.MiddleCenter,
            Cursor = Cursors.Hand,
        };

        close.Click += (s, e) => CloseWith(DialogResult.Cancel);
        close.MouseEnter += (s, e) => close.ForeColor = Color.White;
        close.MouseLeave += (s, e) => close.ForeColor = Color.FromArgb(180, 190, 210);
        header.MouseDown += (s, e) => DragWindow();
        title.MouseDown += (s, e) => DragWindow();

        header.Controls.Add(title);
        header.Controls.Add(close);
        return header;
    }

    private Control BuildTabs()
    {
        var tabStrip = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 4,
            RowCount = 1,
            BackColor = Color.White,
            Padding = new Padding(22, 0, 22, 0),
        };

        for (var i = 0; i < 4; i++)
            tabStrip.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 25));

        var labels = new[] { "Modules", "Pipeline", "Appearance", "Branding" };
        for (var i = 0; i < labels.Length; i++)
        {
            var tabIndex = i;
            var tab = new BuilderTabButton
            {
                Text = labels[i],
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter,
                Font = Ui.F(9.5f, FontStyle.Bold),
                Cursor = Cursors.Hand,
            };
            tab.Click += (s, e) => ShowTab(tabIndex);
            _tabs.Add(tab);
            tabStrip.Controls.Add(tab, i, 0);
        }

        return tabStrip;
    }

    private Control BuildContent()
    {
        var host = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.White,
            Padding = new Padding(22, 18, 22, 18),
        };

        _modulesPanel = NewContentPanel();
        _pipelinePanel = NewContentPanel();
        _appearancePanel = NewContentPanel();
        _brandingPanel = NewContentPanel();

        host.Controls.Add(_modulesPanel);
        host.Controls.Add(_pipelinePanel);
        host.Controls.Add(_appearancePanel);
        host.Controls.Add(_brandingPanel);

        RenderModulesTab();
        RenderPipelineTab();
        RenderAppearanceTab();

        return host;
    }

    private static Panel NewContentPanel() => new()
    {
        Dock = DockStyle.Fill,
        BackColor = Color.White,
        Visible = false,
    };

    private Control BuildFooter()
    {
        var footer = new Panel { Dock = DockStyle.Fill, BackColor = Color.White };
        var save = new PillButton { Text = "Save & Apply", BaseColor = Ui.Accent, Width = 132, Height = 40 };
        var cancel = new PillButton { Text = "Cancel", BaseColor = Color.FromArgb(228, 232, 238), ForeColor = Ui.TextDark, Width = 104, Height = 40 };
        var reset = new PillButton
        {
            Text = "Reset to Defaults",
            BaseColor = Ui.Danger,
            Ghost = true,
            Width = 146,
            Height = 40,
            Enabled = false,
        };

        save.Click += (s, e) => CloseWith(DialogResult.OK);
        cancel.Click += (s, e) => CloseWith(DialogResult.Cancel);

        footer.Controls.Add(save);
        footer.Controls.Add(cancel);
        footer.Controls.Add(reset);
        footer.Resize += (s, e) =>
        {
            save.Location = new Point(footer.Width - 22 - save.Width, 16);
            cancel.Location = new Point(save.Left - cancel.Width - 8, 16);
            reset.Location = new Point(22, 16);
        };

        return footer;
    }

    private void ShowTab(int index)
    {
        var panels = new[] { _modulesPanel, _pipelinePanel, _appearancePanel, _brandingPanel };

        for (var i = 0; i < _tabs.Count; i++)
        {
            _tabs[i].Active = i == index;
            _tabs[i].Invalidate();
        }

        for (var i = 0; i < panels.Length; i++)
        {
            panels[i].Visible = i == index;
            if (i == index) panels[i].BringToFront();
        }
    }

    private void RenderModulesTab()
    {
        NormalizeModuleOrder();

        _modulesPanel.SuspendLayout();
        foreach (Control control in _modulesPanel.Controls) control.Dispose();
        _modulesPanel.Controls.Clear();

        var header = BuildModuleHeader();
        var list = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            BackColor = Color.White,
            Padding = new Padding(0, 6, 8, 0),
        };
        list.Resize += (s, e) => ResizeModuleRows(list);

        foreach (var module in OrderedModules())
            list.Controls.Add(BuildModuleRow(module, list));

        _modulesPanel.Controls.Add(list);
        _modulesPanel.Controls.Add(header);
        _modulesPanel.ResumeLayout();
        ResizeModuleRows(list);
    }

    private static Control BuildModuleHeader()
    {
        var header = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 32,
            ColumnCount = 5,
            RowCount = 1,
            BackColor = Color.White,
            Padding = new Padding(0, 0, 0, 2),
        };
        AddModuleColumns(header);
        header.Controls.Add(HeaderLabel("Order"), 0, 0);
        header.Controls.Add(HeaderLabel("Enabled"), 1, 0);
        header.Controls.Add(HeaderLabel("Module name"), 2, 0);
        header.Controls.Add(HeaderLabel("Add button"), 3, 0);
        header.Controls.Add(HeaderLabel("Move"), 4, 0);
        return header;
    }

    private Control BuildModuleRow(ModuleConfig module, FlowLayoutPanel list)
    {
        var ordered = OrderedModules();
        var index = ordered.IndexOf(module);
        var row = new TableLayoutPanel
        {
            Width = Math.Max(600, list.ClientSize.Width - 10),
            Height = 48,
            ColumnCount = 5,
            RowCount = 1,
            BackColor = Color.White,
            Margin = new Padding(0, 0, 0, 8),
        };
        AddModuleColumns(row);

        var order = new Label
        {
            Text = (index + 1).ToString(),
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Ui.TextMuted,
            Font = Ui.F(9f, FontStyle.Bold),
        };
        var enabled = new CheckBox
        {
            Checked = module.Enabled,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            CheckAlign = ContentAlignment.MiddleCenter,
        };
        var name = new TextBox
        {
            Text = module.Label,
            Dock = DockStyle.Fill,
            Font = Ui.F(10f),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(0, 10, 12, 0),
        };
        var addLabel = new TextBox
        {
            Text = module.AddButtonLabel,
            Dock = DockStyle.Fill,
            Font = Ui.F(10f),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(0, 10, 12, 0),
        };
        var move = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            BackColor = Color.White,
            Margin = new Padding(0, 7, 0, 0),
        };
        var up = new Button { Text = "Up", Width = 48, Height = 28, Enabled = index > 0 };
        var down = new Button { Text = "Down", Width = 56, Height = 28, Enabled = index < ordered.Count - 1 };

        enabled.CheckedChanged += (s, e) =>
        {
            if (!enabled.Checked && _workingConfig.Modules.Count(m => m.Enabled) <= 1)
            {
                MessageBox.Show("At least one module must stay enabled.", "Modules",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                enabled.Checked = true;
                return;
            }

            module.Enabled = enabled.Checked;
        };
        name.Leave += (s, e) => UpdateTextBox(name, TextOrDefault(module.Label, module.Id), "Modules", value => module.Label = value);
        addLabel.Leave += (s, e) => UpdateTextBox(addLabel, TextOrDefault(module.AddButtonLabel, "+ Add"), "Modules", value => module.AddButtonLabel = value);
        up.Click += (s, e) => MoveModule(module, -1);
        down.Click += (s, e) => MoveModule(module, 1);

        move.Controls.Add(up);
        move.Controls.Add(down);
        row.Controls.Add(order, 0, 0);
        row.Controls.Add(enabled, 1, 0);
        row.Controls.Add(name, 2, 0);
        row.Controls.Add(addLabel, 3, 0);
        row.Controls.Add(move, 4, 0);
        return row;
    }

    private void MoveModule(ModuleConfig module, int delta)
    {
        var ordered = OrderedModules();
        var index = ordered.IndexOf(module);
        var newIndex = index + delta;
        if (index < 0 || newIndex < 0 || newIndex >= ordered.Count) return;

        ordered.RemoveAt(index);
        ordered.Insert(newIndex, module);
        for (var i = 0; i < ordered.Count; i++)
            ordered[i].Order = i;

        RenderModulesTab();
    }

    private void NormalizeModuleOrder()
    {
        var ordered = OrderedModules();
        for (var i = 0; i < ordered.Count; i++)
            ordered[i].Order = i;
    }

    private List<ModuleConfig> OrderedModules() =>
        _workingConfig.Modules
            .Select((module, index) => new { Module = module, Index = index })
            .OrderBy(item => item.Module.Order)
            .ThenBy(item => item.Index)
            .Select(item => item.Module)
            .ToList();

    private static void AddModuleColumns(TableLayoutPanel table)
    {
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 58));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 82));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 50));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 118));
        table.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
    }

    private static Label HeaderLabel(string text) => new()
    {
        Text = text,
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.MiddleLeft,
        ForeColor = Ui.TextMuted,
        Font = Ui.F(8.5f, FontStyle.Bold),
    };

    private static void ResizeModuleRows(FlowLayoutPanel list)
    {
        foreach (Control control in list.Controls)
            control.Width = Math.Max(600, list.ClientSize.Width - 10);
    }

    private void RenderPipelineTab()
    {
        var choices = PipelineChoices();
        if (choices.Count > 0 && !choices.Any(choice => SameText(choice.Id, _selectedPipelineId)))
            _selectedPipelineId = choices[0].Id;

        _pipelinePanel.SuspendLayout();
        foreach (Control control in _pipelinePanel.Controls) control.Dispose();
        _pipelinePanel.Controls.Clear();

        if (choices.Count == 0)
        {
            _pipelinePanel.Controls.Add(new Label
            {
                Text = "No pipelines",
                Dock = DockStyle.Fill,
                TextAlign = ContentAlignment.MiddleCenter,
                ForeColor = Ui.TextMuted,
                Font = Ui.F(11f),
            });
            _pipelinePanel.ResumeLayout();
            return;
        }

        var selector = new ComboBox
        {
            Dock = DockStyle.Top,
            Height = 36,
            DropDownStyle = ComboBoxStyle.DropDownList,
            Font = Ui.F(10f),
            FlatStyle = FlatStyle.Flat,
        };
        selector.Items.AddRange(choices.Cast<object>().ToArray());
        selector.SelectedItem = choices.First(choice => SameText(choice.Id, _selectedPipelineId));
        selector.SelectedIndexChanged += (s, e) =>
        {
            if (selector.SelectedItem is not PipelineChoice choice) return;
            _selectedPipelineId = choice.Id;
            RenderPipelineTab();
        };

        var header = BuildPipelineHeader();
        var list = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            BackColor = Color.White,
            Padding = new Padding(0, 6, 8, 0),
        };
        list.Resize += (s, e) => ResizeStageRows(list);

        var stages = SelectedPipelineStages();
        for (var i = 0; i < stages.Count; i++)
            list.Controls.Add(BuildStageRow(stages[i], i, stages, list));

        var addStage = new PillButton
        {
            Text = "+ Add Stage",
            BaseColor = Ui.Accent,
            Width = 120,
            Height = 36,
            Margin = new Padding(0, 4, 0, 10),
        };
        addStage.Click += (s, e) => AddStage();
        list.Controls.Add(addStage);

        _pipelinePanel.Controls.Add(list);
        _pipelinePanel.Controls.Add(header);
        _pipelinePanel.Controls.Add(selector);
        _pipelinePanel.ResumeLayout();
        ResizeStageRows(list);
    }

    private static Control BuildPipelineHeader()
    {
        var header = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 32,
            ColumnCount = 6,
            RowCount = 1,
            BackColor = Color.White,
            Padding = new Padding(0, 0, 0, 2),
        };
        AddPipelineColumns(header);
        header.Controls.Add(HeaderLabel("Order"), 0, 0);
        header.Controls.Add(HeaderLabel("Color"), 1, 0);
        header.Controls.Add(HeaderLabel("Stage name"), 2, 0);
        header.Controls.Add(HeaderLabel("Stage ID"), 3, 0);
        header.Controls.Add(HeaderLabel("Move"), 4, 0);
        header.Controls.Add(HeaderLabel("Remove"), 5, 0);
        return header;
    }

    private Control BuildStageRow(StageConfig stage, int index, List<StageConfig> stages, FlowLayoutPanel list)
    {
        var row = new TableLayoutPanel
        {
            Width = Math.Max(660, list.ClientSize.Width - 10),
            Height = 48,
            ColumnCount = 6,
            RowCount = 1,
            BackColor = Color.White,
            Margin = new Padding(0, 0, 0, 8),
        };
        AddPipelineColumns(row);

        var order = new Label
        {
            Text = (index + 1).ToString(),
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Ui.TextMuted,
            Font = Ui.F(9f, FontStyle.Bold),
        };
        var color = new Button
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(2, 10, 12, 0),
            BackColor = ColorFromHex(stage.Color, Color.FromArgb(136, 136, 136)),
            FlatStyle = FlatStyle.Flat,
            Text = "",
        };
        color.FlatAppearance.BorderColor = Ui.CardBorder;

        var label = new TextBox
        {
            Text = stage.Label,
            Dock = DockStyle.Fill,
            Font = Ui.F(10f),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(0, 10, 12, 0),
        };
        var id = new Label
        {
            Text = stage.Id,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            ForeColor = Ui.TextMuted,
            Font = Ui.F(9f),
            Padding = new Padding(0, 0, 8, 0),
        };
        var move = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            BackColor = Color.White,
            Margin = new Padding(0, 7, 0, 0),
        };
        var up = new Button { Text = "Up", Width = 40, Height = 28, Enabled = index > 0 };
        var down = new Button { Text = "Down", Width = 52, Height = 28, Enabled = index < stages.Count - 1 };
        var delete = new Button
        {
            Text = "Delete",
            Dock = DockStyle.Fill,
            Height = 28,
            Enabled = stages.Count > 1,
            Margin = new Padding(0, 10, 0, 0),
        };

        color.Click += (s, e) => PickStageColor(stage, color);
        label.Leave += (s, e) => UpdateTextBox(label, TextOrDefault(stage.Label, stage.Id), "Pipeline", value => stage.Label = value);
        up.Click += (s, e) => MoveStage(stage, -1);
        down.Click += (s, e) => MoveStage(stage, 1);
        delete.Click += (s, e) => DeleteStage(stage);

        move.Controls.Add(up);
        move.Controls.Add(down);
        row.Controls.Add(order, 0, 0);
        row.Controls.Add(color, 1, 0);
        row.Controls.Add(label, 2, 0);
        row.Controls.Add(id, 3, 0);
        row.Controls.Add(move, 4, 0);
        row.Controls.Add(delete, 5, 0);
        return row;
    }

    private void PickStageColor(StageConfig stage, Button button)
    {
        using var dialog = new ColorDialog
        {
            Color = ColorFromHex(stage.Color, Ui.Accent),
            FullOpen = true,
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;

        stage.Color = ColorToHex(dialog.Color);
        button.BackColor = dialog.Color;
    }

    private void MoveStage(StageConfig stage, int delta)
    {
        var stages = SelectedPipelineStages();
        var index = stages.IndexOf(stage);
        var newIndex = index + delta;
        if (index < 0 || newIndex < 0 || newIndex >= stages.Count) return;

        stages.RemoveAt(index);
        stages.Insert(newIndex, stage);
        RenderPipelineTab();
    }

    private void DeleteStage(StageConfig stage)
    {
        var stages = SelectedPipelineStages();
        if (stages.Count <= 1) return;

        stages.Remove(stage);
        RenderPipelineTab();
    }

    private void AddStage()
    {
        var stages = SelectedPipelineStages();
        var id = NextStageId(stages);
        stages.Add(new StageConfig
        {
            Id = id,
            Label = "New Stage",
            Color = "#888888",
            Description = "",
        });
        RenderPipelineTab();
    }

    private List<StageConfig> SelectedPipelineStages()
    {
        var pipeline = PipelineById(_selectedPipelineId);
        if (pipeline.Stages == null) pipeline.Stages = [];
        return pipeline.Stages;
    }

    private PipelineConfig PipelineById(string pipelineId)
    {
        var match = _workingConfig.Pipelines.FirstOrDefault(pair => SameText(pair.Key, pipelineId));
        if (!string.IsNullOrWhiteSpace(match.Key)) return match.Value;

        var pipeline = new PipelineConfig();
        _workingConfig.Pipelines[pipelineId] = pipeline;
        return pipeline;
    }

    private List<PipelineChoice> PipelineChoices()
    {
        var moduleOrder = _workingConfig.Modules
            .Select((module, index) => new { Module = module, Index = index })
            .ToDictionary(
                item => item.Module.Id,
                item => (Order: item.Module.Order, Index: item.Index, Label: TextOrDefault(item.Module.Label, item.Module.Id)),
                StringComparer.OrdinalIgnoreCase);

        return _workingConfig.Pipelines.Keys
            .Select(id =>
            {
                if (moduleOrder.TryGetValue(id, out var module))
                    return new PipelineChoice(id, module.Label, module.Order, module.Index);

                return new PipelineChoice(id, id, int.MaxValue, int.MaxValue);
            })
            .OrderBy(choice => choice.Order)
            .ThenBy(choice => choice.Index)
            .ThenBy(choice => choice.Label)
            .ToList();
    }

    private static void AddPipelineColumns(TableLayoutPanel table)
    {
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 58));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 78));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 55));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 45));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 100));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 86));
        table.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
    }

    private static void ResizeStageRows(FlowLayoutPanel list)
    {
        foreach (Control control in list.Controls)
            control.Width = control is PillButton ? control.Width : Math.Max(660, list.ClientSize.Width - 10);
    }

    private static string NextStageId(List<StageConfig> stages)
    {
        var next = 1;
        while (stages.Any(stage => SameText(stage.Id, $"custom_{next}")))
            next++;

        return $"custom_{next}";
    }

    private static Color ColorFromHex(string? value, Color fallback)
    {
        if (string.IsNullOrWhiteSpace(value)) return fallback;

        try
        {
            var color = ColorTranslator.FromHtml(value.Trim());
            return color.IsEmpty ? fallback : color;
        }
        catch (ArgumentException)
        {
            return fallback;
        }
    }

    private static string ColorToHex(Color color) =>
        $"#{color.R:X2}{color.G:X2}{color.B:X2}";

    private void RenderAppearanceTab()
    {
        _appearancePanel.SuspendLayout();
        foreach (Control control in _appearancePanel.Controls) control.Dispose();
        _appearancePanel.Controls.Clear();

        var table = new TableLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 188,
            ColumnCount = 3,
            RowCount = 4,
            BackColor = Color.White,
        };
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 32));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));
        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 48));

        table.Controls.Add(HeaderLabel("Setting"), 0, 0);
        table.Controls.Add(HeaderLabel("Hex value"), 1, 0);
        table.Controls.Add(HeaderLabel("Picker"), 2, 0);

        AddThemeRow(table, 1, "Primary/accent color", _workingConfig.Theme.Accent, value => _workingConfig.Theme.Accent = value);
        AddThemeRow(table, 2, "Sidebar background", _workingConfig.Theme.SidebarBg, value => _workingConfig.Theme.SidebarBg = value);
        AddThemeRow(table, 3, "Content background", _workingConfig.Theme.ContentBg, value => _workingConfig.Theme.ContentBg = value);

        _appearancePanel.Controls.Add(table);
        _appearancePanel.ResumeLayout();
    }

    private void AddThemeRow(TableLayoutPanel table, int row, string labelText, string initialValue, Action<string> update)
    {
        var name = new Label
        {
            Text = labelText,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            ForeColor = Ui.TextDark,
            Font = Ui.F(9.5f, FontStyle.Bold),
        };
        var hex = new TextBox
        {
            Text = NormalizeHex(initialValue, "#000000"),
            Dock = DockStyle.Fill,
            Font = Ui.F(10f),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(0, 10, 14, 0),
        };
        var picker = new Button
        {
            Dock = DockStyle.Fill,
            BackColor = ColorFromHex(hex.Text, Color.Black),
            FlatStyle = FlatStyle.Flat,
            Margin = new Padding(0, 9, 0, 1),
            Text = "",
        };
        picker.FlatAppearance.BorderColor = Ui.CardBorder;

        hex.Leave += (s, e) => UpdateThemeColor(hex, picker, update);
        picker.Click += (s, e) => PickThemeColor(hex, picker, update);

        update(hex.Text);
        table.Controls.Add(name, 0, row);
        table.Controls.Add(hex, 1, row);
        table.Controls.Add(picker, 2, row);
    }

    private void PickThemeColor(TextBox hex, Button picker, Action<string> update)
    {
        using var dialog = new ColorDialog
        {
            Color = ColorFromHex(hex.Text, Ui.Accent),
            FullOpen = true,
        };
        if (dialog.ShowDialog(this) != DialogResult.OK) return;

        var value = ColorToHex(dialog.Color);
        hex.Text = value;
        picker.BackColor = dialog.Color;
        update(value);
    }

    private static void UpdateThemeColor(TextBox hex, Button picker, Action<string> update)
    {
        var previous = NormalizeHex(picker.BackColor, "#000000");
        var value = NormalizeHex(hex.Text, previous);
        if (!IsValidHexColor(hex.Text))
        {
            MessageBox.Show("Use a hex color like #3884FF.", "Appearance",
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
            hex.Text = previous;
            return;
        }

        hex.Text = value;
        picker.BackColor = ColorFromHex(value, picker.BackColor);
        update(value);
    }

    private static bool IsValidHexColor(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return false;
        var trimmed = value.Trim();
        if (trimmed.Length != 7 || trimmed[0] != '#') return false;
        if (trimmed.Skip(1).Any(c => !Uri.IsHexDigit(c))) return false;

        try
        {
            var color = ColorTranslator.FromHtml(trimmed);
            return !color.IsEmpty;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    private static string NormalizeHex(string? value, string fallback)
    {
        if (!IsValidHexColor(value)) return fallback;
        return ColorToHex(ColorFromHex(value, Color.Black));
    }

    private static string NormalizeHex(Color color, string fallback) =>
        color.IsEmpty ? fallback : ColorToHex(color);

    private static bool SameText(string? left, string? right) =>
        string.Equals(left?.Trim(), right?.Trim(), StringComparison.OrdinalIgnoreCase);

    private static void UpdateTextBox(TextBox textBox, string fallback, string title, Action<string> update)
    {
        var value = textBox.Text.Trim();
        if (string.IsNullOrWhiteSpace(value))
        {
            MessageBox.Show("This field cannot be blank.", title,
                MessageBoxButtons.OK, MessageBoxIcon.Warning);
            textBox.Text = fallback;
            return;
        }

        textBox.Text = value;
        update(value);
    }

    private void CloseWith(DialogResult result)
    {
        DialogResult = result;
        Close();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        using var pen = new Pen(Ui.CardBorder);
        e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
    }

    private const int WM_NCLBUTTONDOWN = 0xA1;
    private const int HTCAPTION = 0x2;
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern bool ReleaseCapture();
    [System.Runtime.InteropServices.DllImport("user32.dll")] private static extern IntPtr SendMessage(IntPtr h, int m, int w, int l);
    private void DragWindow() { ReleaseCapture(); SendMessage(Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0); }

    private static DashboardConfig CloneConfig(DashboardConfig? config)
    {
        var source = config ?? ConfigManager.GetDefaults();
        return new DashboardConfig
        {
            Version = source.Version,
            Branding = new BrandingConfig
            {
                BusinessName = source.Branding?.BusinessName ?? "",
                DashboardSubtitle = source.Branding?.DashboardSubtitle ?? "",
            },
            Theme = new ThemeConfig
            {
                SidebarBg = source.Theme?.SidebarBg ?? "",
                Accent = source.Theme?.Accent ?? "",
                ContentBg = source.Theme?.ContentBg ?? "",
            },
            Modules = source.Modules?
                .Select(module => new ModuleConfig
                {
                    Id = module.Id,
                    Label = module.Label,
                    Icon = module.Icon,
                    AddButtonLabel = module.AddButtonLabel,
                    Enabled = module.Enabled,
                    Order = module.Order,
                })
                .ToList() ?? [],
            Pipelines = ClonePipelines(source.Pipelines),
        };
    }

    private static Dictionary<string, PipelineConfig> ClonePipelines(Dictionary<string, PipelineConfig>? pipelines)
    {
        if (pipelines == null) return new Dictionary<string, PipelineConfig>(StringComparer.OrdinalIgnoreCase);

        return pipelines.ToDictionary(
            pair => pair.Key,
            pair => new PipelineConfig
            {
                Stages = pair.Value.Stages?
                    .Select(stage => new StageConfig
                    {
                        Id = stage.Id,
                        Label = stage.Label,
                        Color = stage.Color,
                        Description = stage.Description,
                    })
                    .ToList() ?? [],
            },
            StringComparer.OrdinalIgnoreCase);
    }

    private static string TextOrDefault(string? value, string fallback) =>
        string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();

    private sealed record PipelineChoice(string Id, string Label, int Order, int Index)
    {
        public override string ToString() => Label;
    }
}

internal class BuilderTabButton : Label
{
    public bool Active { get; set; }

    protected override void OnPaint(PaintEventArgs e)
    {
        ForeColor = Active ? Ui.TextDark : Ui.TextMuted;
        base.OnPaint(e);

        if (!Active) return;

        using var pen = new Pen(Ui.Accent, 3f);
        e.Graphics.DrawLine(pen, 14, Height - 3, Width - 14, Height - 3);
    }
}
