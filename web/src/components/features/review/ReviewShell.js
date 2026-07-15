import Link from "next/link";
import { ArrowLeft, UserCircle } from "lucide-react";

/**
 * Shared chrome for every review-page state (form, submitted, gates, errors) so
 * the page reads as one surface regardless of which view resolves. Pure
 * presentational — server-renderable, safely importable from client components.
 */

export function ReviewShell({ children }) {
  return (
    <main className="min-h-screen bg-background pb-8 md:pb-12">
      <ReviewHeader />
      {children}
    </main>
  );
}

function ReviewHeader() {
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
          Leave a Review
        </h1>
        <Link
          href="/dashboard/overview"
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

/**
 * Hero banner with the ACTUAL session context (courts, venue, date, time) from
 * the booking — replaces the placeholder copy that previously shipped here.
 *
 * @param {Object} props
 * @param {Object} props.booking - Normalized booking detail.
 */
export function ReviewSessionBanner({ booking }) {
  const courtLabel = booking?.courtNames?.length ? booking.courtNames.join(", ") : "Court";
  const venueLabel = booking?.venue?.brandName || booking?.venueName || "";
  const sessionTime = booking?.sessionStartTime && booking?.sessionEndTime
    ? `${booking.sessionStartTime} – ${booking.sessionEndTime}`
    : "";
  const sessionLine = [formatSessionDate(booking?.slotDate), sessionTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="relative mx-auto h-44 w-full max-w-5xl overflow-hidden bg-[url('/court-3.png')] bg-cover bg-center sm:h-56 md:h-64 lg:rounded-b-2xl">
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute bottom-0 left-0 flex w-full flex-col p-4 sm:p-6 md:p-8">
        <h2 className="text-2xl font-black leading-tight sm:text-3xl md:text-4xl">
          Thank you for playing!
        </h2>
        <p className="mt-1 text-sm text-muted sm:mt-2 sm:text-base md:text-lg">
          {[courtLabel, venueLabel].filter(Boolean).join(" — ")}
        </p>
        {sessionLine && (
          <p className="mt-1 text-xs font-semibold text-muted/80 sm:text-sm">
            {sessionLine}
          </p>
        )}
      </div>
    </section>
  );
}

/** "Sunday, 13 Jul 2026" — same locale/format family as the booking receipt. */
export function formatSessionDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
