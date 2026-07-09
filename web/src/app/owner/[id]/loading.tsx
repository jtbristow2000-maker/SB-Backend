import { Bar, CardBlock } from "@/app/owner/Skeleton";

// Instant skeleton for a lead detail — header, call/text buttons, action bar,
// conversation bubbles, composer.
export default function LeadLoading() {
  return (
    <main className="owner-page" style={{ maxWidth: 860 }}>
      <Bar w={60} h={12} />
      <Bar w={230} h={26} style={{ marginTop: 16 }} />
      <Bar w={170} h={12} style={{ marginTop: 8 }} />
      <div style={{ display: "flex", gap: 10, margin: "14px 0 4px" }}>
        <CardBlock h={46} style={{ flex: 1, borderRadius: 12 }} />
        <CardBlock h={46} style={{ flex: 1, borderRadius: 12 }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        {[92, 104, 76].map((w, i) => (
          <Bar key={i} w={w} h={32} style={{ borderRadius: 9 }} />
        ))}
      </div>
      <Bar w={110} h={10} style={{ margin: "26px 0 10px" }} />
      <CardBlock h={72} style={{ maxWidth: "88%" }} />
      <CardBlock h={52} style={{ maxWidth: "82%", marginTop: 10, marginLeft: "auto" }} />
      <CardBlock h={280} style={{ marginTop: 22 }} />
    </main>
  );
}
