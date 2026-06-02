// Shown by the service worker when a page navigation happens with no connection.
// Styles are inline so it still looks right even if the stylesheet isn't cached.
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        fontFamily: "Segoe UI, system-ui, sans-serif",
        color: "#1e2026",
        background: "#f3f5f9",
        textAlign: "center"
      }}
    >
      <div>
        <div style={{ fontSize: 44, marginBottom: 10 }}>📡</div>
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>You&apos;re offline</h1>
        <p style={{ color: "#6b7280", fontSize: 14, maxWidth: 300, lineHeight: 1.5 }}>
          No connection right now. Your leads and messages will be here the moment you&apos;re back online.
        </p>
      </div>
    </main>
  );
}
