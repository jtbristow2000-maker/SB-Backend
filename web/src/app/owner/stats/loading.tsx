import { Bar, CardBlock } from "@/app/owner/Skeleton";

// Instant skeleton for Stats — hero, goals, chart, activity, records.
export default function StatsLoading() {
  return (
    <main className="owner-page" style={{ maxWidth: 920 }}>
      <Bar w={90} h={24} />
      <Bar w={260} h={12} style={{ marginTop: 8 }} />
      <CardBlock h={170} style={{ marginTop: 18 }} />
      <CardBlock h={150} style={{ marginTop: 14 }} />
      <CardBlock h={190} style={{ marginTop: 14 }} />
      <CardBlock h={120} style={{ marginTop: 14 }} />
      <CardBlock h={110} style={{ marginTop: 14 }} />
    </main>
  );
}
