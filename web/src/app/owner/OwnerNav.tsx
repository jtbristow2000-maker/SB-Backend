"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Owner navigation, shared by the desktop sidebar and the mobile bottom tab bar.
// Client component so it can highlight the active screen via usePathname().

const ITEMS = [
  { href: "/owner/today", label: "Today", icon: "📊" },
  { href: "/owner/leads", label: "Leads", icon: "👥" },
  { href: "/owner/calendar", label: "Schedule", icon: "📅" }
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/owner/today") {
    return pathname === "/owner/today" || pathname === "/owner";
  }
  if (href === "/owner/calendar") {
    return pathname === "/owner/calendar";
  }
  // Leads tab covers the pipeline directory AND an individual lead detail (/owner/<id>),
  // but not the other top-level routes (Today / Schedule / Settings / Simulator).
  if (href === "/owner/leads") {
    return (
      pathname === "/owner/leads" ||
      (pathname.startsWith("/owner/") &&
        pathname !== "/owner/today" &&
        pathname !== "/owner/calendar" &&
        pathname !== "/owner/settings" &&
        pathname !== "/owner/simulator")
    );
  }
  return false;
}

export function OwnerNav({ variant }: { variant: "sidebar" | "tabbar" }) {
  const pathname = usePathname() || "";

  if (variant === "tabbar") {
    return (
      <nav className="owner-tabbar">
        {ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`owner-tab${isActive(pathname, item.href) ? " active" : ""}`}
          >
            <span className="owner-tab-icon">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav>
      {ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`owner-nav-link${isActive(pathname, item.href) ? " active" : ""}`}
        >
          <span aria-hidden>{item.icon}</span>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
