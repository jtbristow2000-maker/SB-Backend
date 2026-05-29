using Microsoft.Data.Sqlite;

namespace BusinessDashboard;

public static class Database
{
    private static readonly string DbPath = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "BusinessDashboard", "data.db");

    public static void Initialize()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(DbPath)!);
        using var conn = Connect();
        conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = @"
            CREATE TABLE IF NOT EXISTS Appointments (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CustomerName TEXT NOT NULL,
                Phone TEXT, AppDate TEXT, AppTime TEXT,
                Service TEXT, Notes TEXT, Status TEXT DEFAULT 'Scheduled'
            );
            CREATE TABLE IF NOT EXISTS Quotes (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                CustomerName TEXT NOT NULL,
                Phone TEXT, QuoteDate TEXT, Service TEXT,
                Amount TEXT, Notes TEXT, Status TEXT DEFAULT 'Pending'
            );
            CREATE TABLE IF NOT EXISTS Messages (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                ContactName TEXT NOT NULL,
                Phone TEXT, DateReceived TEXT, Channel TEXT,
                Content TEXT, Status TEXT DEFAULT 'Unread'
            );
            CREATE TABLE IF NOT EXISTS Leads (
                Id INTEGER PRIMARY KEY AUTOINCREMENT,
                Name TEXT NOT NULL,
                Phone TEXT, Email TEXT, Source TEXT,
                Notes TEXT, Status TEXT DEFAULT 'New'
            );";
        cmd.ExecuteNonQuery();
    }

    public static SqliteConnection Connect() => new($"Data Source={DbPath}");

    // ---------------------------------------------------------- Appointments
    public static List<Appointment> GetAppointments(string search = "")
    {
        var list = new List<Appointment>();
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Appointments WHERE CustomerName LIKE $s OR Service LIKE $s OR Status LIKE $s OR Phone LIKE $s ORDER BY AppDate, AppTime";
        cmd.Parameters.AddWithValue("$s", $"%{search}%");
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(new Appointment
            {
                Id = r.GetInt32(0), CustomerName = r.GetString(1),
                Phone = Str(r, 2), AppDate = Str(r, 3), AppTime = Str(r, 4),
                Service = Str(r, 5), Notes = Str(r, 6), Status = Str(r, 7, "Scheduled")
            });
        return list;
    }

    public static void SaveAppointment(Appointment a)
    {
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        if (a.Id == 0)
            cmd.CommandText = "INSERT INTO Appointments (CustomerName,Phone,AppDate,AppTime,Service,Notes,Status) VALUES ($n,$p,$d,$t,$s,$no,$st)";
        else { cmd.CommandText = "UPDATE Appointments SET CustomerName=$n,Phone=$p,AppDate=$d,AppTime=$t,Service=$s,Notes=$no,Status=$st WHERE Id=$id"; cmd.Parameters.AddWithValue("$id", a.Id); }
        cmd.Parameters.AddWithValue("$n", a.CustomerName);
        cmd.Parameters.AddWithValue("$p", a.Phone);
        cmd.Parameters.AddWithValue("$d", a.AppDate);
        cmd.Parameters.AddWithValue("$t", a.AppTime);
        cmd.Parameters.AddWithValue("$s", a.Service);
        cmd.Parameters.AddWithValue("$no", a.Notes);
        cmd.Parameters.AddWithValue("$st", a.Status);
        cmd.ExecuteNonQuery();
    }

    public static void DeleteAppointment(int id) => DeleteById("Appointments", id);

    // ---------------------------------------------------------- Quotes
    public static List<Quote> GetQuotes(string search = "")
    {
        var list = new List<Quote>();
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Quotes WHERE CustomerName LIKE $s OR Service LIKE $s OR Status LIKE $s ORDER BY QuoteDate DESC";
        cmd.Parameters.AddWithValue("$s", $"%{search}%");
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(new Quote
            {
                Id = r.GetInt32(0), CustomerName = r.GetString(1),
                Phone = Str(r, 2), QuoteDate = Str(r, 3), Service = Str(r, 4),
                Amount = Str(r, 5), Notes = Str(r, 6), Status = Str(r, 7, "Pending")
            });
        return list;
    }

    public static void SaveQuote(Quote q)
    {
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        if (q.Id == 0)
            cmd.CommandText = "INSERT INTO Quotes (CustomerName,Phone,QuoteDate,Service,Amount,Notes,Status) VALUES ($n,$p,$d,$s,$a,$no,$st)";
        else { cmd.CommandText = "UPDATE Quotes SET CustomerName=$n,Phone=$p,QuoteDate=$d,Service=$s,Amount=$a,Notes=$no,Status=$st WHERE Id=$id"; cmd.Parameters.AddWithValue("$id", q.Id); }
        cmd.Parameters.AddWithValue("$n", q.CustomerName);
        cmd.Parameters.AddWithValue("$p", q.Phone);
        cmd.Parameters.AddWithValue("$d", q.QuoteDate);
        cmd.Parameters.AddWithValue("$s", q.Service);
        cmd.Parameters.AddWithValue("$a", q.Amount);
        cmd.Parameters.AddWithValue("$no", q.Notes);
        cmd.Parameters.AddWithValue("$st", q.Status);
        cmd.ExecuteNonQuery();
    }

    public static void DeleteQuote(int id) => DeleteById("Quotes", id);

    // ---------------------------------------------------------- Messages
    public static List<Message> GetMessages(string search = "")
    {
        var list = new List<Message>();
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Messages WHERE ContactName LIKE $s OR Phone LIKE $s OR Status LIKE $s OR Channel LIKE $s OR Content LIKE $s ORDER BY Id DESC";
        cmd.Parameters.AddWithValue("$s", $"%{search}%");
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(new Message
            {
                Id = r.GetInt32(0), ContactName = r.GetString(1),
                Phone = Str(r, 2), DateReceived = Str(r, 3), Channel = Str(r, 4, "Phone Call"),
                Content = Str(r, 5), Status = Str(r, 6, "Unread")
            });
        return list;
    }

    public static void SaveMessage(Message m)
    {
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        if (m.Id == 0)
            cmd.CommandText = "INSERT INTO Messages (ContactName,Phone,DateReceived,Channel,Content,Status) VALUES ($n,$p,$d,$c,$co,$st)";
        else { cmd.CommandText = "UPDATE Messages SET ContactName=$n,Phone=$p,DateReceived=$d,Channel=$c,Content=$co,Status=$st WHERE Id=$id"; cmd.Parameters.AddWithValue("$id", m.Id); }
        cmd.Parameters.AddWithValue("$n", m.ContactName);
        cmd.Parameters.AddWithValue("$p", m.Phone);
        cmd.Parameters.AddWithValue("$d", m.DateReceived);
        cmd.Parameters.AddWithValue("$c", m.Channel);
        cmd.Parameters.AddWithValue("$co", m.Content);
        cmd.Parameters.AddWithValue("$st", m.Status);
        cmd.ExecuteNonQuery();
    }

    public static void DeleteMessage(int id) => DeleteById("Messages", id);

    // ---------------------------------------------------------- Leads
    public static List<Lead> GetLeads(string search = "")
    {
        var list = new List<Lead>();
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT * FROM Leads WHERE Name LIKE $s OR Phone LIKE $s OR Status LIKE $s OR Source LIKE $s OR Email LIKE $s ORDER BY Status, Name";
        cmd.Parameters.AddWithValue("$s", $"%{search}%");
        using var r = cmd.ExecuteReader();
        while (r.Read())
            list.Add(new Lead
            {
                Id = r.GetInt32(0), Name = r.GetString(1),
                Phone = Str(r, 2), Email = Str(r, 3), Source = Str(r, 4),
                Notes = Str(r, 5), Status = Str(r, 6, "New")
            });
        return list;
    }

    public static void SaveLead(Lead l)
    {
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        if (l.Id == 0)
            cmd.CommandText = "INSERT INTO Leads (Name,Phone,Email,Source,Notes,Status) VALUES ($n,$p,$e,$so,$no,$st)";
        else { cmd.CommandText = "UPDATE Leads SET Name=$n,Phone=$p,Email=$e,Source=$so,Notes=$no,Status=$st WHERE Id=$id"; cmd.Parameters.AddWithValue("$id", l.Id); }
        cmd.Parameters.AddWithValue("$n", l.Name);
        cmd.Parameters.AddWithValue("$p", l.Phone);
        cmd.Parameters.AddWithValue("$e", l.Email);
        cmd.Parameters.AddWithValue("$so", l.Source);
        cmd.Parameters.AddWithValue("$no", l.Notes);
        cmd.Parameters.AddWithValue("$st", l.Status);
        cmd.ExecuteNonQuery();
    }

    public static void DeleteLead(int id) => DeleteById("Leads", id);

    // ---------------------------------------------------------- helpers
    private static string Str(SqliteDataReader r, int i, string fallback = "") => r.IsDBNull(i) ? fallback : r.GetString(i);

    private static void DeleteById(string table, int id)
    {
        using var conn = Connect(); conn.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = $"DELETE FROM {table} WHERE Id=$id";
        cmd.Parameters.AddWithValue("$id", id);
        cmd.ExecuteNonQuery();
    }
}
