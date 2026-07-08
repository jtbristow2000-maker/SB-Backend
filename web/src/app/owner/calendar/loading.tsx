import { Bar, CardBlock } from "@/app/owner/Skeleton";

// Instant skeleton for Schedule — booking form card, view toggle, calendar grid.
export default function CalendarLoading() {
  return (
    <main className="owner-page" style={{ maxWidth: 760 }}>
      <Bar w={130} h={24} />
      <Bar w={260} h={12} style={{ marginTop: 8 }} />
      <CardBlock h={210} style={{ marginTop: 18 }} />
      <div style={{ display: "flex", gap: 6, marginTop: 18 }}>
        {[64, 68, 72].map((w, i) => (
          <Bar key={i} w={w} h={32} style={{ borderRadius: 9 }} />
        ))}
        <span style={{ flex: 1 }} />
        <Bar w={120} h={32} style={{ borderRadius: 9 }} />
      </div>
      <CardBlock h={420} style={{ marginTop: 12 }} />
    </main>
  );
}
