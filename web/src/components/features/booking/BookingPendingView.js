"use client";

import { useRouter } from "next/navigation";
import { useBookingStatusPoll } from "@/hooks/useBookingStatusPoll";
import { Card } from "@/components/shared";
import { Button } from "@/components/shared";
import { Loader2, ArrowRight } from "lucide-react";
import { VENUE } from "@/config/venue.config";
import { getLatestPayment } from "@/lib/bookingEngine";

/**
 * Client Component view for pending payment processing states.
 * Uses useBookingStatusPoll to monitor payment resolution.
 *
 * @param {Object} props
 * @param {string} props.bookingId - Booking UUID.
 * @param {Object} props.booking - Normalized booking payload.
 */
export function BookingPendingView({ bookingId, booking }) {
  const router = useRouter();

  const handleComplete = (finalStatus) => {
    // Force Next.js App Router server action cache refresh
    router.refresh();
  };

  const { status, error } = useBookingStatusPoll({
    bookingId,
    initialStatus: booking?.status || "pending_payment",
    onComplete: handleComplete,
  });

  const venueSlug = booking?.venue?.slug || VENUE.slug;
  const merchantOrderId = getLatestPayment(booking)?.merchantOrderId || "";

  // Render Timeout or Expiration errors resolved locally during polling
  if (status === "expired" || error) {
    return (
      <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
        <Card className="w-full max-w-lg p-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
            <Loader2 className="h-10 w-10 text-amber-400" />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-foreground">Still Processing</h1>
          <p className="mb-6 text-muted text-sm leading-relaxed">
            {error || "We're still verifying your payment status. If you completed the transaction, it will be confirmed automatically shortly."}
          </p>
          {merchantOrderId && (
            <p className="mb-6 text-sm text-muted">
              Order ID: <span className="font-mono text-foreground">{merchantOrderId}</span>
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button href="/dashboard/bookings" variant="primary">
              Check My Bookings
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button href={`/venues/${venueSlug}/book`} variant="secondary">
              Go to Calendar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Active Polling state
  return (
    <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
          <Loader2 className="h-10 w-10 animate-spin text-accent" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Processing Payment</h1>
        <p className="mb-4 text-muted text-sm leading-relaxed">
          Please wait while we verify your transaction status. This usually takes a few seconds.
        </p>
        {merchantOrderId && (
          <p className="text-xs text-muted">
            Order ID: <span className="font-mono text-foreground">{merchantOrderId}</span>
          </p>
        )}
      </Card>
    </div>
  );
}
