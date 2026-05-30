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
    private ModuleConfig? _draggedModule;
    private StageConfig? _draggedStage;

    private const int FormWidth = 780;
    private const int FormHeight = 580;
    private const int HeaderH = 62;
    private const int TabsH = 46;
    private const int FooterH = 72;
    private const int ModalRadius = 14;
    private const int OuterBorder = 2;
    private static readonly Color ModalBorderColor = Color.FromArgb(132, 146, 170);

    private BrandingConfig Branding => _workingConfig.Branding ??= new BrandingConfig();

    public BuilderForm(DashboardConfig config)
    {
        _workingConfig = CloneConfig(config);

        Text = "Customize Dashboard";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterParent;
        BackColor = ModalBorderColor;
        Font = Ui.F(10f);
        ShowInTaskbar = false;
        Padding = new Padding(OuterBorder);
        ClientSize = new Size(FormWidth, FormHeight);
        ApplyRoundedRegion();

        var root = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 4,
            BackColor = Ui.ContentBg,
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
            Text = "✕",
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
            BackColor = Ui.ContentBg,
            Padding = new Padding(28, 0, 28, 0),
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
            BackColor = Ui.ContentBg,
            Padding = new Padding(18, 8, 18, 10),
        };
        var surface = new BuilderSurfacePanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(18, 16, 18, 16),
        };

        _modulesPanel = NewContentPanel();
        _pipelinePanel = NewContentPanel();
        _appearancePanel = NewContentPanel();
        _brandingPanel = NewContentPanel();

        surface.Controls.Add(_modulesPanel);
        surface.Controls.Add(_pipelinePanel);
        surface.Controls.Add(_appearancePanel);
        surface.Controls.Add(_brandingPanel);
        host.Controls.Add(surface);

        RenderModulesTab();
        RenderPipelineTab();
        RenderAppearanceTab();
        RenderBrandingTab();

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
        var footer = new Panel { Dock = DockStyle.Fill, BackColor = Ui.ContentBg };
        var save = new PillButton { Text = "Save & Apply", BaseColor = Ui.Accent, Width = 132, Height = 40 };
        var cancel = new PillButton { Text = "Cancel", BaseColor = Color.FromArgb(228, 232, 238), ForeColor = Ui.TextDark, Width = 104, Height = 40 };
        var reset = new PillButton
        {
            Text = "Reset to Defaults",
            BaseColor = Ui.Danger,
            Ghost = true,
            Width = 146,
            Height = 40,
        };

        save.Click += (s, e) => SaveAndApply();
        cancel.Click += (s, e) => CloseWith(DialogResult.Cancel);
        reset.Click += (s, e) => ResetToDefaults();

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
        header.Controls.Add(HeaderLabel("Button label"), 3, 0);
        header.Controls.Add(HeaderLabel("Move"), 4, 0);
        return header;
    }

    private Control BuildModuleRow(ModuleConfig module, FlowLayoutPanel list)
    {
        var ordered = OrderedModules();
        var index = ordered.IndexOf(module);
        var row = new BuilderDropRow
        {
            Width = Math.Max(600, list.ClientSize.Width - 10),
            Height = 48,
            ColumnCount = 5,
            RowCount = 1,
            BackColor = Color.White,
            Margin = new Padding(0, 0, 0, 8),
        };
        AddModuleColumns(row);

        var order = BuildModuleOrderCell(module, index + 1);
        var toggle = new ToggleSwitch
        {
            Checked = module.Enabled,
            Dock = DockStyle.Fill,
        };
        var nameInput = new StyledInputPanel(module.Label)
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 8, 12, 8),
        };
        var addInput = new StyledInputPanel(module.AddButtonLabel)
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 8, 12, 8),
        };
        var move = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            BackColor = Color.Transparent,
            Margin = new Padding(0, 7, 0, 0),
        };
        var up = new BuilderIconButton { Text = "↑", Width = 34, Height = 28, Enabled = index > 0 };
        var down = new BuilderIconButton { Text = "↓", Width = 34, Height = 28, Enabled = index < ordered.Count - 1 };

        toggle.CheckedChanged += (s, e) =>
        {
            if (!toggle.Checked && _workingConfig.Modules.Count(m => m.Enabled) <= 1)
            {
                MessageBox.Show("At least one module must stay enabled.", "Modules",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                toggle.Checked = true;
                return;
            }
            module.Enabled = toggle.Checked;
        };
        nameInput.Inner.Leave += (s, e) => UpdateTextBox(nameInput.Inner, TextOrDefault(module.Label, module.Id), "Modules", value => module.Label = value);
        addInput.Inner.Leave += (s, e) => UpdateTextBox(addInput.Inner, TextOrDefault(module.AddButtonLabel, "+ Add"), "Modules", value => module.AddButtonLabel = value);
        up.Click += (s, e) => MoveModule(module, -1);
        down.Click += (s, e) => MoveModule(module, 1);

        move.Controls.Add(up);
        move.Controls.Add(down);
        row.Controls.Add(order, 0, 0);
        row.Controls.Add(toggle, 1, 0);
        row.Controls.Add(nameInput, 2, 0);
        row.Controls.Add(addInput, 3, 0);
        row.Controls.Add(move, 4, 0);
        EnableModuleDrop(row, module);
        return row;
    }

    private Control BuildModuleOrderCell(ModuleConfig module, int position)
    {
        var cell = BuildOrderCell(position);
        var handle = cell.Controls[1];
        handle.MouseDown += (s, e) => BeginModuleDrag(module, handle, e);
        return cell;
    }

    private Control BuildOrderCell(int position)
    {
        var cell = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.Transparent,
        };
        var handle = new Label
        {
            Text = "☰",
            Dock = DockStyle.Left,
            Width = 24,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Ui.TextMuted,
            Font = Ui.F(9f, FontStyle.Bold),
            Cursor = Cursors.SizeAll,
        };
        var order = new Label
        {
            Text = position.ToString(),
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Ui.TextMuted,
            Font = Ui.F(9f, FontStyle.Bold),
        };

        cell.Controls.Add(order);
        cell.Controls.Add(handle);
        return cell;
    }

    private void BeginModuleDrag(ModuleConfig module, Control source, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;

        CommitPendingEdits();
        try
        {
            _draggedModule = module;
            source.DoDragDrop(module.Id, DragDropEffects.Move);
        }
        finally
        {
            _draggedModule = null;
            ClearDropCues(_modulesPanel);
        }
    }

    private void EnableModuleDrop(BuilderDropRow row, ModuleConfig target)
    {
        AttachModuleDrop(row, row, target);
    }

    private void AttachModuleDrop(Control control, BuilderDropRow row, ModuleConfig target)
    {
        control.AllowDrop = true;
        control.DragEnter += (s, e) =>
        {
            if (_draggedModule != null && !ReferenceEquals(_draggedModule, target))
            {
                e.Effect = DragDropEffects.Move;
                row.DropActive = true;
            }
        };
        control.DragOver += (s, e) =>
        {
            if (_draggedModule != null && !ReferenceEquals(_draggedModule, target))
            {
                e.Effect = DragDropEffects.Move;
                row.DropActive = true;
            }
        };
        control.DragLeave += (s, e) =>
        {
            if (!row.ClientRectangle.Contains(row.PointToClient(Cursor.Position)))
                row.DropActive = false;
        };
        control.DragDrop += (s, e) =>
        {
            row.DropActive = false;
            DropModuleOn(target);
        };

        foreach (Control child in control.Controls)
            AttachModuleDrop(child, row, target);
    }

    private void DropModuleOn(ModuleConfig target)
    {
        if (_draggedModule == null || ReferenceEquals(_draggedModule, target)) return;

        var ordered = OrderedModules();
        var sourceIndex = ordered.IndexOf(_draggedModule);
        var targetIndex = ordered.IndexOf(target);
        if (sourceIndex < 0 || targetIndex < 0) return;

        ordered.RemoveAt(sourceIndex);
        ordered.Insert(targetIndex, _draggedModule);
        for (var i = 0; i < ordered.Count; i++)
            ordered[i].Order = i;

        RenderModulesTab();
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
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 72));
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
            ColumnCount = 5,
            RowCount = 1,
            BackColor = Color.White,
            Padding = new Padding(0, 0, 0, 2),
        };
        AddPipelineColumns(header);
        header.Controls.Add(HeaderLabel("Order"), 0, 0);
        header.Controls.Add(HeaderLabel("Color"), 1, 0);
        header.Controls.Add(HeaderLabel("Stage name"), 2, 0);
        header.Controls.Add(HeaderLabel("Move"), 3, 0);
        header.Controls.Add(HeaderLabel("Remove"), 4, 0);
        return header;
    }

    private Control BuildStageRow(StageConfig stage, int index, List<StageConfig> stages, FlowLayoutPanel list)
    {
        var row = new BuilderDropRow
        {
            Width = Math.Max(620, list.ClientSize.Width - 10),
            Height = 48,
            ColumnCount = 5,
            RowCount = 1,
            BackColor = Color.White,
            Margin = new Padding(0, 0, 0, 8),
        };
        AddPipelineColumns(row);

        var order = BuildStageOrderCell(stage, index + 1);
        var color = new Button
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(2, 10, 12, 0),
            BackColor = ColorFromHex(stage.Color, Color.FromArgb(136, 136, 136)),
            FlatStyle = FlatStyle.Flat,
            Text = "",
        };
        color.FlatAppearance.BorderColor = Ui.CardBorder;

        var labelInput = new StyledInputPanel(stage.Label)
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 8, 12, 8),
        };
        var move = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.LeftToRight,
            WrapContents = false,
            BackColor = Color.Transparent,
            Margin = new Padding(0, 7, 0, 0),
        };
        var up = new BuilderIconButton { Text = "↑", Width = 34, Height = 28, Enabled = index > 0 };
        var down = new BuilderIconButton { Text = "↓", Width = 34, Height = 28, Enabled = index < stages.Count - 1 };
        var delete = new BuilderIconButton
        {
            Text = "×",
            Dock = DockStyle.Fill,
            Height = 28,
            Enabled = stages.Count > 1,
            Margin = new Padding(0, 10, 0, 0),
            AccentColor = Ui.Danger,
        };

        color.Click += (s, e) => PickStageColor(stage, color);
        labelInput.Inner.Leave += (s, e) => UpdateTextBox(labelInput.Inner, TextOrDefault(stage.Label, stage.Id), "Pipeline", value => stage.Label = value);
        up.Click += (s, e) => MoveStage(stage, -1);
        down.Click += (s, e) => MoveStage(stage, 1);
        delete.Click += (s, e) => DeleteStage(stage);

        move.Controls.Add(up);
        move.Controls.Add(down);
        row.Controls.Add(order, 0, 0);
        row.Controls.Add(color, 1, 0);
        row.Controls.Add(labelInput, 2, 0);
        row.Controls.Add(move, 3, 0);
        row.Controls.Add(delete, 4, 0);
        EnableStageDrop(row, stage);
        return row;
    }

    private Control BuildStageOrderCell(StageConfig stage, int position)
    {
        var cell = BuildOrderCell(position);
        var handle = cell.Controls[1];
        handle.MouseDown += (s, e) => BeginStageDrag(stage, handle, e);
        return cell;
    }

    private void BeginStageDrag(StageConfig stage, Control source, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;

        CommitPendingEdits();
        try
        {
            _draggedStage = stage;
            source.DoDragDrop(stage.Id, DragDropEffects.Move);
        }
        finally
        {
            _draggedStage = null;
            ClearDropCues(_pipelinePanel);
        }
    }

    private void EnableStageDrop(BuilderDropRow row, StageConfig target)
    {
        AttachStageDrop(row, row, target);
    }

    private void AttachStageDrop(Control control, BuilderDropRow row, StageConfig target)
    {
        control.AllowDrop = true;
        control.DragEnter += (s, e) =>
        {
            if (_draggedStage != null && !ReferenceEquals(_draggedStage, target))
            {
                e.Effect = DragDropEffects.Move;
                row.DropActive = true;
            }
        };
        control.DragOver += (s, e) =>
        {
            if (_draggedStage != null && !ReferenceEquals(_draggedStage, target))
            {
                e.Effect = DragDropEffects.Move;
                row.DropActive = true;
            }
        };
        control.DragLeave += (s, e) =>
        {
            if (!row.ClientRectangle.Contains(row.PointToClient(Cursor.Position)))
                row.DropActive = false;
        };
        control.DragDrop += (s, e) =>
        {
            row.DropActive = false;
            DropStageOn(target);
        };

        foreach (Control child in control.Controls)
            AttachStageDrop(child, row, target);
    }

    private void DropStageOn(StageConfig target)
    {
        if (_draggedStage == null || ReferenceEquals(_draggedStage, target)) return;

        var stages = SelectedPipelineStages();
        var sourceIndex = stages.IndexOf(_draggedStage);
        var targetIndex = stages.IndexOf(target);
        if (sourceIndex < 0 || targetIndex < 0) return;

        stages.RemoveAt(sourceIndex);
        stages.Insert(targetIndex, _draggedStage);
        RenderPipelineTab();
    }

    private static void ClearDropCues(Control root)
    {
        foreach (Control child in root.Controls)
        {
            if (child is BuilderDropRow row)
                row.DropActive = false;

            ClearDropCues(child);
        }
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
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 100));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 70));
        table.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
    }

    private static void ResizeStageRows(FlowLayoutPanel list)
    {
        foreach (Control control in list.Controls)
            control.Width = control is PillButton ? control.Width : Math.Max(620, list.ClientSize.Width - 10);
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

    private void AddThemeRow(TableLayoutPanel table, int row, string labelText, string initialValue, Action<string> update, string fallback = "#000000", string title = "Appearance")
    {
        var name = new Label
        {
            Text = labelText,
            Dock = DockStyle.Fill,
            TextAlign = ContentAlignment.MiddleLeft,
            ForeColor = Ui.TextDark,
            Font = Ui.F(9.5f, FontStyle.Bold),
        };
        var hexInput = new StyledInputPanel(NormalizeHex(initialValue, fallback))
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 9, 14, 9),
        };
        var hex = hexInput.Inner;
        var picker = new Button
        {
            Dock = DockStyle.Fill,
            BackColor = ColorFromHex(hex.Text, Color.Black),
            FlatStyle = FlatStyle.Flat,
            Margin = new Padding(0, 9, 0, 1),
            Text = "",
        };
        picker.FlatAppearance.BorderColor = Ui.CardBorder;

        hex.Leave += (s, e) => UpdateThemeColor(hex, picker, update, title);
        picker.Click += (s, e) => PickThemeColor(hex, picker, update);

        update(hex.Text);
        table.Controls.Add(name, 0, row);
        table.Controls.Add(hexInput, 1, row);
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

    private static void UpdateThemeColor(TextBox hex, Button picker, Action<string> update, string title)
    {
        var previous = NormalizeHex(picker.BackColor, "#000000");
        var value = NormalizeHex(hex.Text, previous);
        if (!IsValidHexColor(hex.Text))
        {
            MessageBox.Show("Use a hex color like #3884FF.", title,
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

    private void RenderBrandingTab()
    {
        _brandingPanel.SuspendLayout();
        foreach (Control control in _brandingPanel.Controls) DisposeControlTree(control);
        _brandingPanel.Controls.Clear();

        var list = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            AutoScroll = true,
            BackColor = Color.White,
            Padding = new Padding(0, 0, 8, 0),
        };
        list.Resize += (s, e) => ResizeBrandingSections(list);

        list.Controls.Add(BuildIdentitySection());
        list.Controls.Add(BuildContactSection());
        list.Controls.Add(BuildBrandColorsSection());
        list.Controls.Add(BuildLogoSection());

        _brandingPanel.Controls.Add(list);
        _brandingPanel.ResumeLayout();
        ResizeBrandingSections(list);
    }

    private Control BuildIdentitySection()
    {
        var table = NewBrandingTextSection("IDENTITY", 3);
        AddBrandingTextRow(table, 1, "Business Name", Branding.BusinessName,
            value => Branding.BusinessName = value, required: true, fallback: "Business Hub");
        AddBrandingTextRow(table, 2, "Tagline", Branding.Tagline,
            value => Branding.Tagline = value);
        AddBrandingTextRow(table, 3, "Sidebar Subtitle", Branding.DashboardSubtitle,
            value => Branding.DashboardSubtitle = value, required: true, fallback: "Owner Dashboard");
        return table;
    }

    private Control BuildContactSection()
    {
        var table = NewBrandingTextSection("CONTACT INFO", 3);
        AddBrandingTextRow(table, 1, "Phone", Branding.Phone, value => Branding.Phone = value);
        AddBrandingTextRow(table, 2, "Email", Branding.Email, value => Branding.Email = value);
        AddBrandingTextRow(table, 3, "Website", Branding.Website, value => Branding.Website = value);
        return table;
    }

    private Control BuildBrandColorsSection()
    {
        var table = NewBrandingSection("BRAND COLORS", 3, 3, 128);
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 190));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 92));

        AddThemeRow(table, 1, "Primary Color", Branding.PrimaryColor,
            value => Branding.PrimaryColor = value, fallback: "#3884FF", title: "Branding");
        AddThemeRow(table, 2, "Secondary Color", Branding.SecondaryColor,
            value => Branding.SecondaryColor = value, fallback: "#7C3AED", title: "Branding");
        return table;
    }

    private Control BuildLogoSection()
    {
        var table = NewBrandingSection("LOGO", 3, 4, 158);
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 120));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 84));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 72));
        table.RowStyles[2] = new RowStyle(SizeType.Absolute, 82);

        var label = BrandingFieldLabel("Logo Path");
        var path = new TextBox
        {
            Text = Branding.LogoPath,
            Dock = DockStyle.Fill,
            Font = Ui.F(10f),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(0, 10, 10, 0),
        };
        var browse = new Button
        {
            Text = "Browse",
            Dock = DockStyle.Fill,
            Height = 28,
            Margin = new Padding(0, 9, 8, 1),
        };
        var clear = new Button
        {
            Text = "Clear",
            Dock = DockStyle.Fill,
            Height = 28,
            Margin = new Padding(0, 9, 0, 1),
        };
        var previewLabel = BrandingFieldLabel("Preview");
        var preview = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(248, 250, 252),
            BorderStyle = BorderStyle.FixedSingle,
            Margin = new Padding(0, 8, 0, 0),
        };

        path.Leave += (s, e) => UpdateLogoPath(path, preview);
        browse.Click += (s, e) => BrowseLogo(path, preview);
        clear.Click += (s, e) =>
        {
            path.Text = "";
            UpdateLogoPath(path, preview);
        };

        table.Controls.Add(label, 0, 1);
        table.Controls.Add(path, 1, 1);
        table.Controls.Add(browse, 2, 1);
        table.Controls.Add(clear, 3, 1);
        table.Controls.Add(previewLabel, 0, 2);
        table.Controls.Add(preview, 1, 2);
        table.SetColumnSpan(preview, 3);

        RenderLogoPreview(preview, path.Text);
        return table;
    }

    private static TableLayoutPanel NewBrandingTextSection(string title, int fieldRows)
    {
        var table = NewBrandingSection(title, fieldRows + 1, 2, 34 + fieldRows * 42);
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 150));
        table.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        return table;
    }

    private static TableLayoutPanel NewBrandingSection(string title, int rows, int columns, int height)
    {
        var table = new TableLayoutPanel
        {
            Width = 680,
            Height = height,
            ColumnCount = columns,
            RowCount = rows,
            BackColor = Color.White,
            Margin = new Padding(0, 0, 0, 16),
        };

        table.RowStyles.Add(new RowStyle(SizeType.Absolute, 30));
        for (var i = 1; i < rows; i++)
            table.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));

        var header = SectionLabel(title);
        table.Controls.Add(header, 0, 0);
        table.SetColumnSpan(header, columns);
        return table;
    }

    private static void AddBrandingTextRow(TableLayoutPanel table, int row, string labelText, string initialValue,
        Action<string> update, bool required = false, string fallback = "")
    {
        var label = BrandingFieldLabel(labelText);
        var input = new StyledInputPanel(initialValue)
        {
            Dock = DockStyle.Fill,
            Margin = new Padding(0, 6, 0, 6),
        };
        var textBox = input.Inner;

        var lastValidValue = TextOrDefault(initialValue, fallback);
        textBox.Leave += (s, e) =>
        {
            var value = textBox.Text.Trim();
            if (required && string.IsNullOrWhiteSpace(value))
            {
                MessageBox.Show("This field cannot be blank.", "Branding",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
                textBox.Text = lastValidValue;
                return;
            }

            textBox.Text = value;
            lastValidValue = value;
            update(value);
        };

        table.Controls.Add(label, 0, row);
        table.Controls.Add(input, 1, row);
    }

    private void BrowseLogo(TextBox path, Panel preview)
    {
        using var dialog = new OpenFileDialog
        {
            Title = "Select Logo",
            Filter = "Image files (*.png;*.jpg;*.jpeg;*.bmp;*.gif)|*.png;*.jpg;*.jpeg;*.bmp;*.gif|All files (*.*)|*.*",
            CheckFileExists = true,
            Multiselect = false,
        };

        if (File.Exists(path.Text))
            dialog.FileName = path.Text;

        if (dialog.ShowDialog(this) != DialogResult.OK) return;

        path.Text = dialog.FileName;
        UpdateLogoPath(path, preview);
    }

    private void UpdateLogoPath(TextBox path, Panel preview)
    {
        var value = path.Text.Trim();
        path.Text = value;
        Branding.LogoPath = value;
        RenderLogoPreview(preview, value);
    }

    private static void RenderLogoPreview(Panel preview, string? logoPath)
    {
        preview.SuspendLayout();
        foreach (Control control in preview.Controls) DisposeControlTree(control);
        preview.Controls.Clear();

        var image = TryLoadImageCopy(logoPath);
        if (image != null)
        {
            preview.Controls.Add(new PictureBox
            {
                Dock = DockStyle.Fill,
                BackColor = Color.White,
                SizeMode = PictureBoxSizeMode.Zoom,
                Image = image,
            });
        }
        else
        {
            preview.Controls.Add(new Label
            {
                Dock = DockStyle.Fill,
                Text = string.IsNullOrWhiteSpace(logoPath) ? "No logo selected" : "Logo file missing or unreadable",
                TextAlign = ContentAlignment.MiddleCenter,
                ForeColor = Ui.TextMuted,
                Font = Ui.F(9f),
            });
        }

        preview.ResumeLayout();
    }

    private static Image? TryLoadImageCopy(string? imagePath)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(imagePath) || !File.Exists(imagePath)) return null;

            using var stream = File.OpenRead(imagePath);
            using var image = Image.FromStream(stream);
            return new Bitmap(image);
        }
        catch (Exception)
        {
            return null;
        }
    }

    private static void DisposeControlTree(Control control)
    {
        foreach (Control child in control.Controls.Cast<Control>().ToList())
            DisposeControlTree(child);

        if (control is PictureBox pictureBox)
        {
            pictureBox.Image?.Dispose();
            pictureBox.Image = null;
        }

        control.Dispose();
    }

    private static Label SectionLabel(string text) => new()
    {
        Text = text,
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.MiddleLeft,
        ForeColor = Ui.TextMuted,
        Font = Ui.F(8.5f, FontStyle.Bold),
    };

    private static Label BrandingFieldLabel(string text) => new()
    {
        Text = text,
        Dock = DockStyle.Fill,
        TextAlign = ContentAlignment.MiddleLeft,
        ForeColor = Ui.TextDark,
        Font = Ui.F(9.5f, FontStyle.Bold),
    };

    private static void ResizeBrandingSections(FlowLayoutPanel list)
    {
        foreach (Control control in list.Controls)
            control.Width = Math.Max(660, list.ClientSize.Width - 10);
    }

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

    private void SaveAndApply()
    {
        CommitPendingEdits();

        try
        {
            ConfigManager.Save(_workingConfig);
            CloseWith(DialogResult.OK);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Dashboard settings could not be saved.\n\n{ex.Message}", "Save & Apply",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void ResetToDefaults()
    {
        var confirm = MessageBox.Show(
            "This will restore dashboard settings to defaults.\n\nContinue?",
            "Reset to Defaults",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning);

        if (confirm != DialogResult.Yes) return;

        try
        {
            ConfigManager.Save(ConfigManager.GetDefaults());
            CloseWith(DialogResult.OK);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Dashboard settings could not be reset.\n\n{ex.Message}", "Reset to Defaults",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void CommitPendingEdits()
    {
        var focused = FocusedControl(this);
        if (focused != null && focused != this)
        {
            SelectNextControl(focused, true, true, true, true);
            if (focused.Focused)
                focused.Parent?.Focus();
        }

        ValidateChildren();
    }

    private static Control? FocusedControl(Control parent)
    {
        if (parent.Focused) return parent;

        foreach (Control child in parent.Controls)
        {
            var focused = FocusedControl(child);
            if (focused != null) return focused;
        }

        return null;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        e.Graphics.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        var rect = new Rectangle(1, 1, Width - 3, Height - 3);
        using var pen = new Pen(ModalBorderColor, 2f);
        using var path = Ui.RoundedRect(rect, ModalRadius);
        e.Graphics.DrawPath(pen, path);
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
                BusinessName = TextOrDefault(source.Branding?.BusinessName, "Business Hub"),
                DashboardSubtitle = TextOrDefault(source.Branding?.DashboardSubtitle, "Owner Dashboard"),
                Tagline = source.Branding?.Tagline ?? "",
                Phone = source.Branding?.Phone ?? "",
                Email = source.Branding?.Email ?? "",
                Website = source.Branding?.Website ?? "",
                PrimaryColor = NormalizeHex(source.Branding?.PrimaryColor, "#3884FF"),
                SecondaryColor = NormalizeHex(source.Branding?.SecondaryColor, "#7C3AED"),
                LogoPath = source.Branding?.LogoPath ?? "",
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
    private bool _active;
    private bool _hover;

    public bool Active
    {
        get => _active;
        set
        {
            _active = value;
            UpdateBackColor();
            Invalidate();
        }
    }

    protected override void OnMouseEnter(EventArgs e)
    {
        _hover = true;
        UpdateBackColor();
        Invalidate();
        base.OnMouseEnter(e);
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        _hover = false;
        UpdateBackColor();
        Invalidate();
        base.OnMouseLeave(e);
    }

    private void UpdateBackColor() =>
        BackColor = _active ? Color.White
                  : _hover  ? Color.FromArgb(231, 238, 252)
                  :            Ui.ContentBg;

    protected override void OnPaint(PaintEventArgs e)
    {
        ForeColor = _active ? Ui.TextDark
                  : _hover  ? Color.FromArgb(68, 86, 118)
                  :            Ui.TextMuted;
        base.OnPaint(e);

        if (!_active) return;

        using var pen = new Pen(Ui.Accent, 3f);
        e.Graphics.DrawLine(pen, 14, Height - 3, Width - 14, Height - 3);
    }
}

internal class BuilderSurfacePanel : Panel
{
    public BuilderSurfacePanel()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Ui.ContentBg;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        var rect = new Rectangle(0, 0, Width - 1, Height - 1);
        using var path = Ui.RoundedRect(rect, 10);
        using var fill = new SolidBrush(Color.White);
        using var pen = new Pen(Ui.CardBorder);
        g.FillPath(fill, path);
        g.DrawPath(pen, path);
    }
}

internal class BuilderDropRow : TableLayoutPanel
{
    private readonly System.Windows.Forms.Timer _fadeTimer;
    private int _currentAlpha;
    private int _targetAlpha;

    public bool DropActive
    {
        get => _targetAlpha > 0;
        set
        {
            var next = value ? 42 : 0;
            if (_targetAlpha == next) return;

            _targetAlpha = next;
            _fadeTimer.Start();
        }
    }

    public BuilderDropRow()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Color.White;
        Padding = new Padding(2, 0, 2, 0);

        _fadeTimer = new System.Windows.Forms.Timer { Interval = 15 };
        _fadeTimer.Tick += (s, e) => FadeHighlight();
    }

    private void FadeHighlight()
    {
        if (_currentAlpha == _targetAlpha)
        {
            _fadeTimer.Stop();
            return;
        }

        var delta = _targetAlpha - _currentAlpha;
        _currentAlpha += Math.Sign(delta) * Math.Min(7, Math.Abs(delta));
        Invalidate();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
            _fadeTimer.Dispose();

        base.Dispose(disposing);
    }

    protected override void OnPaintBackground(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        var rect = new Rectangle(0, 0, Width - 1, Height - 1);

        using var path = Ui.RoundedRect(rect, 9);
        using var fill = new SolidBrush(Color.White);
        g.FillPath(fill, path);

        if (_currentAlpha > 0)
        {
            using var highlight = new SolidBrush(Color.FromArgb(_currentAlpha, Ui.Accent));
            g.FillPath(highlight, path);
        }

        using var pen = new Pen(_currentAlpha > 0 ? Ui.Accent : Color.Transparent, _currentAlpha > 0 ? 1.4f : 1f);
        g.DrawPath(pen, path);
    }
}

internal class ToggleSwitch : Control
{
    private const int TrackW  = 44;
    private const int TrackH  = 24;
    private const int KnobD   = 18;
    private const int KnobPad = 3;

    private bool _checked;
    private bool _hover;

    public bool Checked
    {
        get => _checked;
        set
        {
            if (_checked == value) return;
            _checked = value;
            CheckedChanged?.Invoke(this, EventArgs.Empty);
            Invalidate();
        }
    }

    public event EventHandler? CheckedChanged;

    public ToggleSwitch()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
        Cursor = Cursors.Hand;
    }

    protected override void OnMouseEnter(EventArgs e) { _hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { _hover = false; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button == MouseButtons.Left) Checked = !Checked;
        base.OnMouseDown(e);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;

        int tx = (Width  - TrackW) / 2;
        int ty = (Height - TrackH) / 2;
        var track = new Rectangle(tx, ty, TrackW, TrackH);

        var trackColor = _checked
            ? (_hover ? ControlPaint.Light(Ui.Accent, 0.08f) : Ui.Accent)
            : (_hover ? Color.FromArgb(178, 192, 212)        : Color.FromArgb(200, 210, 225));

        using (var path = Ui.RoundedRect(track, TrackH / 2))
        using (var b = new SolidBrush(trackColor))
            g.FillPath(b, path);

        int knobX = _checked ? tx + TrackW - KnobD - KnobPad : tx + KnobPad;
        int knobY = ty + (TrackH - KnobD) / 2;

        using var knobBrush = new SolidBrush(Color.White);
        g.FillEllipse(knobBrush, knobX, knobY, KnobD, KnobD);
    }
}

/// <summary>A styled, focus-aware text input — borderless TextBox inside a rounded painted panel.</summary>
internal class StyledInputPanel : Panel
{
    public readonly TextBox Inner;
    private bool _focused;
    private const int Radius = 7;

    public StyledInputPanel(string text = "")
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Color.White;

        Inner = new TextBox
        {
            Text = text,
            BorderStyle = BorderStyle.None,
            Font = Ui.F(10f),
            BackColor = Color.White,
        };

        Inner.GotFocus  += (s, e) => { _focused = true;  Invalidate(); };
        Inner.LostFocus += (s, e) => { _focused = false; Invalidate(); };

        Controls.Add(Inner);
        Click += (s, e) => Inner.Focus();
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        if (Inner == null) return;
        var ih = Inner.PreferredHeight;
        Inner.SetBounds(9, Math.Max(0, (Height - ih) / 2), Math.Max(0, Width - 18), ih);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        var rect = new Rectangle(0, 0, Width - 1, Height - 1);

        using var path = Ui.RoundedRect(rect, Radius);
        using var fill = new SolidBrush(Color.White);
        g.FillPath(fill, path);

        var borderColor = _focused ? Ui.Accent : Ui.CardBorder;
        float borderW   = _focused ? 1.8f : 1f;
        using var pen = new Pen(borderColor, borderW);
        g.DrawPath(pen, path);
    }
}

