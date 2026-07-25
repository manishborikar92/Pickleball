"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/shared";
import { verifyPaymentAction } from "@/lib/actions/booking";
import {
  isLikelyMerchantOrderId,
  resolvePaymentRedirectPath,
} from "@/lib/services/paymentRedirect";

/**
 * Presentational card for the payment-verification interstitial. Also used as
 * the page's Suspense fallback so the spinner paints with the static shell —
 * the customer never sees a blank screen between the gateway and their booking.
 *
 * @param {Object} props
 * @param {string} [props.orderId] - Gateway order reference, when known.
 */
export function PaymentRedirectCard({ orderId = "" }) {
  return (
    <div className="flex items-center justify-center px-4 py-16 sm:py-24 w-full" role="status" aria-live="polite">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
          <Loader2 className="h-10 w-10 animate-spin text-accent" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-2xl font-bold text-foreground">Confirming Your Payment</h1>
        <p className="mb-4 text-muted text-sm leading-relaxed">
          We&apos;re securely verifying your transaction with the payment provider.
          This usually takes just a few seconds — please don&apos;t close this window.
        </p>
        <p className="mb-4 flex items-center justify-center gap-1.5 text-xs text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
          Your slots stay reserved while we confirm.
        </p>
        {orderId && (
          <p className="text-xs text-muted">
            Order ID: <span className="font-mono text-foreground">{orderId}</span>
          </p>
        )}
      </Card>
    </div>
  );
}

/**
 * Client view for `/booking/redirect` — the target of PhonePe's
 * `merchantUrls.redirectUrl` (the post-payment browser return).
 *
 * PhonePe shares no transaction status client-side, so this view shows the
 * verification interstitial while a single server-action round trip fetches
 * the authoritative state (gateway Order Status API) and reconciles it on the
 * backend, then replaces the history entry with the resolved destination: the
 * unified `/booking/[bookingId]` page (which renders confirmation, failure +
 * retry, or polling from the ledger) or the whitelisted `/booking/error` page
 * when no booking can be resolved. `router.replace` keeps this transient route
 * out of the back stack, so Back from the booking page returns to the venue —
 * not to a re-verification.
 */
export function PaymentRedirectView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = (searchParams.get("orderId") || "").trim();
  const startedRef = useRef(false);

  useEffect(() => {
    // Run exactly once per mount — Strict Mode re-invokes effects in dev, and
    // a duplicate verification (while idempotent server-side) could race the
    // navigation.
    if (startedRef.current) return;
    startedRef.current = true;

    if (!isLikelyMerchantOrderId(orderId)) {
      router.replace("/booking/error?type=missing_order_id");
      return;
    }

    verifyPaymentAction(orderId)
      .then((result) => {
        window.location.replace(resolvePaymentRedirectPath(result));
      })
      .catch(() => {
        window.location.replace("/booking/error?type=api_failure");
      });
  }, [orderId, router]);

  return <PaymentRedirectCard orderId={isLikelyMerchantOrderId(orderId) ? orderId : ""} />;
}
