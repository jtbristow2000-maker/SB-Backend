import { Bar, CardBlock } from "@/app/owner/Skeleton";

// Instant skeleton for the Leads directory — search bar, filter chips, rows.
export default function LeadsLoading() {
  return (
    <main className="owner-page" style={{ maxWidth: 720 }}>
      <Bar w={120} h={24} />
      <Bar w={200} h={12} style={{ marginTop: 8 }} />
      <CardBlock h={46} style={{ marginTop: 18, borderRadius: 11 }} />
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        {[52, 60, 84, 68, 56].map((w, i) => (
          <Bar key={i} w={w} h={28} style={{ borderRadius: 999 }} />
        ))}
      </div>
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 9 }}>
        <CardBlock h={86} />
        <CardBlock h={86} />
        <CardBlock h={86} />
        <CardBlock h={86} />
        <CardBlock h={86} />
      </div>
    </main>
  );
}
