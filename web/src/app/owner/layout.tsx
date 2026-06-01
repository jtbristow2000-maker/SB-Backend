import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Owner app shell — graphite sidebar + content area, premium style (matches the
// WinForms dashboard look). Wraps every /owner/* page.
// ---------------------------------------------------------------------------

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div style={S.shell}>
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <div style={S.logo}>B</div>
          <div>
            <div style={S.brandName}>Business Hub</div>
            <div style={S.brandSub}>Owner Dashboard</div>
          </div>
        </div>

        <div style={S.menuLabel}>MENU</div>
        <Link href="/owner/today" style={S.navItem}>📊&nbsp;&nbsp;Today</Link>
        <Link href="/owner" style={S.navItem}>📞&nbsp;&nbsp;Callbacks</Link>

        <div style={S.sidebarFooter}>
          <Link href="/" style={S.consoleLink}>↗ Sandbox Console</Link>
          <div style={S.version}>Sandbox · in-memory</div>
        </div>
      </aside>

      <div style={S.content}>{children}</div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  shell: { display: "flex", minHeight: "100vh", fontFamily: "Segoe UI, system-ui, sans-serif", background: "#f6f7f9" },
  sidebar: { width: 230, flexShrink: 0, background: "#16181d", color: "#9ca3af", display: "flex", flexDirection: "column", padding: "20px 0" },
  brand: { display: "flex", alignItems: "center", gap: 12, padding: "0 18px 18px" },
  logo: { width: 40, height: 40, borderRadius: 10, background: "linear-gradient(135deg,#5b5bd6,#7c3aed)", color: "#fff", fontWeight: 700, fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  brandName: { color: "#fff", fontWeight: 700, fontSize: 14 },
  brandSub: { color: "#8a909c", fontSize: 11 },
  menuLabel: { color: "#6b7280", fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "8px 18px 6px" },
  navItem: { display: "block", color: "#cdd2da", textDecoration: "none", fontSize: 14, fontWeight: 600, padding: "11px 18px", margin: "2px 10px", borderRadius: 9 },
  sidebarFooter: { marginTop: "auto", padding: "12px 18px 0" },
  consoleLink: { color: "#cdd2da", textDecoration: "none", fontSize: 12, fontWeight: 600 },
  version: { color: "#5b6270", fontSize: 11, marginTop: 8 },
  content: { flex: 1, minWidth: 0, overflowX: "auto" }
};
