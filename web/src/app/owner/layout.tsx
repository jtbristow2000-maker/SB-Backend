import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { getBusinessSettings } from "@/server/business/settings";
import { getIntakeRuntime } from "@/server/intake/runtime";

import { AutoRefresh } from "./AutoRefresh";
import { OwnerNav } from "./OwnerNav";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Owner app shell — responsive (desktop sidebar / mobile top + bottom bars).
// Reads the business's saved brand color and applies it as the --brand theme
// token on the shell, so the whole app re-skins per client. Settings is a gear
// in the top bar / sidebar footer (not a primary tab).
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : "91, 91, 214";
}

export default async function OwnerLayout({ children }: { children: ReactNode }) {
  const rt = await getIntakeRuntime();
  const business = (await rt.businessRepository.list())[0] ?? null;
  const settings = getBusinessSettings(business);
  const themeStyle = {
    "--brand": settings.brand_color,
    "--brand-rgb": hexToRgb(settings.brand_color)
  } as CSSProperties;

  return (
    <div className="owner-shell" style={themeStyle}>
      <AutoRefresh seconds={10} />
      {/* Desktop sidebar */}
      <aside className="owner-sidebar">
        <div className="owner-brand">
          <div className="owner-logo">{(business?.name || "B").charAt(0).toUpperCase()}</div>
          <div>
            <div className="owner-brand-name">{business?.name || "Business Hub"}</div>
            <div className="owner-brand-sub">Owner Dashboard</div>
          </div>
        </div>

        <div className="owner-menu-label">MENU</div>
        <OwnerNav variant="sidebar" />

        <div className="owner-sidebar-footer">
          <Link href="/owner/settings" className="owner-console-link">⚙ Settings</Link>
          <div className="owner-version">● Live · updates automatically</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="owner-topbar">
        <div className="owner-topbar-brand">
          <span className="owner-logo owner-logo-sm">{(business?.name || "B").charAt(0).toUpperCase()}</span>
          <span>{business?.name || "Business Hub"}</span>
        </div>
        <Link href="/owner/settings" className="owner-topbar-console">⚙ Settings</Link>
      </header>

      <div className="owner-content">{children}</div>

      {/* Mobile bottom tab bar */}
      <OwnerNav variant="tabbar" />
    </div>
  );
}
