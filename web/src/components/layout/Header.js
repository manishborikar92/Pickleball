import Link from "next/link";
import { MapPin, UserCircle } from "lucide-react";
import { Button } from "@/components/shared";
import { venue } from "@/data/platform";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLogo />
        
        {/* Center section remains empty per architectural requirements */}
        <div className="hidden flex-1 md:block" aria-hidden="true" />
        
        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
          <CTA />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}

function BrandLogo() {
  return (
    <Link
      href="/"
      className="group flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Go to ${venue.name} homepage`}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20 sm:h-9 sm:w-9">
        <MapPin className="h-5 w-5 sm:h-5 sm:w-5" aria-hidden="true" />
      </div>
      <span className="truncate whitespace-nowrap text-lg font-black text-foreground sm:text-xl">
        {venue.name}
      </span>
    </Link>
  );
}

function AccountButton() {
  return (
    <Link
      href="/dashboard"
      className="flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-muted transition-colors hover:bg-surface-panel hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4 sm:text-base"
      aria-label="Go to Account Dashboard"
    >
      <UserCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline">Account</span>
    </Link>
  );
}

function CTA() {
  return (
    <Button
      href="/venues/besa-nagpur/book"
      className="h-10 px-4 text-sm font-semibold shadow-sm transition-transform active:scale-95 sm:px-5 sm:text-base"
    >
      <span className="hidden sm:inline">Book Court</span>
      <span className="sm:hidden">Book</span>
    </Button>
  );
}