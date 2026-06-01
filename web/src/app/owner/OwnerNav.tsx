"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Owner navigation, shared by the desktop sidebar and the mobile bottom tab bar.
// Client component so it can highlight the active screen via usePathname().

const ITEMS = [
  { href: "/owner/today", label: "Today", icon: "📊" },
  { href: "/owner", label: "Callbacks", icon: "📞" },
  { href: "/owner/leads", label: "Leads", icon: "👥" },
  { href: "/owner/calendar", label: "Schedule", icon: "📅" }
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/owner/today") {
    return pathname === "/owner/today";
  }
  if (href === "/owner/leads") {
    return pathname === "/owner/leads";
  }
  if (href === "/owner/calendar") {
    return pathname === "/owner/calendar";
  }
  // Callbacks tab stays active on the list AND on a lead detail page (/owner/<id>),
  // but not on the other top-level tabs.
  return (
    pathname === "/owner" ||
    (pathname.startsWith("/owner/") &&
      pathname !== "/owner/today" &&
      pathname !== "/owner/leads" &&
      pathname !== "/owner/calendar")
  );
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
