"use client";

import { useState } from "react";
import { Button, Card } from "@/components/shared";
import { XCircle, RefreshCw, ArrowRight, Loader2 } from "lucide-react";
import { initiateBookingPaymentAction } from "@/app/(booking)/venues/[slug]/book/actions";
import { getLatestPayment } from "@/lib/bookingEngine";

/**
 * Presentational + interactive view for a failed payment attempt.
 *
 * The booking remains in `pending_payment` after a failed gateway payment, so its
 * slot hold is still valid within the TTL. "Try Again" therefore re-initiates a new
 * payment on the *same* booking rather than re-creating a hold on already-held slots
 * (which would self-conflict against the `booking_slots_no_double_book` index).
 *
 * @param {Object} props
 * @param {Object} props.booking - Normalized booking context (status: pending_payment).
 */
export function BookingFailedView({ booking }) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState("");

  const bookingId = booking?.id;
  // Show the most recent payment's order id (the failed attempt), matching the
  // latest-payment rule the resolver used to classify this booking as failed.
  const merchantOrderId = getLatestPayment(booking)?.merchantOrderId || "";

  async function handleRetry() {
    if (!bookingId) return;
    setRetrying(true);
    setError("");
    try {
      const res = await initiateBookingPaymentAction(bookingId, { useWalletCredits: true });
      if (!res.success) {
        setError(res.error || "Could not restart the payment. Please try again.");
        setRetrying(false);
        return;
      }

      const payment = res.data;

      // Credits now cover the full amount — booking confirmed, no gateway needed.
      if (payment.type === "wallet_only") {
        window.location.assign(`/booking/${bookingId}`);
        return;
      }

      // Gateway payment — full-page redirect to the provider checkout.
      if (payment.redirect_url) {
        window.location.assign(payment.redirect_url);
        return;
      }

      setError("Payment could not be initiated. Please try again.");
      setRetrying(false);
    } catch (err) {
      setError(err.message || "Could not restart the payment. Please try again.");
      setRetrying(false);
    }
  }

  return (
    <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
          <XCircle className="h-10 w-10 text-red-400" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-foreground">Payment Failed</h1>

        <p className="mb-6 text-muted">
          Your payment could not be processed and no amount has been deducted. Your slots are
          still held — you can retry the payment before the hold expires.
        </p>

        {merchantOrderId && (
          <p className="mb-6 text-sm text-muted">
            Order ID: <span className="font-mono text-foreground">{merchantOrderId}</span>
          </p>
        )}

        {error && (
          <p className="mb-6 rounded border border-line bg-surface-soft/40 p-3 text-xs text-red-400/80 select-all">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button variant="primary" onClick={handleRetry} disabled={retrying}>
            {retrying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Restarting…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </>
            )}
          </Button>

          <Button href="/support" variant="secondary" disabled={retrying}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Contact Support
          </Button>
        </div>
      </Card>
    </div>
  );
}
