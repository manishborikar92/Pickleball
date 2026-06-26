"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Info, HelpCircle, FileText, Shield } from "lucide-react";

const NAV_ITEMS = [
  { href: "/about", label: "About Us", Icon: Info },
  { href: "/support", label: "Help & Support", Icon: HelpCircle },
  { href: "/terms", label: "Terms & Conditions", Icon: FileText },
  { href: "/privacy", label: "Privacy Policy", Icon: Shield },
];

/**
 * InfoPageSidebar Component
 * 
 * NOTE: The usePathname() hook is isolated here inside a dedicated Client Component
 * boundary. This allows the surrounding InfoPageLayout and the static page contents
 * of /about, /support, /privacy, and /terms to remain fully Static Site Generated (SSG)
 * rather than being de-optimized to client-rendered layouts.
 */
export function InfoPageSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar md:flex-col md:gap-2 md:overflow-visible md:pb-0">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent
              ${
                isActive
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-line bg-surface-panel/40 text-muted hover:border-line/85 hover:bg-surface-panel hover:text-foreground"
              } md:w-full md:shrink md:normal-case md:tracking-normal md:py-3 md:text-sm md:font-semibold`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
