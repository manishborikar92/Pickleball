"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/shared";
import { signOutDemo } from "@/app/actions/auth-actions";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/wallet", label: "Wallet" },
  { href: "/venues/besa-nagpur/book", label: "Book Again" },
];

export function AppSidebar({ session }) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 flex flex-col border-b border-line bg-surface md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r lg:w-72">
      <div className="flex h-full flex-col p-4 sm:p-6">
        <Link 
          href="/" 
          className="text-xl font-black tracking-tight text-accent transition-opacity hover:opacity-80"
        >
          Pro-Tech Courts
        </Link>

        <SessionInfo session={session} />

        {/* Mobile: Horizontal smooth scroll | Desktop: Vertical stack */}
        <nav
          className="mt-5 flex gap-2 overflow-x-auto pb-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-8 md:flex-col md:overflow-visible md:pb-0"
          aria-label="Dashboard navigation"
        >
          {NAV_LINKS.map(({ href, label, exact }) => {
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

function SessionInfo({ session }) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-surface-panel p-4 shadow-sm transition-shadow hover:shadow-md">
      <p className="line-clamp-1 font-bold text-foreground">
        {session?.user?.name || "Unknown User"}
      </p>
      <p className="line-clamp-1 mt-1 text-xs capitalize text-muted">
        {session?.role?.replace("_", " ") || "Member"}
      </p>
    </div>
  );
}