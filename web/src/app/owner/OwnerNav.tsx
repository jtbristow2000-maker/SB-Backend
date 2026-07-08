"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, LayoutDashboard, Users, type LucideIcon } from "lucide-react";

// Owner navigation, shared by the desktop sidebar and the mobile bottom tab bar.
// Client component so it can highlight the active screen via usePathname().

const ITEMS: ReadonlyArray<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: "/owner/today", label: "Today", Icon: LayoutDashboard },
  { href: "/owner/leads", label: "Leads", Icon: Users },
  { href: "/owner/calendar", label: "Schedule", Icon: CalendarDays },
  { href: "/owner/stats", label: "Stats", Icon: BarChart3 }
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/owner/today") {
    return pathname === "/owner/today" || pathname === "/owner";
  }
  if (href === "/owner/calendar") {
    return pathname === "/owner/calendar";
  }
  if (href === "/owner/stats") {
    return pathname === "/owner/stats";
  }
  // Leads tab covers the pipeline directory AND an individual lead detail (/owner/<id>),
  // but not the other top-level routes (Today / Schedule / Stats / Settings / Simulator).
  if (href === "/owner/leads") {
    return (
      pathname === "/owner/leads" ||
      (pathname.startsWith("/owner/") &&
        pathname !== "/owner/today" &&
        pathname !== "/owner/calendar" &&
        pathname !== "/owner/stats" &&
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
        {ITEMS.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            className={`owner-tab${isActive(pathname, href) ? " active" : ""}`}
          >
            <Icon size={20} strokeWidth={2.1} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav>
      {ITEMS.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`owner-nav-link${isActive(pathname, href) ? " active" : ""}`}
        >
          <Icon size={17} strokeWidth={2.1} aria-hidden />
          {label}
        </Link>
      ))}
    </nav>
  );
}
