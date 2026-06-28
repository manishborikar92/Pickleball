"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { VENUE } from "@/config/venue.config";
import { Card, Loader } from "@/components/shared";
import { Button } from "@/components/shared";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { getPaymentStatusAction } from "@/app/(booking)/venues/[slug]/book/actions";

const MAX_POLLS = 5;
const POLL_INTERVAL_MS = 5_000;

function PendingContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";

  const [status, setStatus] = useState(() => orderId ? "polling" : "timeout"); // polling | completed | failed | timeout
  const [pollCount, setPollCount] = useState(0);

  const checkStatus = useCallback(async () => {
    if (!orderId) {
      return;
    }

    try {
      const res = await getPaymentStatusAction(orderId);

      if (!res.success) {
        return; // Keep polling on errors.
      }

      const paymentStatus = res.data?.payment_status;

      if (paymentStatus === "success") {
        setStatus("completed");
      } else if (paymentStatus === "failed") {
        setStatus("failed");
      }
      // "initiated" or other — keep polling.
    } catch {
      // Network error — keep polling.
    }
  }, [orderId]);

  useEffect(() => {
    if (status !== "polling") return;

    // First poll fires immediately (pollCount === 0), subsequent polls are delayed
    const delay = pollCount === 0 ? 0 : POLL_INTERVAL_MS;

    const timer = setTimeout(() => {
      if (pollCount >= MAX_POLLS) {
        setStatus("timeout");
      } else {
        checkStatus();
        setPollCount((c) => c + 1);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [status, pollCount, checkStatus]);

  if (status === "completed") {
    return (
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Payment Successful!</h1>
        <p className="mb-6 text-muted">
          Your booking has been confirmed. You will receive a confirmation shortly.
        </p>
        <Button href={`/booking/confirmed?orderId=${orderId}`} variant="primary">
          View Booking Details
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Card>
    );
  }

  if (status === "failed") {
    return (
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
          <XCircle className="h-10 w-10 text-red-400" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Payment Failed</h1>
        <p className="mb-6 text-muted">
          Your payment could not be processed. No amount has been deducted.
        </p>
        <Button href={`/venues/${VENUE.slug}/book`} variant="primary">
          Try Again
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Card>
    );
  }

  if (status === "timeout") {
    return (
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/10">
          <Loader2 className="h-10 w-10 text-amber-400" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Still Processing</h1>
        <p className="mb-6 text-muted">
          We&apos;re still processing your payment. You will receive a confirmation once
          it&apos;s done. This may take a few minutes.
        </p>
        {orderId && (
          <p className="mb-6 text-sm text-muted">
            Order ID: <span className="font-mono text-foreground">{orderId}</span>
          </p>
        )}
        <Button href="/dashboard/bookings" variant="secondary">
          Check My Bookings
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </Card>
    );
  }

  // Polling state
  return (
    <Card className="w-full max-w-lg p-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
        <Loader2 className="h-10 w-10 animate-spin text-accent" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">Processing Payment</h1>
      <p className="mb-4 text-muted">
        Please wait while we verify your payment with PhonePe. This usually takes a few seconds.
      </p>
      {orderId && (
        <p className="text-sm text-muted">
          Order ID: <span className="font-mono text-foreground">{orderId}</span>
        </p>
      )}
    </Card>
  );
}

export default function BookingPendingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-16 sm:py-24">
        <Suspense fallback={<Loader variant="spinner" />}>
          <PendingContent />
        </Suspense>
      </main>
    </div>
  );
}
