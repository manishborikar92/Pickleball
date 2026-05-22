import Link from "next/link";
import Image from "next/image";
import { UserCircle } from "lucide-react";
import { Button } from "@/components/shared";
import { venue } from "@/data/platform";

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
      className="group flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-3"
      aria-label={`Go to ${venue.brandName} homepage`}
    >
      <div className="flex shrink-0 items-center justify-center transition-transform group-hover:scale-105">
        <Image
          src="/baseline-logo.svg"
          alt={`${venue.brandName} Logo`}
          width={64}
          height={64}
          className="h-12 w-12 sm:h-14 sm:w-14"
        />
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-0.5">
        <span className="truncate text-base font-black leading-none text-foreground sm:text-lg lg:text-xl">
          {venue.brandName}
        </span>
        <span className="truncate text-[9px] font-bold uppercase leading-none tracking-wide text-muted-foreground sm:text-[10px] sm:tracking-wider">
          {venue.name}
        </span>
      </div>
    </Link>
  );
}

function AccountButton() {
  return (
    <Link
      href="/interest"
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
      href="/interest"
      className="h-9 px-3 text-sm font-semibold shadow-sm transition-transform active:scale-95 sm:h-10 sm:px-5 lg:text-base"
    >
      <span className="hidden sm:inline">Book Court</span>
      <span className="sm:hidden">Book</span>
    </Button>
  );
}