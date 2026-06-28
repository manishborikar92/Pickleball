"use client";

import { Badge } from "@/components/shared";
import { BaseSidebar } from "./BaseSidebar";
import { signOutStaffAction } from "@/app/(auth)/actions";

const ADMIN_LINKS = [
  { href: "/admin/overview", label: "Overview", exact: true },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/courts", label: "Courts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminShell({ session, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row md:h-screen md:overflow-hidden">
      <BaseSidebar
        title="Baseline Arena"
        logoSrc="/baseline-logo.svg"
        navLinks={ADMIN_LINKS}
        session={session}
        signOutAction={signOutStaffAction}
        sessionInfoRenderer={AdminSessionCard}
      />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8 md:h-full md:overflow-hidden flex flex-col">{children}</main>
    </div>
  );
}

function AdminSessionCard(session) {
  return (
    <div className="mt-5 flex flex-col items-start rounded-xl border border-line bg-surface-panel p-4 shadow-sm transition-shadow hover:shadow-md">
      <Badge tone="accent" className="mb-3 uppercase tracking-wider text-[10px]">
        {session?.role?.replace("_", " ") || "Guest"}
      </Badge>
      <p className="line-clamp-1 font-bold text-foreground">
        {session?.user?.name || "Unknown User"}
      </p>
      <p className="line-clamp-1 mt-1 text-xs text-muted">
        Besa venue command center
      </p>
    </div>
  );
}
