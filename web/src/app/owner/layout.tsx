import Link from "next/link";
import type { ReactNode } from "react";

import { AutoRefresh } from "./AutoRefresh";
import { OwnerNav } from "./OwnerNav";

// ---------------------------------------------------------------------------
// Owner app shell — responsive. Desktop: graphite left sidebar. Mobile: a slim
// top bar + a fixed bottom tab bar (thumb-friendly, like a native app), since
// the owner uses this on their phone in the field. Layout/breakpoints live in
// styles.css; active-tab highlighting is handled by the OwnerNav client island.
// ---------------------------------------------------------------------------

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="owner-shell">
      <AutoRefresh seconds={10} />
      {/* Desktop sidebar */}
      <aside className="owner-sidebar">
        <div className="owner-brand">
          <div className="owner-logo">B</div>
          <div>
            <div className="owner-brand-name">Business Hub</div>
            <div className="owner-brand-sub">Owner Dashboard</div>
          </div>
        </div>

        <div className="owner-menu-label">MENU</div>
        <OwnerNav variant="sidebar" />

        <div className="owner-sidebar-footer">
          <Link href="/" className="owner-console-link">↗ Sandbox Console</Link>
          <div className="owner-version">● Live · updates automatically</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="owner-topbar">
        <div className="owner-topbar-brand">
          <span className="owner-logo owner-logo-sm">B</span>
          <span>Business Hub</span>
        </div>
        <Link href="/" className="owner-topbar-console">Console</Link>
      </header>

      <div className="owner-content">{children}</div>

      {/* Mobile bottom tab bar */}
      <OwnerNav variant="tabbar" />
    </div>
  );
}
