"use client";

import { useMemo, useState, useCallback } from "react";

import { Card } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { AuthFlow } from "./AuthFlow";
import { BookingHeader } from "./BookingHeader";
import { DatePicker } from "./DatePicker";
import { OrderSummary } from "./OrderSummary";
import { SlotGrid } from "./SlotGrid";
import { VenueHero } from "./VenueHero";
import {
  buildDateWindow,
  calculateMultiQuote,
  getCouponByCode,
} from "@/lib/booking-engine";
import { validateCoupon } from "@/lib/validation";

const INITIAL_AUTH = {
  step: "closed",
  name: "",
  phone: "",
  otp: "",
  error: "",
};

/**
 * Primary client-side booking page controller.
 * All courts are always visible — users select time slots per court independently.
 * Manages slot selections, quote calculation, coupon state, and checkout flow.
 *
 * @param {Object} props
 * @param {Object} props.venue        - Venue configuration object
 * @param {Array}  props.courts       - Array of court config objects
 * @param {Array}  props.availability - Per-court slot availability array
 */
export function BookingClient({ venue, courts, availability }) {
  const { session: activeSession } = useAuth();

  const dates = useMemo(
    () =>
      buildDateWindow({
        startDate: "2026-05-13",
        advanceBookingDays: venue.advanceBookingDays,
      }),
    [venue.advanceBookingDays],
  );

  const [selectedDate, setSelectedDate] = useState(
    dates[2]?.iso ?? dates[0].iso,
  );

  // Map<courtId, { startTime, endTime } | null>
  const [courtSelections, setCourtSelections] = useState(new Map());

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [auth, setAuth] = useState(INITIAL_AUTH);
  const [waiver, setWaiver] = useState({ time: false, policy: false });

  /* ── Derived state ─────────────────────────────── */

  /**
   * Build the selected courts array for quote calculation.
   * Iterates over all courts — only courts with a completed slot selection are included.
   */
  const selectedCourtsData = useMemo(() => {
    const result = [];
    for (const court of courts) {
      const sel = courtSelections.get(court.id);
      if (!sel) continue;

      const courtAvail = availability.find((ca) => ca.courtId === court.id);
      if (!courtAvail) continue;

      const startIdx = courtAvail.slots.findIndex(
        (s) => s.startTime === sel.startTime,
      );
      const endIdx = courtAvail.slots.findIndex(
        (s) => s.endTime === sel.endTime,
      );
      if (startIdx === -1 || endIdx === -1) continue;

      result.push({
        courtId: court.id,
        courtName: court.name,
        slots: courtAvail.slots.slice(startIdx, endIdx + 1),
      });
    }
    return result;
  }, [courtSelections, availability, courts]);

  const hasSelection = selectedCourtsData.length > 0;

  const quote = useMemo(
    () =>
      calculateMultiQuote({
        selectedCourts: selectedCourtsData,
        coupon,
      }),
    [selectedCourtsData, coupon],
  );

  /* ── Handlers ─────────────────────────────────── */

  const handleSlotSelect = useCallback((courtId, slotOrAction) => {
    setCourtSelections((prev) => {
      const next = new Map(prev);

      if (slotOrAction === null) {
        next.delete(courtId);
        return next;
      }

      if (slotOrAction.startSlot && slotOrAction.endSlot) {
        // Range extension
        next.set(courtId, {
          startTime: slotOrAction.startSlot.startTime,
          endTime: slotOrAction.endSlot.endTime,
        });
      } else {
        // Single slot start
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
      setCoupon(null);
      setCouponMessage(validation.message);
      return;
    }
    const nextCoupon = getCouponByCode(validation.value);
    setCoupon(nextCoupon);
    setCouponMessage(`${nextCoupon.code} applied.`);
  }

  function handleStartCheckout() {
    if (!hasSelection) return;
    
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
    setAuth((a) => ({
      ...a,
      step: "waiver",
      name: userData.name,
      phone: userData.phone,
      error: "",
    }));
  }, []);

  function handleConfirmPayment() {
    if (!waiver.time || !waiver.policy) return;
    setAuth((a) => ({ ...a, step: "success" }));
  }

  /* ── Render ───────────────────────────────────── */

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground sm:pb-32">
      <BookingHeader />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        {/* Left column — date picker + all court slot grids */}
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <VenueHero venue={venue} />

          <Card className="p-4 sm:p-6">
            <DatePicker
              dates={dates}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
            />

            {/* All courts always visible — no selection step required */}
            <SlotGrid
              availability={availability}
              courts={courts}
              courtSelections={courtSelections}
              onSlotSelect={handleSlotSelect}
            />
          </Card>
        </div>

        {/* Right column — sticky order summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <OrderSummary
            selectedCourtsData={selectedCourtsData}
            selectedDate={selectedDate}
            hasSelection={hasSelection}
            quote={quote}
            couponCode={couponCode}
            couponMessage={couponMessage}
            onCouponCodeChange={setCouponCode}
            onApplyCoupon={handleApplyCoupon}
            onCheckout={handleStartCheckout}
          />
        </aside>
      </div>

      {/* Checkout auth modal */}
      {auth.step !== "closed" && (
        <AuthFlow
          auth={auth}
          selectedDate={selectedDate}
          selectedCourtsData={selectedCourtsData}
          quote={quote}
          waiver={waiver}
          setWaiver={setWaiver}
          onAuthSuccess={handleAuthSuccess}
          confirmPayment={handleConfirmPayment}
          onClose={() => setAuth(INITIAL_AUTH)}
        />
      )}
    </main>
  );
}
