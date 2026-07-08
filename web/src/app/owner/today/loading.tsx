import { Bar, CardBlock, CardRow } from "@/app/owner/Skeleton";

// Instant skeleton for Today while the server data loads — mirrors the greeting,
// metric row, weekly row, and needs-attention list so the swap doesn't jump.
export default function TodayLoading() {
  return (
    <main className="owner-page">
      <Bar w={220} h={28} />
      <Bar w={150} h={12} style={{ marginTop: 8 }} />
      <div style={{ marginTop: 22 }}>
        <CardRow count={4} h={104} />
      </div>
      <Bar w={80} h={10} style={{ margin: "30px 0 11px" }} />
      <CardRow count={4} h={66} minW={110} />
      <Bar w={120} h={10} style={{ margin: "30px 0 11px" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        <CardBlock h={120} />
        <CardBlock h={120} />
        <CardBlock h={120} />
      </div>
    </main>
  );
}
