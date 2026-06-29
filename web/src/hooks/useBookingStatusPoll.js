import { useState, useEffect, useRef } from "react";
import { getBookingById } from "../lib/api.js";
import { getLatestPayment } from "../lib/bookingEngine.js";

/**
 * Client-side hook to poll for the booking status.
 * Polling is active only while the status remains "pending_payment".
 * Once resolved, it triggers the callback to refresh the page.
 *
 * @param {Object}   params
 * @param {string}   params.bookingId - Booking UUID.
 * @param {string}   params.initialStatus - Initial database booking status.
 * @param {Function} params.onComplete - Callback executed when the status transitions from "pending_payment".
 * @param {number}   [params.intervalMs=4000] - Polling interval.
 * @param {number}   [params.maxPolls=15] - Maximum number of polls before timeout.
 */
export function useBookingStatusPoll({
  bookingId,
  initialStatus,
  onComplete,
  intervalMs = 4000,
  maxPolls = 15,
}) {
  const [status, setStatus] = useState(initialStatus);
  const pollCountRef = useRef(0);
  const [error, setError] = useState(null);
  
  // Track onComplete via ref to prevent effect resets if function identity changes
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (status !== "pending_payment") {
      return;
    }

    const intervalId = setInterval(async () => {
      if (pollCountRef.current >= maxPolls) {
        clearInterval(intervalId);
        setStatus("expired");
        setError("Payment verification timed out. If you have completed the payment, it will reflect on your dashboard shortly.");
        if (onCompleteRef.current) onCompleteRef.current("expired");
        return;
      }

      try {
        const booking = await getBookingById(bookingId);
        pollCountRef.current += 1;

        // Resolve when the booking leaves pending_payment, OR when the booking is
        // still pending but its latest payment has failed (a failure keeps the
        // booking in pending_payment, so status alone never signals it). In both
        // cases the parent refreshes so the server resolver can render the right view.
        const paymentFailed = getLatestPayment(booking)?.status === "failed";

        if (booking && (booking.status !== "pending_payment" || paymentFailed)) {
          clearInterval(intervalId);
          setStatus(booking.status);
          if (onCompleteRef.current) onCompleteRef.current(booking.status);
        }
      } catch (err) {
        // Log and swallow error, continue polling in case of transient API connectivity issues
        console.error("[useBookingStatusPoll] Poll failed:", err);
      }
    }, intervalMs);

    return () => clearInterval(intervalId);
  }, [bookingId, status, intervalMs, maxPolls]);

  return { status, error };
}
