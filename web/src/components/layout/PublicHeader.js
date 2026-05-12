import Link from "next/link";

import { Button } from "@/components/shared/Button";
import { venue } from "@/data/platform";

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/88 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-black text-accent">
          <span aria-hidden="true">Pin</span>
          {venue.name}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted md:flex">
          <Link href="/venues/besa-nagpur/book" className="hover:text-accent">Book</Link>
          <Link href="/dashboard" className="hover:text-accent">My Bookings</Link>
          <Link href="/admin" className="hover:text-accent">Admin</Link>
        </nav>
        <Button href="/venues/besa-nagpur/book" className="hidden md:inline-flex">
          Book Court
        </Button>
        <Link href="/venues/besa-nagpur/book" className="text-2xl text-accent md:hidden" aria-label="Book court">
          Menu
        </Link>
      </div>
    </header>
  );
}
