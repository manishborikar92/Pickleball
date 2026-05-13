import Link from "next/link";
import { ArrowLeft, UserCircle } from "lucide-react";

export function BookingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-bold text-muted transition-colors hover:text-accent"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <h1 className="text-lg font-black text-foreground sm:text-xl">
          Checkout
        </h1>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-sm font-bold text-muted transition-colors hover:text-accent"
          aria-label="Go to account"
        >
          <UserCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Account</span>
        </Link>
      </div>
    </header>
  );
}