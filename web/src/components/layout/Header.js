import Link from "next/link";
import Image from "next/image";
import { UserCircle, MapPin } from "lucide-react";
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
      className="group flex flex-col justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Go to ${venue.brandName} homepage`}
    >
      <div className="flex shrink-0 items-center justify-start transition-transform group-hover:scale-[1.01]">
        <Image
          src="/baseline-full-logo.svg"
          alt={`${venue.brandName} Full Logo`}
          width={150}
          height={40}
          className="h-7 w-auto sm:h-8 md:h-9"
          priority
        />
      </div>
      
      {/* Location sub-label directly below logo */}
      <div className="mt-0.5 flex items-center gap-1 pl-0.5 text-[7px] font-extrabold uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-accent sm:text-[8px]">
        <MapPin className="h-2 w-2 shrink-0 text-accent/80 sm:h-2.5 sm:w-2.5" />
        <span>{venue.name}</span>
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