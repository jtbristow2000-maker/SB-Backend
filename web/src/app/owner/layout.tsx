import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { FlaskConical, LogOut, Settings } from "lucide-react";

import { getAppConfig } from "@/server/config";
import { getBusinessSettings } from "@/server/business/settings";
import { getOwnerBusinessContext } from "@/server/business/current";

import { AutoRefresh } from "./AutoRefresh";
import { OwnerNav } from "./OwnerNav";
import { BrandLogo } from "./BrandLogo";

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
  const context = await getOwnerBusinessContext();
  const business = context?.business ?? null;
  const settings = getBusinessSettings(business);
  const config = getAppConfig();
  const simulatorEnabled = config.simulatorEnabled;
  // Auth is only active in supabase mode; only then is there a session to sign out of.
  const authEnabled = config.persistence === "supabase";
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
          <BrandLogo logoUrl={settings.logo_url} letter={(business?.name || "B").charAt(0).toUpperCase()} className="owner-logo" />
          <div>
            <div className="owner-brand-name">{business?.name || "Business Hub"}</div>
            <div className="owner-brand-sub">Owner Dashboard</div>
          </div>
        </div>

        <div className="owner-menu-label">MENU</div>
        <OwnerNav variant="sidebar" />

        <div className="owner-sidebar-footer">
          {simulatorEnabled && (
            <Link href="/owner/simulator" className="owner-console-link" style={{ display: "flex", marginBottom: 6 }}><FlaskConical size={13} aria-hidden /> Simulator</Link>
          )}
          <Link href="/owner/settings" className="owner-console-link" style={{ display: "flex" }}><Settings size={13} aria-hidden /> Settings</Link>
          {authEnabled && (
            <form action="/api/auth/sign-out" method="post" style={{ margin: "6px 0 0" }}>
              <button
                type="submit"
                className="owner-console-link"
                style={{ display: "flex", background: "none", border: "none", padding: 0, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}
              >
                <LogOut size={13} aria-hidden /> Sign out
              </button>
            </form>
          )}
          <div className="owner-version">● Live · updates automatically</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="owner-topbar">
        <div className="owner-topbar-brand">
          <BrandLogo logoUrl={settings.logo_url} letter={(business?.name || "B").charAt(0).toUpperCase()} className="owner-logo owner-logo-sm" />
          <span>{business?.name || "Business Hub"}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {simulatorEnabled && (
            <Link href="/owner/simulator" className="owner-topbar-console" aria-label="Simulator"><FlaskConical size={16} aria-hidden /></Link>
          )}
          <Link href="/owner/settings" className="owner-topbar-console"><Settings size={14} aria-hidden /> Settings</Link>
          {authEnabled && (
            <form action="/api/auth/sign-out" method="post" style={{ display: "flex" }}>
              <button
                type="submit"
                className="owner-topbar-console"
                style={{ background: "none", border: "none", padding: 0, fontFamily: "inherit", cursor: "pointer" }}
                aria-label="Sign out"
              >
                <LogOut size={14} aria-hidden /> Sign out
              </button>
            </form>
          )}
        </div>
      </header>

      <div className="owner-content">{children}</div>

      {/* Mobile bottom tab bar */}
      <OwnerNav variant="tabbar" />
    </div>
  );
}
