import Link from "next/link";

import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card, SectionHeader } from "@/components/shared/Card";
import { reviews, venue } from "@/data/platform";

const facilityStandards = [
  ["PS", "Pro Surface", "Tour-grade cushioning and grip for competitive play and injury prevention."],
  ["CC", "Climate Control", "Consistent indoor conditions across summer, monsoon, and late-night games."],
  ["GE", "Pro Shop", "Paddles, balls, hydration, and staff support available at the venue."],
];

const steps = [
  ["1", "Book", "Pick a court, date, and live slot before authentication interrupts the flow."],
  ["2", "Verify", "Confirm your phone through WhatsApp OTP only when checkout is ready."],
  ["3", "Play", "Pay securely, receive confirmation, and arrive with your slot protected."],
];

export function LandingPage() {
  return (
    <main>
      <section className="court-hero flex min-h-[calc(100svh-4rem)] items-end px-6 pb-10 pt-24">
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-2xl">
            <Badge tone="neutral" className="mb-5 gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" /> LIVE NOW
            </Badge>
            <h1 className="text-5xl font-black leading-[0.95] text-white sm:text-7xl">
              The Future of <span className="text-accent">Pickleball</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
              Experience courts tuned for competitive play. Browse live slots,
              verify only when ready, and book Besa, Nagpur in minutes.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button href="/venues/besa-nagpur/book" className="w-full sm:w-auto">
                Book Court
              </Button>
              <Button href="/dashboard" variant="secondary" className="w-full sm:w-auto">
                My Bookings
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader title="Elite Facility Standards">
            Engineered for performance, designed for comfort, and ready for
            daily operations at scale.
          </SectionHeader>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {facilityStandards.map(([icon, title, body]) => (
              <Card key={title} className="p-6 text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-3xl text-accent">
                  {icon}
                </div>
                <h3 className="text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionHeader align="left" title="Twin Premium Courts">
              Two identical indoor courts with high-visibility lighting,
              shock-absorption flooring, accessible play, and a booking model
              designed to prevent double holds.
            </SectionHeader>
            <div className="mt-6 flex flex-wrap gap-2">
              {["Indoor", "Singles/Doubles", "Climate Controlled", "No-Refund Waiver"].map((item) => (
                <Badge key={item}>{item}</Badge>
              ))}
            </div>
          </div>
          <Card className="overflow-hidden">
            <div className="h-72 bg-[linear-gradient(135deg,#1d2411,#090b03_46%,#caff00_47%,#caff00_49%,#151910_50%)]" />
            <div className="p-6">
              <Badge tone="accent">Indoor Premium</Badge>
              <p className="mt-4 text-sm leading-6 text-muted">
                Venue-scoped data, court status, schedules, pricing rules, and
                reviews all map back to {venue.name} for multi-location growth.
              </p>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-t border-line bg-surface px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader title="Seamless Experience">
            Browse first, authenticate later, and keep each booking protected
            with a timed hold.
          </SectionHeader>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {steps.map(([number, title, body]) => (
              <div key={title} className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-accent text-2xl font-black text-accent">
                  {number}
                </div>
                <h3 className="mt-5 text-xl font-black">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <SectionHeader title="Player Reviews">
            Published reviews build trust while admin suppression remains
            available for moderation.
          </SectionHeader>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <Card key={review.id} className="p-6">
                <p className="text-accent">{review.rating}/5 stars</p>
                <p className="mt-4 text-sm leading-6 text-muted">&ldquo;{review.quote}&rdquo;</p>
                <p className="mt-5 text-sm font-bold">
                  {review.name} <span className="text-muted">- {review.label}</span>
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-surface px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2">
          <Card className="min-h-72 overflow-hidden">
            <div className="h-full min-h-72 bg-[repeating-linear-gradient(135deg,rgba(202,255,0,0.16)_0_2px,transparent_2px_18px),linear-gradient(135deg,#10272d,#101408)]" />
          </Card>
          <div className="flex flex-col justify-center">
            <SectionHeader align="left" title="Find Us">
              {venue.address}
            </SectionHeader>
            <dl className="mt-6 grid gap-4 text-muted">
              <div><dt className="font-bold text-foreground">Hours</dt><dd>{venue.hours}</dd></div>
              <div><dt className="font-bold text-foreground">Contact</dt><dd>{venue.email}<br />{venue.phone}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section className="border-t border-line px-6 py-16">
        <div className="mx-auto max-w-3xl">
          <SectionHeader title="Common Questions" />
          <div className="mt-8 grid gap-3">
            {[
              ["Do I need my own equipment?", "Bring your own paddle if you prefer. Rental paddles and balls are available on-site."],
              ["How far ahead can I book?", "The venue opens slots for the configured advance booking window after the daily rollover time."],
              ["What is the cancellation policy?", "Confirmed bookings are non-refundable. Business-initiated cancellations are handled with wallet credits."],
            ].map(([question, answer]) => (
              <details key={question} className="rounded-lg border border-line bg-surface-panel p-5">
                <summary className="cursor-pointer font-bold">{question}</summary>
                <p className="mt-3 text-sm leading-6 text-muted">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-surface px-6 py-10 text-center text-sm text-muted">
        <Link href="/" className="text-lg font-black text-accent">{venue.brandName}</Link>
        <p className="mt-3">Elevating the pickleball experience through technology and premium facilities.</p>
      </footer>
    </main>
  );
}
