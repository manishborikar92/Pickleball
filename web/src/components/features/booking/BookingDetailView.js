import { Card, Button } from "@/components/shared";
import { Map } from "@/components/shared/Map";
import {
  Calendar,
  Clock,
  CreditCard,
  Ticket,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Phone,
  Mail,
  MapPin
} from "lucide-react";

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

/**
 * Presentational view for successfully confirmed bookings.
 * Renders ticket receipt details, contact guidelines, and interactive maps.
 *
 * @param {Object} props
 * @param {Object} props.booking - Normalized booking details.
 * @param {Object} props.receipt - Normalized payment receipt details.
 */
export function BookingDetailView({ booking, receipt }) {
  const { venue } = booking;
  const courtName = booking.courtNames?.join(", ") || "Court";
  const timeSlot = `${booking.sessionStartTime} - ${booking.sessionEndTime}`;

  return (
    <section className="w-full max-w-7xl px-4 py-8 sm:py-12 sm:px-6">
      {/* Visual Success Accent Banner */}
      <div className="mb-8 flex flex-col items-center text-center sm:mb-12 py-4">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent ring-8 ring-accent/5">
          <Ticket className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-4xl">
          Booking Confirmed!
        </h1>
        <p className="mt-2 text-xs text-muted sm:text-sm max-w-md">
          Your court has been reserved. A confirmation has been sent to your registered account.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Receipt and Guidelines (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <Card className="p-6 border border-line border-t-4 border-t-accent">
            <h2 className="text-base font-black text-foreground uppercase tracking-wider border-b border-line pb-3">
              Booking Receipt
            </h2>

            {/* Main Receipt Details Fields */}
            <div className="mt-4 space-y-4">
              <div className="flex items-start justify-between border-b border-line/40 pb-3">
                <span className="text-xs font-semibold text-muted sm:text-sm">Booking ID</span>
                <span className="text-xs font-mono text-foreground select-all break-all text-right max-w-[200px] sm:max-w-xs">
                  {booking.id}
                </span>
              </div>

              <div className="flex items-start justify-between border-b border-line/40 pb-3">
                <span className="text-xs font-semibold text-muted sm:text-sm">Courts</span>
                <span className="text-xs font-bold text-foreground text-right">{courtName}</span>
              </div>

              <div className="flex items-start justify-between border-b border-line/40 pb-3">
                <span className="text-xs font-semibold text-muted sm:text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  <span>Date</span>
                </span>
                <span className="text-xs font-bold text-foreground text-right">{formatDate(booking.slotDate)}</span>
              </div>

              <div className="flex items-start justify-between border-b border-line/40 pb-3">
                <span className="text-xs font-semibold text-muted sm:text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" />
                  <span>Time Slot</span>
                </span>
                <span className="text-xs font-bold text-foreground text-right">{timeSlot}</span>
              </div>

              {receipt && (
                <div className="bg-surface-soft/40 p-4 rounded-xl space-y-2 text-xs sm:text-sm">
                  {receipt.creditsApplied > 0 && (
                    <div className="flex items-center justify-between text-muted">
                      <span>Subtotal</span>
                      <span>₹{receipt.totalAmount}</span>
                    </div>
                  )}
                  {receipt.creditsApplied > 0 && (
                    <div className="flex items-center justify-between text-muted">
                      <span>Wallet Credits Applied</span>
                      <span className="font-semibold text-emerald-400">-₹{receipt.creditsApplied}</span>
                    </div>
                  )}
                  {receipt.taxAmount > 0 && (
                    <div className="flex items-center justify-between text-muted border-b border-line/40 pb-2 mb-2">
                      <span>Goods & Services Tax</span>
                      <span className="font-semibold">₹{receipt.taxAmount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-accent" />
                      <span className="text-xs font-bold text-muted sm:text-sm">
                        {receipt.paymentModeLabel}
                      </span>
                    </div>
                    <span className="text-sm font-black text-foreground sm:text-base">
                      ₹{receipt.displayAmount}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Player Rules / Guidelines Card */}
          <div className="rounded-2xl border border-line bg-surface/35 p-6">
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
                  <strong>Footwear:</strong> All players must wear appropriate athletic, <strong>non-marking sports shoes</strong> on the Cushion courts. Sandals, flat casual shoes, or heels are strictly prohibited inside the playing arena.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent/10 text-accent font-bold text-[10px]">
                  2
                </div>
                <p>
                  <strong>Arrival Time:</strong> Please arrive <strong>10–15 minutes before</strong> your booking time slot for front desk verification.
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
                  <strong>Cancellation Policy:</strong> Player-initiated cancellations are <strong>100% non-refundable</strong>.
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
            <Button href={`/venues/${venue.slug}/book`} variant="secondary" className="w-full justify-center active:scale-[0.98] transition-transform duration-200">
              Book Another Slot
            </Button>
          </div>
        </div>

        {/* Right Column: Interactive Map (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="overflow-hidden p-0">
            {/* Map wrapper */}
            <div className="relative aspect-video w-full border-b border-line bg-surface-soft">
              <Map
                lat={venue.location.lat}
                lng={venue.location.lng}
                name={venue.name}
                address={venue.address}
              />
            </div>

            {/* Address & support details */}
            <div className="p-6 space-y-5">
              <div>
                <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-accent shrink-0" />
                  <span>{venue.brandName || venue.name}</span>
                </h2>
                <p className="text-xs text-muted leading-relaxed mt-1.5">{venue.address}</p>
              </div>

              {/* Hours and Directions */}
              <div className="grid grid-cols-2 gap-4 border-t border-line/60 pt-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Operating Hours</span>
                  <p className="text-xs font-semibold text-foreground mt-1">{venue.hours}</p>
                </div>
                <div className="flex flex-col justify-end">
                  <a
                    href={venue.googleMapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-panel/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-foreground transition-all hover:bg-surface-panel hover:text-accent"
                  >
                    <span>Directions</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>

              {/* Contact Front Desk Support */}
              <div className="border-t border-line/60 pt-4 space-y-2.5">
                <p className="text-xs text-muted">Need assistance with your booking? Reach out directly:</p>
                <div className="flex flex-col gap-2 text-xs sm:text-sm font-semibold">
                  <a href={`tel:${venue.phone.replace(/\D/g, '')}`} className="flex items-center gap-2 text-muted hover:text-accent transition-colors">
                    <Phone className="h-4 w-4 text-accent shrink-0" />
                    <span>{venue.phone}</span>
                  </a>
                  {venue.secondaryPhone && (
                    <a href={`tel:${venue.secondaryPhone.replace(/\D/g, '')}`} className="flex items-center gap-2 text-muted hover:text-accent transition-colors">
                      <Phone className="h-4 w-4 text-accent shrink-0" />
                      <span>{venue.secondaryPhone}</span>
                    </a>
                  )}
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
  );
}
