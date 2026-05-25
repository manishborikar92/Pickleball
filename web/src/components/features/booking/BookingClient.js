"use client";

import { useMemo, useState, useCallback } from "react";

import { Card } from "@/components/shared";
import { useAuth } from "@/hooks/useAuth";
import { AuthFlow } from "./AuthFlow";
import { BookingHeader } from "./BookingHeader";
import { CourtSelector } from "./CourtSelector";
import { DatePicker } from "./DatePicker";
import { OrderSummary } from "./OrderSummary";
import { SlotGrid } from "./SlotGrid";
import { VenueHero } from "./VenueHero";
import {
  buildDateWindow,
  calculateMultiQuote,
  createBookingHold,
  formatCurrency,
  getCouponByCode,
} from "@/lib/booking-engine";
import {
  validateCoupon,
} from "@/lib/validation";

const INITIAL_AUTH = {
  step: "closed",
  name: "",
  phone: "",
  otp: "",
  error: "",
};

/**
 * courtSelections: Map<courtId, { startTime, endTime }>
 *   — null entry means court is active but no slot selected yet
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

  // Set of toggled-on courtIds
  const [activeCourts, setActiveCourts] = useState(
    new Set([availability[0].courtId]),
  );

  // Map<courtId, {startTime, endTime} | null>
  const [courtSelections, setCourtSelections] = useState(new Map());

  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [hold, setHold] = useState(null);
  const [auth, setAuth] = useState(INITIAL_AUTH);
  const [waiver, setWaiver] = useState({ time: false, policy: false });
  const [paid, setPaid] = useState(false);

  /* ── Derived state ─────────────────────────────── */

  // Build selectedCourts array for quote calculation
  const selectedCourtsData = useMemo(() => {
    const result = [];
    for (const courtId of activeCourts) {
      const sel = courtSelections.get(courtId);
      if (!sel) continue;
      const courtAvail = availability.find((ca) => ca.courtId === courtId);
      const court = courts.find((c) => c.id === courtId);
      if (!courtAvail || !court) continue;

      const startIdx = courtAvail.slots.findIndex(
        (s) => s.startTime === sel.startTime,
      );
      const endIdx = courtAvail.slots.findIndex(
        (s) => s.endTime === sel.endTime,
      );
      if (startIdx === -1 || endIdx === -1) continue;

      result.push({
        courtId,
        courtName: court.name,
        slots: courtAvail.slots.slice(startIdx, endIdx + 1),
      });
    }
    return result;
  }, [activeCourts, courtSelections, availability, courts]);

  const hasSelection = selectedCourtsData.length > 0;

  const quote = useMemo(
    () =>
      calculateMultiQuote({
        selectedCourts: selectedCourtsData,
        serviceFee: 0,
        taxRate: 0,
        coupon,
        creditsApplied: 0,
      }),
    [selectedCourtsData, coupon],
  );

  // Build a human-readable time string from selections
  const fullTime = useMemo(() => {
    if (selectedCourtsData.length === 0) return "";
    const courtLabels = selectedCourtsData.map(({ courtName, slots }) => {
      const start = slots[0]?.startTime;
      const end = slots[slots.length - 1]?.endTime;
      return `${courtName}: ${start} – ${end}`;
    });
    return `${selectedDate} — ${courtLabels.join(" | ")}`;
  }, [selectedDate, selectedCourtsData]);

  /* ── Handlers ─────────────────────────────────── */

  function handleCourtToggle(courtId) {
    setActiveCourts((prev) => {
      const next = new Set(prev);
      if (next.has(courtId)) {
        // If at least one other court would remain, allow deselect
        if (next.size > 1) {
          next.delete(courtId);
          // Also clear its slot selection
          setCourtSelections((m) => {
            const nm = new Map(m);
            nm.delete(courtId);
            return nm;
          });
        }
      } else {
        next.add(courtId);
      }
      return next;
    });
    setHold(null);
    setPaid(false);
  }

  const handleSlotSelect = useCallback(
    (courtId, slotOrAction, allSlots) => {
      setCourtSelections((prev) => {
        const next = new Map(prev);

        if (slotOrAction === null) {
          // Deselect
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
      setHold(null);
      setPaid(false);
    },
    [],
  );

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
    const firstCourt = selectedCourtsData[0];
    const nextHold = createBookingHold({
      venueId: venue.id,
      courtId: firstCourt.courtId,
      slotDate: selectedDate,
      startTime: firstCourt.slots[0]?.startTime,
      endTime: firstCourt.slots[firstCourt.slots.length - 1]?.endTime,
      totalAmount: quote.totalAmount,
    });
    setHold(nextHold);

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
    setPaid(true);
    setAuth((a) => ({ ...a, step: "success" }));
  }

  /* ── Render ───────────────────────────────────── */

  return (
    <main className="min-h-screen bg-background pb-24 text-foreground sm:pb-32">
      <BookingHeader />

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        {/* Left column */}
        <div className="min-w-0 space-y-5 sm:space-y-6">
          <VenueHero venue={venue} />

          <Card className="p-4 sm:p-6">
            <DatePicker
              dates={dates}
              selectedDate={selectedDate}
              onSelect={setSelectedDate}
              onCalendarOpen={() =>
                setCouponMessage(
                  "Calendar picker will connect to the backend date window.",
                )
              }
            />

            {/* Court selector */}
            <CourtSelector
              courts={courts}
              activeCourts={activeCourts}
              onToggle={handleCourtToggle}
            />

            <SlotGrid
              availability={availability}
              courts={courts}
              activeCourts={activeCourts}
              courtSelections={courtSelections}
              onSlotSelect={handleSlotSelect}
            />
          </Card>
        </div>

        {/* Right column — sticky summary */}
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

      {/* Auth modal */}
      {auth.step !== "closed" && (
        <AuthFlow
          auth={auth}
          setAuth={setAuth}
          hold={hold}
          selectedDate={selectedDate}
          selectedCourtsData={selectedCourtsData}
          quote={quote}
          waiver={waiver}
          setWaiver={setWaiver}
          paid={paid}
          onAuthSuccess={handleAuthSuccess}
          confirmPayment={handleConfirmPayment}
          onClose={() => setAuth(INITIAL_AUTH)}
        />
      )}
    </main>
  );
}