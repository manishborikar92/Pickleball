"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Button } from "@/components/shared";

/**
 * BaseSidebar component.
 * Abstracts structural, spacing, and styling duplication for layouts
 * between the admin shell and player dashboard sidebars.
 */
export function BaseSidebar({
  title = "Baseline Arena",
  logoSrc = "/baseline-logo.svg",
  navLinks = [],
  session,
  sessionInfoRenderer,
  signOutAction,
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 z-20 flex flex-col border-b border-line bg-surface md:min-h-screen md:w-64 md:shrink-0 md:border-b-0 md:border-r lg:w-72">
      <div className="flex h-full flex-col p-4 sm:p-6">
        {/* Branding Logo & Header */}
        <Link 
          href="/" 
          className="group flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <div className="flex shrink-0 items-center justify-center transition-transform group-hover:scale-105">
            <Image 
              src={logoSrc} 
              alt={`${title} Logo`} 
              width={48} 
              height={48} 
              className="h-12 w-12" 
              priority
            />
          </div>
          <span className="text-xl font-black tracking-tight text-foreground transition-colors group-hover:text-accent">
            {title}
          </span>
        </Link>

        {/* Dynamic Session Display */}
        {sessionInfoRenderer ? (
          sessionInfoRenderer(session)
        ) : session ? (
          <DefaultSessionInfo session={session} />
        ) : null}

        {/* Mobile: Horizontal smooth scroll | Desktop: Vertical stack */}
        <nav
          className="mt-5 flex gap-2 overflow-x-auto pb-2 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mt-8 md:flex-col md:overflow-visible md:pb-0"
          aria-label="Sidebar navigation"
        >
          {navLinks.map(({ href, label, exact }) => {
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

        {/* Sign Out Button (Desktop bottom, mobile right-aligned inline-flex stack equivalent) */}
        {signOutAction && (
          <div className="mt-auto pt-4 md:pt-6">
            <form action={signOutAction}>
              <Button variant="secondary" className="w-full" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        )}
      </div>
    </aside>
  );
}

function DefaultSessionInfo({ session }) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-surface-panel p-4 shadow-sm">
      <p className="line-clamp-1 font-bold text-foreground">
        {session?.user?.name || "Unknown User"}
      </p>
      <p className="line-clamp-1 mt-1 text-xs capitalize text-muted">
        {session?.role?.replace("_", " ") || "Member"}
      </p>
    </div>
  );
}
