"use client";

import { useCallback, useEffect, useState } from "react";

import { TimerReset } from "lucide-react";

import { Button, Card } from "@/components/shared";
import { AuthFlow } from "./AuthFlow";
import { BookingHeader } from "./BookingHeader";
import { DatePicker } from "./DatePicker";
import { OrderSummary } from "./OrderSummary";
import { SlotGrid } from "./SlotGrid";
import { VenueHero } from "./VenueHero";
import { useBookingSelection } from "@/hooks/useBookingSelection";
import { useCountdown } from "@/hooks/useCountdown";
import { formatCountdown } from "@/lib/bookingEngine";
import {
  checkoutBookingAction,
  confirmHeldBookingAction,
  getBookingStatusAction,
  getWalletBalanceAction,
} from "@/lib/actions/booking";

const INITIAL_AUTH = {
  step: "closed",
  name: "",
  phone: "",
  otp: "",
  error: "",
};

/**
 * sessionStorage persistence for the active hold. The hold otherwise lives only
 * in component state, so a reload or a return from the payment gateway (full-page
 * redirect, back button) would strand the user: the booking stays held
 * server-side — its slots even show as "pending" on the grid — with no way to
 * resume paying for it. Persisting {hold + selection snapshot} lets the page
 * restore checkout and resume the same payment within the hold's TTL.
 * Session-scoped on purpose: it survives navigation in the tab but not new tabs.
 */
const HOLD_STORAGE_KEY = "pb:checkout-hold";

function readPersistedHold(venueId) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(HOLD_STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const validShape =
      saved && saved.venueId === venueId && saved.bookingId && saved.expiresAt && saved.snapshot;
    // Don't bother restoring a hold that's about to lapse.
    if (!validShape || new Date(saved.expiresAt).getTime() - Date.now() < 15_000) {
      window.sessionStorage.removeItem(HOLD_STORAGE_KEY);
      return null;
    }
    return saved;
  } catch {
    clearPersistedHold();
    return null;
  }
}

