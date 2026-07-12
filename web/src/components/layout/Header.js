import Link from "next/link";
import Image from "next/image";
import { UserCircle, MapPin } from "lucide-react";
import { Button } from "@/components/shared";
import { VENUE } from "@/config/venue.config";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-6 lg:px-8">
        <BrandLogo />

        {/* Center section remains empty per architectural requirements */}
        <div className="hidden flex-1 md:block" aria-hidden="true" />

        <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4">
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
      className="group flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Go to ${VENUE.brandName} homepage`}
    >
      <div className="flex shrink-0 items-center justify-center transition-transform group-hover:scale-105">
        <Image
          src="/baseline-logo.svg"
          alt={`${VENUE.brandName} Logo`}
          width={40}
          height={40}
          className="h-9 w-9 sm:h-10 sm:w-10 md:h-11 md:w-11"
          priority
        />
      </div>
      
      <div className="flex flex-col justify-center">
        <span
          className="text-[15px] font-extrabold text-foreground sm:text-lg md:text-xl leading-none"
          style={{ fontFamily: "var(--font-montserrat)", letterSpacing: "-0.04em" }}
        >
          Baseline Arena
        </span>
        {/* Location sub-label directly below logo */}
        <div className="mt-0.5 flex items-center gap-0.5 text-[6px] font-extrabold uppercase tracking-[0.15em] text-muted-foreground transition-colors group-hover:text-accent sm:text-[8px] leading-none">
          <MapPin className="h-1.5 w-1.5 shrink-0 text-accent/80" />
          <span>{VENUE.name}</span>
        </div>
      </div>
    </Link>
  );
}

function AccountButton() {
  return (
    <Link
      href="/dashboard/overview"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-panel hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-10 sm:w-auto sm:gap-2 sm:px-4"
      aria-label="Go to Account Dashboard"
    >
      <UserCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="hidden text-sm font-semibold sm:inline lg:text-base">Account</span>
    </Link>
  );
}

function CTA() {
  return (
    <Button
      href="/venues/besa-nagpur/book"
      className="h-9 px-3 text-sm font-semibold shadow-sm transition-transform active:scale-95 sm:h-10 sm:px-5 lg:text-base"
    >
      <span className="hidden sm:inline">Book Court</span>
      <span className="sm:hidden">Book</span>
    </Button>
  );
}