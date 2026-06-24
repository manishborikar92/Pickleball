"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/shared";
import { Button } from "@/components/shared";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { getPaymentStatusAction } from "@/app/actions/booking-actions";

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

    const timer = setTimeout(() => {
      if (pollCount >= MAX_POLLS) {
        setStatus("timeout");
      } else {
        checkStatus();
        setPollCount((c) => c + 1);
      }
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [status, pollCount, checkStatus]);

  // Initial check on mount.
  useEffect(() => {
    if (orderId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      checkStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "completed") {
    return (
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-400" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Payment Successful!</h1>
        <p className="mb-6 text-muted-foreground">
          Your booking has been confirmed. You will receive a confirmation shortly.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href={`/booking/confirmed?orderId=${orderId}`}>
            View Booking Details
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
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
        <p className="mb-6 text-muted-foreground">
          Your payment could not be processed. No amount has been deducted.
        </p>
        <Button asChild variant="primary" size="lg">
          <Link href="/venues/besa-nagpur">
            Try Again
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
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
        <p className="mb-6 text-muted-foreground">
          We&apos;re still processing your payment. You will receive a confirmation once
          it&apos;s done. This may take a few minutes.
        </p>
        {orderId && (
          <p className="mb-6 text-sm text-muted-foreground">
            Order ID: <span className="font-mono text-foreground">{orderId}</span>
          </p>
        )}
        <Button asChild variant="outline" size="lg">
          <Link href="/my-bookings">
            Check My Bookings
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </Card>
    );
  }

  // Polling state
  return (
    <Card className="w-full max-w-lg p-8 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-foreground">Processing Payment</h1>
      <p className="mb-4 text-muted-foreground">
        Please wait while we verify your payment with PhonePe. This usually takes a few seconds.
      </p>
      {orderId && (
        <p className="text-sm text-muted-foreground">
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
        <PendingContent />
      </main>
    </div>
  );
}
