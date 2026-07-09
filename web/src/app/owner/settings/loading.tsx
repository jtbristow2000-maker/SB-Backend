import { Bar, CardBlock } from "@/app/owner/Skeleton";

// Instant skeleton for Settings — stacked section cards.
export default function SettingsLoading() {
  return (
    <main className="owner-page" style={{ maxWidth: 1080 }}>
      <Bar w={110} h={24} />
      <Bar w={280} h={12} style={{ marginTop: 8 }} />
      <CardBlock h={130} style={{ marginTop: 16 }} />
      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
        <CardBlock h={340} />
        <CardBlock h={180} />
        <CardBlock h={110} />
        <CardBlock h={110} />
        <CardBlock h={200} />
      </div>
    </main>
  );
}
