"use client";

import { useCallback, useState } from "react";

import { Card } from "@/components/shared";
import { AuthFlow } from "./AuthFlow";
import { BookingHeader } from "./BookingHeader";
import { DatePicker } from "./DatePicker";
import { OrderSummary } from "./OrderSummary";
import { SlotGrid } from "./SlotGrid";
import { VenueHero } from "./VenueHero";
import { useBookingSelection } from "@/hooks/useBookingSelection";
import { checkoutBookingAction, getWalletBalanceAction } from "@/lib/actions/booking";

const INITIAL_AUTH = {
  step: "closed",
  name: "",
  phone: "",
  otp: "",
  error: "",
};

/**
 * BookingClient — thin orchestrator for the checkout wizard.
 *
 * Selection / availability / coupon / pricing state lives in `useBookingSelection`
 * (HI-12). This component owns only the checkout + auth-step orchestration: it
 * opens the auth/waiver modal, and on confirmation delegates the whole
 * hold→waiver→pay transaction to the server via `checkoutBookingAction` (HI-13),
 * then navigates based on the discriminated result.
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
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [waiver, setWaiver] = useState({ time: false, policy: false });
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const handleDateSelect = useCallback((date) => {
    selection.selectDate(date);
    setCheckoutError("");
  }, [selection]);

  function handleStartCheckout() {
    setCheckoutError("");
    if (!selection.canCheckout || !selection.selectionPayload.ok) {
      setCheckoutError(
        selection.selectionPayload.message || selection.quoteError || "Complete a valid selection first.",
      );
      return;
    }

    if (activeSession?.user && activeSession.user.name) {
      setAuth({ step: "waiver", name: activeSession.user.name, phone: activeSession.user.phone, otp: "", error: "" });
    } else if (activeSession?.user && !activeSession.user.name) {
      setAuth({ step: "name", name: "", phone: activeSession.user.phone, otp: "", error: "" });
    } else {
      setAuth({ ...INITIAL_AUTH, step: "phone" });
    }
  }

  const handleAuthSuccess = useCallback((userData) => {
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
  }, []);

  async function handleConfirmPayment() {
    if (!waiver.time || !waiver.policy) return;
    if (!selection.selectionPayload.ok) {
      setCheckoutError(selection.selectionPayload.message);
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      // The whole hold → waiver → initiate-payment transaction runs on the server
      // (checkoutBookingAction); the client only reacts to the result (HI-13).
      const result = await checkoutBookingAction(selection.selectionPayload.value, {
        useWalletCredits: true,
      });

      // Wallet-only / already-confirmed — go straight to the unified status page.
      if (result.kind === "confirmed") {
        window.location.assign(`/booking/${result.bookingId}`);
        return;
      }

      // Gateway payment — PhonePe iFrame checkout, or a full-page redirect fallback.
      if (result.kind === "redirect" && result.redirectUrl) {
        if (typeof window.PhonePeCheckout?.transact === "function") {
          window.PhonePeCheckout.transact({
            tokenUrl: result.redirectUrl,
            type: "IFRAME",
            callback: (response) => {
              if (response === "USER_CANCEL") {
                setCheckoutError("Payment was cancelled. You can try again.");
                setCheckoutLoading(false);
              } else {
                // CONCLUDED — redirect to backend for verification.
                window.location.assign(
                  `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/v1/payments/redirect?orderId=${result.merchantOrderId}`,
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

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground sm:pb-32">
      <BookingHeader />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <VenueHero venue={venue} />

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
          selectedDate={selection.selectedDate}
          selectedCourtsData={selection.selectedCourtsData}
          quote={selection.quote}
          walletBalance={walletBalance}
          waiver={waiver}
          setWaiver={setWaiver}
          checkoutError={checkoutError}
          checkoutLoading={checkoutLoading}
          onAuthSuccess={handleAuthSuccess}
          confirmPayment={handleConfirmPayment}
          onClose={() => setAuth(INITIAL_AUTH)}
        />
      )}
    </main>
  );
}
