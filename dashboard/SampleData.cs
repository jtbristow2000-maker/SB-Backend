namespace BusinessDashboard;

/// <summary>Dev-only sample data for screenshots/demos. Triggered with the --seed flag.</summary>
public static class SampleData
{
    public static void Seed()
    {
        // wipe existing
        foreach (var l in Database.GetLeads()) Database.DeleteLead(l.Id);
        foreach (var a in Database.GetAppointments()) Database.DeleteAppointment(a.Id);
        foreach (var m in Database.GetMessages()) Database.DeleteMessage(m.Id);
        foreach (var q in Database.GetQuotes()) Database.DeleteQuote(q.Id);

        Database.SaveLead(new Lead { Name = "Maria Gonzalez", Phone = "(555) 204-1180", Email = "maria.g@gmail.com", Source = "Referral", Status = "New" });
        Database.SaveLead(new Lead { Name = "Trent Whitaker", Phone = "(555) 661-3340", Email = "trentw@outlook.com", Source = "Website form", Status = "Contacted" });
        Database.SaveLead(new Lead { Name = "Bayside Cafe", Phone = "(555) 909-7712", Email = "owner@baysidecafe.com", Source = "Google", Status = "Quoted" });
        Database.SaveLead(new Lead { Name = "Derek Olsen", Phone = "(555) 332-8890", Email = "", Source = "Facebook", Status = "Won" });

        Database.SaveAppointment(new Appointment { CustomerName = "Maria Gonzalez", Phone = "(555) 204-1180", AppDate = "05/29/2026", AppTime = "9:00 AM", Service = "Kitchen sink install", Status = "Confirmed" });
        Database.SaveAppointment(new Appointment { CustomerName = "Bayside Cafe", Phone = "(555) 909-7712", AppDate = "05/29/2026", AppTime = "1:30 PM", Service = "Walk-in cooler repair", Status = "Scheduled" });
        Database.SaveAppointment(new Appointment { CustomerName = "Janet Pruitt", Phone = "(555) 145-0098", AppDate = "05/30/2026", AppTime = "11:00 AM", Service = "Water heater quote", Status = "Scheduled" });

        Database.SaveMessage(new Message { ContactName = "Trent Whitaker", Phone = "(555) 661-3340", Channel = "Voicemail", DateReceived = "05/28/2026", Content = "Wants to reschedule Thursday to next week if possible.", Status = "Unread" });
        Database.SaveMessage(new Message { ContactName = "Derek Olsen", Phone = "(555) 332-8890", Channel = "Text", DateReceived = "05/28/2026", Content = "Thanks, the new faucet works great!", Status = "Read" });
        Database.SaveMessage(new Message { ContactName = "Janet Pruitt", Phone = "(555) 145-0098", Channel = "Phone Call", DateReceived = "05/27/2026", Content = "Asked about financing options for water heater.", Status = "Replied" });

        Database.SaveQuote(new Quote { CustomerName = "Bayside Cafe", Phone = "(555) 909-7712", Service = "Walk-in cooler compressor replacement", Amount = "2400", QuoteDate = "05/27/2026", Status = "Sent" });
        Database.SaveQuote(new Quote { CustomerName = "Derek Olsen", Phone = "(555) 332-8890", Service = "Bathroom faucet + supply lines", Amount = "320", QuoteDate = "05/25/2026", Status = "Accepted" });
        Database.SaveQuote(new Quote { CustomerName = "Janet Pruitt", Phone = "(555) 145-0098", Service = "50-gal water heater install", Amount = "1850", QuoteDate = "05/28/2026", Status = "Pending" });
    }
}
