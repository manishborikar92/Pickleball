import Link from "next/link";
import { Header, Footer } from "@/components/layout";
import { Button, Card } from "@/components/shared";
import { Map } from "@/components/shared/Map";
import { venue } from "@/data/platform";
import { 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Clock, 
  CreditCard, 
  Ticket, 
  ShieldAlert, 
  ArrowRight, 
  ExternalLink,
  Phone,
  Mail,
  Activity,
  Sparkles
} from "lucide-react";

export const metadata = {
  title: "Booking Confirmed",
  description: "Your court booking at Baseline Arena has been successfully reserved. View booking details, location map, and player guidelines.",
};

// Helper to format date strings nicely
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default async function BookingConfirmedPage(props) {
  const searchParams = await props.searchParams;
  
  // Extract details from searchParams, falling back to mock defaults
  const bookingId = searchParams.bookingId || "BK-2041";
  const courtName = searchParams.court || "Court 1";
  const rawDate = searchParams.date || "2026-05-24";
  const timeSlot = searchParams.time || "18:00 - 19:00";
  const amount = searchParams.amount || "767";

  const formattedDate = formatDate(rawDate);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Success Banner Hero */}
        <section className="relative border-b border-line bg-surface/30 px-4 py-12 text-center sm:px-6 sm:py-16 lg:px-8">
          {/* Glowing backdrop circle */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/15 blur-[90px]" />
          </div>

          <div className="mx-auto max-w-3xl flex flex-col items-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent ring-8 ring-accent/5">
              <CheckCircle2 className="h-8 w-8 animate-pulse" />
            </div>
            <h1 className="mt-4 text-balance text-3xl font-black tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              You are booked!
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-balance text-xs leading-relaxed text-muted sm:text-sm">
              Your slots are officially locked and reserved. A confirmation receipt, invoice details, and safety rules have been sent directly to your phone via WhatsApp.
            </p>
          </div>
        </section>

        {/* Content Layout Grid */}
        <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
            
            {/* Left Column: Transaction Details & Guidelines (7 cols) */}
            <div className="space-y-6 lg:col-span-7">
              
              {/* Detailed Summary Card - Styled like a premium ticket */}
              <Card className="overflow-hidden border-t-4 border-t-accent p-6 sm:p-8">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <h2 className="text-lg font-black text-foreground sm:text-xl flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-accent" />
                    <span>Receipt</span>
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                    <Sparkles className="h-3 w-3" />
                    <span>Confirmed</span>
                  </span>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-soft/30 p-4">
                    <Ticket className="h-5 w-5 shrink-0 text-muted mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Booking Reference</span>
                      <p className="text-sm font-black text-foreground mt-0.5">{bookingId}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-soft/30 p-4">
                    <Activity className="h-5 w-5 shrink-0 text-muted mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Facility / Court</span>
                      <p className="text-sm font-black text-foreground mt-0.5">{courtName} · Besa, Nagpur</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-soft/30 p-4">
                    <Calendar className="h-5 w-5 shrink-0 text-muted mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Reservation Date</span>
                      <p className="text-sm font-black text-foreground mt-0.5">{formattedDate}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-soft/30 p-4">
                    <Clock className="h-5 w-5 shrink-0 text-muted mt-0.5" />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Reserved Time</span>
                      <p className="text-sm font-black text-foreground mt-0.5">{timeSlot}</p>
                    </div>
                  </div>
                </div>

                {/* Amount details row */}
                <div className="mt-6 flex items-center justify-between rounded-xl border border-line/70 bg-surface-panel p-4">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-accent" />
                    <span className="text-xs font-semibold text-muted sm:text-sm">Payment Mode (UPI)</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-foreground sm:text-base">
                      ₹{amount}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Player Rules / Guidelines Card */}
              <div className="rounded-2xl border border-line bg-surface/30 p-6">
                <h3 className="text-base font-black text-foreground flex items-center gap-2 text-accent">
                  <ShieldAlert className="h-5 w-5" />
                  <span>Important Player Rules</span>
                </h3>
                
                <ul className="mt-4 space-y-4 text-xs sm:text-sm leading-relaxed">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10 text-accent font-bold text-[10px]">
                      1
                    </div>
                    <p>
                      <strong>Footwear:</strong> All players must wear appropriate athletic, <strong>non-marking sports shoes</strong> on the Pro Cushion courts. Sandals, flat casual shoes, or heels are strictly prohibited inside the playing arena.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10 text-accent font-bold text-[10px]">
                      2
                    </div>
                    <p>
                      <strong>Arrival Time:</strong> Please arrive <strong>10–15 minutes before</strong> your booking time slot. This allows for quick verification at the front desk and setup.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10 text-accent font-bold text-[10px]">
                      3
                    </div>
                    <p>
                      <strong>Equipment:</strong> Premium paddles and balls are provided <strong>free of charge</strong> at the front desk. Please handle them with care and return them after play.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10 text-accent font-bold text-[10px]">
                      4
                    </div>
                    <p>
                      <strong>Cancellation Policy:</strong> As per our refund policy, player-initiated cancellations are <strong>100% non-refundable</strong>.
                    </p>
                  </li>
                </ul>
              </div>

              {/* Navigation Action Buttons */}
              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <Button href="/dashboard/bookings" className="w-full justify-center shadow-md active:scale-[0.98] transition-transform duration-200">
                  <span>Go to My Bookings</span>
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <Button href="/venues/besa-nagpur/book" variant="secondary" className="w-full justify-center active:scale-[0.98] transition-transform duration-200">
                  Book Another Slot
                </Button>
              </div>

            </div>

            {/* Right Column: Interactive Map at Top, followed by Details (5 cols) */}
            <div className="space-y-6 lg:col-span-5">
              
              <Card className="overflow-hidden p-0">
                {/* Map first - Sits flush at the top of the card */}
                <div className="relative aspect-video w-full border-b border-line bg-surface-soft">
                  <Map
                    lat={venue.location.lat}
                    lng={venue.location.lng}
                    name={venue.name}
                    address={venue.address}
                  />
                </div>

                {/* Card Details Body */}
                <div className="p-6 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-accent shrink-0" />
                        <span>{venue.brandName}</span>
                      </h2>
                      <p className="text-xs text-muted leading-relaxed mt-1.5">{venue.address}</p>
                    </div>
                  </div>

                  {/* Hours and Directions Side-by-side grid */}
                  <div className="grid grid-cols-2 gap-4 border-t border-line/60 pt-4">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Operating Hours</span>
                      <p className="text-xs font-semibold text-foreground mt-1">{venue.hours}</p>
                    </div>
                    <div className="flex flex-col justify-end">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${venue.location.lat},${venue.location.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-panel/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground transition-all hover:bg-surface-panel hover:text-accent"
                      >
                        <span>Directions</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Front Desk Support Details */}
                  <div className="border-t border-line/60 pt-4 space-y-2.5">
                    <p className="text-xs text-muted">
                      Need assistance with your booking? Reach out directly:
                    </p>
                    <div className="flex flex-col gap-2 text-xs sm:text-sm font-semibold">
                      <a href={`tel:${venue.phone.replace(/\s+/g, '')}`} className="flex items-center gap-2 text-muted hover:text-accent transition-colors">
                        <Phone className="h-4 w-4 text-accent shrink-0" />
                        <span>{venue.phone}</span>
                      </a>
                      <a href={`mailto:${venue.email}`} className="flex items-center gap-2 text-muted hover:text-accent transition-colors">
                        <Mail className="h-4 w-4 text-accent shrink-0" />
                        <span>{venue.email}</span>
                      </a>
                    </div>
                  </div>

                </div>
              </Card>

            </div>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