function persistHold(data) {
  try {
    window.sessionStorage.setItem(HOLD_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage unavailable (private mode/quota) — checkout still works in-memory.
  }
}

function clearPersistedHold() {
  try {
    window.sessionStorage.removeItem(HOLD_STORAGE_KEY);
  } catch {
    // Ignore — nothing to clear or storage unavailable.
  }
}

// The slot hold created at checkout commit (commit-on-confirm):
//   idle    — nothing reserved; the user is browsing/reviewing freely
//   active  — Confirm & Pay reserved the slots and initiated payment; the
//             countdown runs from `expiresAt` until the gateway step completes
//   expired — the 10-minute payment window lapsed before payment
// `selectionKey` fingerprints the selection the hold covers. `resume` carries
// the checkout-view snapshot (date, courts, quote) — once a hold exists its
// slots read as "pending" in availability, so the live selection/price-preview
// pipeline cannot re-derive the view; the snapshot is what checkout renders.
const INITIAL_HOLD = {
  status: "idle",
  bookingId: "",
  expiresAt: null,
  selectionKey: "",
  resume: null,
};

/**
 * BookingClient — thin orchestrator for the checkout wizard.
 *
 * Selection / availability / coupon / pricing state lives in `useBookingSelection`
 * (HI-12). This component owns the checkout + auth-step orchestration. Checkout
 * is commit-on-confirm: the confirm modal opens instantly with the live price
 * preview and reserves NOTHING; the whole hold → waiver → initiate-payment
 * transaction runs on the server only when the user clicks Confirm & Pay
 * (`checkoutBookingAction`, HI-13). From that moment the 10-minute payment
 * window counts down, and an abandoned gateway step (cancelled popup, closed
 * modal, reload) can be resumed via `confirmHeldBookingAction` until it lapses.
 */
export function BookingClient({
  venue,
  courts,
  availability,
  initialDate,
  session: activeSession,
  walletBalance: initialWalletBalance = 0,
}) {
  const selection = useBookingSelection({
    venue,
    courts,
    initialAvailability: availability,
    initialDate,
  });

  const [auth, setAuth] = useState(INITIAL_AUTH);
  const [hold, setHold] = useState(() => {
    // Optimistically restore a persisted hold before the first render (faster than
    // an effect that triggers a second render, and avoids the set-state-in-effect
    // lint rule). The verification effect below checks the server asynchronously.
    const saved = readPersistedHold(venue.id);
    if (!saved) return INITIAL_HOLD;
    return {
      status: "active",
      bookingId: saved.bookingId,
      expiresAt: saved.expiresAt,
      selectionKey: saved.selectionKey,
      resume: saved.snapshot,
    };
  });
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [waiver, setWaiver] = useState({ time: false, policy: false });
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleDateSelect = useCallback((date) => {
    selection.selectDate(date);
    setCheckoutError("");
  }, [selection]);

  /**
   * The hold's 10-minute window lapsed. With the waiver step open, surface the
   * expired panel there; otherwise (modal closed) release the hold silently.
   * Either way the grid is refreshed — the freed slots are back in the pool for
   * everyone, including this user.
   */
  const handleHoldExpire = () => {
    clearPersistedHold();
    if (auth.step === "waiver") {
      setHold((current) => ({ ...current, status: "expired" }));
    } else {
      setHold(INITIAL_HOLD);
    }
    selection.refreshAvailability();
  };

  const countdown = useCountdown(
    hold.status === "active" ? hold.expiresAt : null,
    handleHoldExpire,
  );

  /** Releases all checkout state and returns the user to the selection grid. */
  const handleReturnToGrid = useCallback(() => {
    clearPersistedHold();
    setAuth(INITIAL_AUTH);
    setHold(INITIAL_HOLD);
    setWaiver({ time: false, policy: false });
    setCheckoutError("");
    selection.clearSelections();
    selection.refreshAvailability();
  }, [selection]);

  // Verify the optimistically restored hold in the background — if the server
  // reports it's paid/expired/missing, clear the stale local state.
  useEffect(() => {
    if (hold.status !== "active" || !hold.bookingId) return undefined;
    if (!hold.resume) return undefined; // only verify restored holds, not fresh ones

    let cancelled = false;
    getBookingStatusAction(hold.bookingId)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok || res.data.status !== "pending_payment") {
          clearPersistedHold();
          setHold(INITIAL_HOLD);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Opens the checkout modal at the right step for the session state. */
  function openCheckoutModal() {
    if (activeSession?.user && activeSession.user.name) {
      setAuth({ step: "waiver", name: activeSession.user.name, phone: activeSession.user.phone, otp: "", error: "" });
    } else if (activeSession?.user && !activeSession.user.name) {
      setAuth({ step: "name", name: "", phone: activeSession.user.phone, otp: "", error: "" });
    } else {
      setAuth({ ...INITIAL_AUTH, step: "phone" });
    }
  }

  function handleStartCheckout() {
    setCheckoutError("");
    if (!selection.canCheckout || !selection.selectionPayload.ok) {
      setCheckoutError(
        selection.selectionPayload.message || selection.quoteError || "Complete a valid selection first.",
      );
      return;
    }

    // Nothing is reserved yet — the modal opens instantly with the live price
    // preview, and the slots are held only at the final Confirm & Pay click.
    openCheckoutModal();
  }

  /**
   * Reopens checkout for an already-active hold (dismissed gateway popup,
   * closed modal, or hold restored after a reload). No selection validation —
   * the held booking is the source of truth and Pay resumes its payment.
   */
  function handleResumeCheckout() {
    setCheckoutError("");
    openCheckoutModal();
  }

  /**
   * Closes the checkout modal. Before commit this is side-effect free — nothing
   * was reserved. After commit (active hold), the grid selection would collide
   * with our own hold (its slots now read "pending" server-side and can no
   * longer be re-priced), so release the selection and refresh the grid; the
   * resume banner remains the way back into the payment.
   */
  function handleCloseModal() {
    if (hold.status === "expired") {
      handleReturnToGrid();
      return;
    }
    setAuth(INITIAL_AUTH);
    if (hold.status === "active") {
      setCheckoutError("");
      selection.clearSelections();
      selection.refreshAvailability();
    }
  }

  function handleAuthSuccess(userData) {
    setAuth((current) => ({
      ...current,
      step: "waiver",
      name: userData.name,
      phone: userData.phone,
      error: "",
    }));
    // The user just signed in inside the modal; the server-rendered balance was
    // for an anonymous page load. Refresh it so the confirm step shows the real
    // wallet/UPI split before they pay.
    getWalletBalanceAction()
      .then((res) => { if (res.ok) setWalletBalance(res.data.balance); })
      .catch(() => {});
  }

  async function handleConfirmPayment() {
    if (!waiver.time || !waiver.policy) return;

    // First click commits (hold → waiver → pay in one server pass); once a hold
    // exists (cancelled gateway popup, resumed checkout), Pay resumes the same
    // booking and the backend reuses its initiated payment order.
    const resuming = hold.status === "active" && Boolean(hold.bookingId);
    if (!resuming && !selection.selectionPayload.ok) {
      setCheckoutError(selection.selectionPayload.message || "Complete a valid selection first.");
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      const result = resuming
        ? await confirmHeldBookingAction(hold.bookingId, { useWalletCredits: true })
        : await checkoutBookingAction(selection.selectionPayload.value, { useWalletCredits: true });

      // Another user took one of the slots between preview and commit — back to
      // the grid with fresh availability so the user reselects against truth.
      if (result.kind === "conflict") {
        setAuth(INITIAL_AUTH);
        setCheckoutError(result.message || "Some of your selected slots were just taken.");
        selection.clearSelections();
        selection.refreshAvailability();
        return;
      }

      // The payment window lapsed before this attempt — release local state via
      // the same path as a client-observed expiry.
      if (result.kind === "error" && result.code === "hold_expired") {
        clearPersistedHold();
        setHold((current) => ({ ...current, status: "expired" }));
        selection.refreshAvailability();
        return;
      }

      // Wallet-only / already-confirmed — go straight to the unified status page.
      if (result.kind === "confirmed") {
        clearPersistedHold();
        window.location.assign(`/booking/${result.bookingId}`);
        return;
      }

      // Gateway payment — PhonePe iFrame checkout, or a full-page redirect fallback.
      if (result.kind === "redirect" && result.redirectUrl) {
        // The commit created the hold: activate the countdown and persist the
        // hold + checkout-view snapshot so the payment can be resumed after a
        // cancelled popup, closed modal, reload, or return from the gateway.
        const expiresAt = result.expiresAt || hold.expiresAt;
        const selectionKey = resuming
          ? hold.selectionKey
          : JSON.stringify(selection.selectionPayload.value);
        const snapshot = hold.resume ?? {
          date: selection.selectedDate,
          courtsData: selection.selectedCourtsData,
          quote: selection.quote,
        };
        setHold({
          status: "active",
          bookingId: result.bookingId,
          expiresAt,
          selectionKey,
          resume: snapshot,
        });
        persistHold({
          venueId: venue.id,
          bookingId: result.bookingId,
          expiresAt,
          selectionKey,
          snapshot,
        });

        if (typeof window.PhonePeCheckout?.transact === "function") {
          window.PhonePeCheckout.transact({
            tokenUrl: result.redirectUrl,
            type: "IFRAME",
            callback: (response) => {
              if (response === "USER_CANCEL") {
                // The hold stays active — the user can hit Pay again and the
                // backend reuses the initiated payment order.
                setCheckoutError("Payment was cancelled — your slots are still reserved. You can try again.");
                setCheckoutLoading(false);
              } else {
                // CONCLUDED — verify on the same-origin redirect landing (the
                // merchantUrls.redirectUrl target); the backend origin never
                // appears in the browser.
                window.location.assign(
                  `/booking/redirect?orderId=${encodeURIComponent(result.merchantOrderId)}`,
                );
              }
            },
          });
          return;
        }

        // Fallback: PhonePe JS bundle not loaded — full-page redirect.
        window.location.assign(result.redirectUrl);
        return;
      }

      setCheckoutError(result.message || "Payment could not be initiated. Please try again.");
    } catch (error) {
      setCheckoutError(error.message || "Could not complete booking.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // What the checkout modal displays: the live selection normally, or the
  // persisted snapshot when resuming a restored hold (the held slots read as
  // "pending" in availability by then, so the live pipeline can't rebuild it).
  const checkoutView = hold.resume ?? {
    date: selection.selectedDate,
    courtsData: selection.selectedCourtsData,
    quote: selection.quote,
  };

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground sm:pb-32">
      <BookingHeader />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <VenueHero venue={venue} />

          {/* An active hold with the checkout modal closed (popup dismissed,
              page reloaded, back from the gateway) — offer to resume the same
              payment before the window runs out. */}
          {hold.status === "active" && auth.step === "closed" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex items-start gap-2.5">
                <TimerReset className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                <p className="text-sm font-semibold leading-snug text-foreground">
                  Your slots are still reserved —{" "}
                  <span className="font-mono font-black tabular-nums text-accent">
                    {formatCountdown(countdown.remainingSeconds)}
                  </span>{" "}
                  left to complete payment.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleResumeCheckout}
                className="w-full shrink-0 px-5 py-2.5 text-sm font-bold sm:w-auto"
              >
                Resume checkout
              </Button>
            </div>
          )}

          <Card className="p-4 sm:p-6">
            <DatePicker
              dates={selection.dates}
              selectedDate={selection.selectedDate}
              onSelect={handleDateSelect}
            />

            {selection.availabilityError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                {selection.availabilityError}
              </div>
            )}

            <SlotGrid
              availability={selection.availabilityData}
              courts={courts}
              courtSelections={selection.courtSelections}
              sharedSlotTimes={selection.sharedSlotTimes}
              selectionNotice={selection.selectionNotice}
              onSlotSelect={selection.selectSlot}
            />
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <OrderSummary
            selectedCourtsData={selection.selectedCourtsData}
            selectedDate={selection.selectedDate}
            hasSelection={selection.hasSelection}
            quote={selection.quote}
            walletBalance={walletBalance}
            couponCode={selection.couponCode}
            couponMessage={selection.couponMessage}
            quoteError={selection.quoteError || checkoutError}
            canCheckout={selection.canCheckout}
            onCouponCodeChange={selection.setCouponCode}
            onApplyCoupon={selection.applyCoupon}
            onCheckout={handleStartCheckout}
          />
        </aside>
      </div>

      {auth.step !== "closed" && (
        <AuthFlow
          auth={auth}
          selectedDate={checkoutView.date}
          selectedCourtsData={checkoutView.courtsData}
          quote={checkoutView.quote}
          walletBalance={walletBalance}
          waiver={waiver}
          setWaiver={setWaiver}
          hold={hold}
          holdRemainingSeconds={countdown.remainingSeconds}
          checkoutError={checkoutError}
          checkoutLoading={checkoutLoading}
          onAuthSuccess={handleAuthSuccess}
          confirmPayment={handleConfirmPayment}
          onReturnToGrid={handleReturnToGrid}
          onClose={handleCloseModal}
        />
      )}
    </main>
  );
}