internal class BuilderIconButton : Control
{
    public Color AccentColor { get; set; } = Ui.TextMuted;

    private bool _hover;
    private bool _down;

    public BuilderIconButton()
    {
        SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint |
                 ControlStyles.OptimizedDoubleBuffer | ControlStyles.SupportsTransparentBackColor, true);
        BackColor = Color.Transparent;
        Cursor = Cursors.Hand;
        Font = Ui.F(10f, FontStyle.Bold);
        Width = 34;
        Height = 28;
    }

    protected override void OnEnabledChanged(EventArgs e)
    {
        Cursor = Enabled ? Cursors.Hand : Cursors.Default;
        Invalidate();
        base.OnEnabledChanged(e);
    }

    protected override void OnMouseEnter(EventArgs e)
    {
        _hover = true;
        Invalidate();
        base.OnMouseEnter(e);
    }

    protected override void OnMouseLeave(EventArgs e)
    {
        _hover = false;
        _down = false;
        Invalidate();
        base.OnMouseLeave(e);
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        _down = true;
        Invalidate();
        base.OnMouseDown(e);
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        _down = false;
        Invalidate();
        base.OnMouseUp(e);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = System.Drawing.Drawing2D.SmoothingMode.AntiAlias;
        g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.ClearTypeGridFit;

        var rect = new Rectangle(0, 0, Width - 1, Height - 1);
        var color = Enabled ? AccentColor : Color.FromArgb(176, 184, 198);
        var fill = Enabled && (_hover || _down)
            ? Color.FromArgb(_down ? 42 : 28, AccentColor)
            : Color.FromArgb(246, 248, 251);
        var border = Enabled && _hover ? AccentColor : Ui.CardBorder;

        using (var path = Ui.RoundedRect(rect, 7))
        using (var brush = new SolidBrush(fill))
        using (var pen = new Pen(border))
        {
            g.FillPath(brush, path);
            g.DrawPath(pen, path);
        }

        TextRenderer.DrawText(g, Text, Font, rect, color,
            TextFormatFlags.HorizontalCenter | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
    }
}
