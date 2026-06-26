"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { AuthFlow } from "./AuthFlow";
import { BookingHeader } from "./BookingHeader";
import { DatePicker } from "./DatePicker";
import { OrderSummary } from "./OrderSummary";
import { SlotGrid } from "./SlotGrid";
import { VenueHero } from "./VenueHero";
import { buildDateWindow, getSlotRange } from "@/lib/booking-engine";
import { validateCoupon } from "@/lib/validation";
import {
  acceptBookingWaiverAction,
  createBookingHoldAction,
  getVenueAvailabilityAction,
  initiateBookingPaymentAction,
  previewBookingPriceAction,
} from "@/app/actions/booking-actions";
import { buildBookingSelectionPayload } from "@/services/bookingService";

const INITIAL_AUTH = {
  step: "closed",
  name: "",
  phone: "",
  otp: "",
  error: "",
};

const EMPTY_QUOTE = {
  subtotal: 0,
  courtFee: 0,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 0,
  units: [],
  breakdown: [],
};

export function BookingClient({
  venue,
  courts,
  availability,
  initialDate,
}) {
  const { session: activeSession } = useAuth();

  const dates = useMemo(
    () => buildDateWindow({
      startDate: initialDate,
      advanceBookingDays: venue.advanceBookingDays,
    }),
    [initialDate, venue.advanceBookingDays],
  );

  const [selectedDate, setSelectedDate] = useState(dates[0]?.iso ?? initialDate);
  const [availabilityData, setAvailabilityData] = useState(availability || []);
  const [availabilityError, setAvailabilityError] = useState("");
  const [courtSelections, setCourtSelections] = useState(new Map());
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [auth, setAuth] = useState(INITIAL_AUTH);
  const [waiver, setWaiver] = useState({ time: false, policy: false });
  const [serverQuote, setServerQuote] = useState(EMPTY_QUOTE);
  const [quoteRequestError, setQuoteRequestError] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState("");

  useEffect(() => {
    let active = true;

    getVenueAvailabilityAction(venue.id, selectedDate)
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setAvailabilityData(res.data);
          setAvailabilityError("");
        } else {
          setAvailabilityData([]);
          setAvailabilityError(res.error || "Could not load availability.");
        }
      })
      .catch((error) => {
        if (!active) return;
        setAvailabilityData([]);
        setAvailabilityError(error.message || "Could not load availability.");
      });

    return () => {
      active = false;
    };
  }, [selectedDate, venue.id]);

  const selectedCourtsData = useMemo(() => {
    const result = [];

    for (const court of courts) {
      const selection = courtSelections.get(court.id);
      if (!selection) continue;

      const courtAvailability = availabilityData.find((item) => item.courtId === court.id);
      if (!courtAvailability) continue;

      const slotsRange = getSlotRange(courtAvailability.slots, selection.startTime, selection.endTime);
      if (slotsRange.length === 0) continue;

      result.push({
        courtId: court.id,
        courtName: court.name,
        slots: slotsRange,
      });
    }

    return result;
  }, [availabilityData, courtSelections, courts]);

  const selectionPayload = useMemo(
    () => buildBookingSelectionPayload({
      venueId: venue.id,
      selectedDate,
      selectedCourtsData,
      couponCode: appliedCouponCode,
    }),
    [appliedCouponCode, selectedCourtsData, selectedDate, venue.id],
  );

  const hasSelection = selectedCourtsData.length > 0;
  const quote = hasSelection && selectionPayload.ok ? serverQuote : EMPTY_QUOTE;
  const quoteError = !hasSelection
    ? ""
    : (!selectionPayload.ok ? selectionPayload.message : quoteRequestError);
  const canCheckout = hasSelection && selectionPayload.ok && !quoteError && !quoteLoading;

  useEffect(() => {
    let active = true;

    if (!hasSelection) {
      return () => {
        active = false;
      };
    }

    if (!selectionPayload.ok) {
      return () => {
        active = false;
      };
    }

    previewBookingPriceAction(selectionPayload.value)
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setServerQuote(res.data);
          setQuoteRequestError("");
          if (appliedCouponCode) setCouponMessage(`${appliedCouponCode} applied.`);
        } else {
          setServerQuote(EMPTY_QUOTE);
          setQuoteRequestError(res.error || "Could not calculate price.");
          if (appliedCouponCode) {
            setCouponMessage(res.error || "Promo code could not be applied.");
          }
        }
      })
      .catch((error) => {
        if (!active) return;
        setServerQuote(EMPTY_QUOTE);
        setQuoteRequestError(error.message || "Could not calculate price.");
        if (appliedCouponCode) {
          setCouponMessage(error.message || "Promo code could not be applied.");
        }
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });

    return () => {
      active = false;
    };
  }, [appliedCouponCode, hasSelection, selectionPayload]);

  const handleSlotSelect = useCallback((courtId, slotOrAction) => {
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    setCourtSelections((prev) => {
      const next = new Map(prev);

      if (slotOrAction === null) {
        next.delete(courtId);
        return next;
      }

      if (slotOrAction.startSlot && slotOrAction.endSlot) {
        next.set(courtId, {
          startTime: slotOrAction.startSlot.startTime,
          endTime: slotOrAction.endSlot.endTime,
        });
      } else {
        next.set(courtId, {
          startTime: slotOrAction.startTime,
          endTime: slotOrAction.endTime,
        });
      }

      return next;
    });
  }, []);

  function handleApplyCoupon() {
    const validation = validateCoupon(couponCode);
    if (!validation.ok) {
      setAppliedCouponCode("");
      setCouponMessage(validation.message);
      return;
    }

    setAppliedCouponCode(validation.value);
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    setCouponMessage("Checking promo with server pricing.");
  }

  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    setAvailabilityError("");
    setCourtSelections(new Map());
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    setCheckoutError("");
  }, []);

  function handleStartCheckout() {
    setCheckoutError("");
    if (!canCheckout || !selectionPayload.ok) {
      setCheckoutError(selectionPayload.message || quoteError || "Complete a valid selection first.");
      return;
    }

    if (activeSession?.user && activeSession.user.name) {
      setAuth({
        step: "waiver",
        name: activeSession.user.name,
        phone: activeSession.user.phone,
        otp: "",
        error: "",
      });
    } else if (activeSession?.user && !activeSession.user.name) {
      setAuth({
        step: "name",
        name: "",
        phone: activeSession.user.phone,
        otp: "",
        error: "",
      });
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
  }, []);

  async function handleConfirmPayment() {
    if (!waiver.time || !waiver.policy) return;
    if (!selectionPayload.ok) {
      setCheckoutError(selectionPayload.message);
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      const holdRes = await createBookingHoldAction(selectionPayload.value);
      if (!holdRes.success) {
        setCheckoutError(holdRes.error || "Could not create booking hold.");
        return;
      }
      const hold = holdRes.data;

      const waiverRes = await acceptBookingWaiverAction(hold.booking_id);
      if (!waiverRes.success) {
        setCheckoutError(waiverRes.error || "Could not accept booking waiver.");
        return;
      }

      const paymentRes = await initiateBookingPaymentAction(hold.booking_id, {
        useWalletCredits: true,
      });
      if (!paymentRes.success) {
        setCheckoutError(paymentRes.error || "Could not initiate payment.");
        return;
      }
      const payment = paymentRes.data;

      // Wallet-only payment — no gateway needed.
      if (payment.type === "wallet_only") {
        setConfirmedBookingId(hold.booking_id);
        setAuth((current) => ({ ...current, step: "success" }));
        return;
      }

      // PhonePe payment — use iFrame checkout or fallback to redirect.
      if (payment.redirect_url) {
        if (typeof window.PhonePeCheckout?.transact === "function") {
          window.PhonePeCheckout.transact({
            tokenUrl: payment.redirect_url,
            type: "IFRAME",
            callback: (response) => {
              if (response === "USER_CANCEL") {
                setCheckoutError("Payment was cancelled. You can try again.");
                setCheckoutLoading(false);
              } else {
                // CONCLUDED — redirect to backend for verification.
                window.location.assign(
                  `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}/api/v1/payments/redirect?orderId=${payment.merchant_order_id}`,
                );
              }
            },
          });
          return;
        }

        // Fallback: PhonePe JS bundle not loaded — full-page redirect.
        window.location.assign(payment.redirect_url);
        return;
      }

      setCheckoutError("Payment could not be initiated. Please try again.");
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
              dates={dates}
              selectedDate={selectedDate}
              onSelect={handleDateSelect}
            />

            {availabilityError && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
                {availabilityError}
              </div>
            )}

            <SlotGrid
              availability={availabilityData}
              courts={courts}
              courtSelections={courtSelections}
              onSlotSelect={handleSlotSelect}
            />
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <OrderSummary
            selectedCourtsData={selectedCourtsData}
            selectedDate={selectedDate}
            hasSelection={hasSelection}
            quote={quote}
            couponCode={couponCode}
            couponMessage={couponMessage}
            quoteLoading={quoteLoading}
            quoteError={quoteError || checkoutError}
            canCheckout={canCheckout}
            onCouponCodeChange={setCouponCode}
            onApplyCoupon={handleApplyCoupon}
            onCheckout={handleStartCheckout}
          />
        </aside>
      </div>

      {auth.step !== "closed" && (
        <AuthFlow
          auth={auth}
          selectedDate={selectedDate}
          selectedCourtsData={selectedCourtsData}
          quote={quote}
          waiver={waiver}
          setWaiver={setWaiver}
          checkoutError={checkoutError}
          checkoutLoading={checkoutLoading}
          confirmedBookingId={confirmedBookingId}
          onAuthSuccess={handleAuthSuccess}
          confirmPayment={handleConfirmPayment}
          onClose={() => setAuth(INITIAL_AUTH)}
        />
      )}
    </main>
  );
}
