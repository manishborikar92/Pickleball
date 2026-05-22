"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Badge, Button } from "@/components/shared";
import { signOutDemo } from "@/app/actions/auth-actions";

const ADMIN_LINKS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/courts", label: "Courts" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/settings", label: "Settings" },
];

export function AdminShell({ session, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground md:flex-row">
      <Sidebar session={session} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}

function Sidebar({ session }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 flex flex-col border-b border-line bg-surface md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r lg:w-72">
      <div className="flex h-full flex-col p-4 sm:p-6">
        <Link 
          href="/" 
          className="group flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <div className="flex shrink-0 items-center justify-center transition-transform group-hover:scale-105">
            <Image src="/baseline-logo.svg" alt="Baseline Arena Logo" width={48} height={48} className="h-12 w-12" />
          </div>
          <span className="text-xl font-black tracking-tight text-foreground transition-colors group-hover:text-accent">
            Baseline Arena Ops
          </span>
        </Link>

        <SessionCard session={session} />

        {/* Mobile: Horizontal smooth scroll | Desktop: Vertical stack */}
        <nav
          className="mt-5 flex gap-2 overflow-x-auto pb-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-8 md:flex-col md:overflow-visible md:pb-0"
          aria-label="Admin navigation"
        >
          {ADMIN_LINKS.map(({ href, label, exact }) => {
            const isActive = exact ? pathname === href : pathname?.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors md:px-3 md:py-2 ${
                  isActive
                    ? "bg-surface-high font-semibold text-accent"
                    : "text-muted hover:bg-surface-high/50 hover:text-foreground"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Pushed to the bottom on desktop via mt-auto */}
        <div className="mt-auto pt-4 md:pt-6">
          <form action={signOutDemo}>
            <Button variant="secondary" className="w-full" type="submit">
              Sign Out
            </Button>
          </form>
        </div>
      </div>
    </aside>
  );
}

function SessionCard({ session }) {
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