namespace BusinessDashboard;

public class Appointment
{
    public int Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
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
