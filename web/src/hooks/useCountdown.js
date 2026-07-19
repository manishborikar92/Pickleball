"use client";

import { useEffect, useRef, useState } from "react";

import { getRemainingSeconds } from "@/lib/bookingEngine";

/**
 * useCountdown — live seconds-remaining until an ISO timestamp, with an expiry
 * callback. Drives the 10-minute hold countdown on the checkout modal
 * (03-UI-UX-SPECIFICATION §2.4).
 *
 * The remaining time is derived from the wall clock on every tick — never
 * decremented — so the countdown stays truthful to the server's `expiresAt` even
 * when the browser throttles timers in a background tab: on wake, the very next
 * tick snaps to the real remaining time (or fires expiry immediately).
 *
 * `onExpire` fires at most once per `expiresAt` value; passing a new timestamp
 * re-arms the countdown.
 *
 * @param {string|null} expiresAt - ISO timestamp; null/empty disables the countdown.
 * @param {() => void} [onExpire] - Called once when the countdown reaches zero.
 * @returns {{ remainingSeconds: number, isExpired: boolean }}
 */
export function useCountdown(expiresAt, onExpire) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Keep the callback in a ref so a new inline function each render doesn't
  // restart the interval; the ref is written in an effect, never during render.
  const onExpireRef = useRef(null);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!expiresAt) return undefined;

    let expired = false;
    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      if (getRemainingSeconds(expiresAt, now) <= 0 && !expired) {
        expired = true;
        clearInterval(intervalId);
        onExpireRef.current?.();
      }
    };

    // First tick is a macrotask so the effect body itself never sets state;
    // it also fires expiry immediately for an already-past timestamp.
    const timeoutId = setTimeout(tick, 0);
    const intervalId = setInterval(tick, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [expiresAt]);

  const remainingSeconds = expiresAt ? getRemainingSeconds(expiresAt, nowMs) : 0;

  return {
    remainingSeconds,
    isExpired: Boolean(expiresAt) && remainingSeconds <= 0,
  };
}
