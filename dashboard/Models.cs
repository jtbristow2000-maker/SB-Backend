namespace BusinessDashboard;

// ---------------------------------------------------------------------------
// Models — SQLite-backed data entities for the four dashboard modules.
//
// Rules for Codex:
//  • Status values stored in SQLite are STAGE IDs (e.g. "won"), not labels.
//    MainForm.StageLabelForStatus() maps id → current configured label for display.
//  • New fields should be nullable or have sensible defaults so existing rows
//    can be loaded without a schema migration.
//  • All CRUD is in Database.cs.  Do not add DB logic here.
// ---------------------------------------------------------------------------

public class Appointment
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Address { get; set; } = "";
    public string AppDate { get; set; } = "";
    public string AppTime { get; set; } = "";
    public string Service { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "Scheduled";
}

public class Quote
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string QuoteDate { get; set; } = "";
    public string Service { get; set; } = "";
    public string Amount { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "Pending";
}

public class Message
{
    public int Id { get; set; }
    public string ContactName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string DateReceived { get; set; } = "";
    public string Channel { get; set; } = "Phone Call";
    public string Content { get; set; } = "";
    public string Status { get; set; } = "Unread";
}

public class Lead
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Phone { get; set; } = "";
    public string Email { get; set; } = "";
    public string Source { get; set; } = "";
    public string Notes { get; set; } = "";
    public string Status { get; set; } = "New";
}
