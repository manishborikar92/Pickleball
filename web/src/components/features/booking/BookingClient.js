"use client";

import { useMemo, useState } from "react";

import { Card } from "@/components/shared";
import { AuthFlow } from "./AuthFlow";
import { BookingHeader } from "./BookingHeader";
import { DatePicker } from "./DatePicker";
import { OrderSummary } from "./OrderSummary";
import { SlotGrid } from "./SlotGrid";
import { VenueHero } from "./VenueHero";
import {
  buildDateWindow,
  calculateQuote,
  createBookingHold,
  formatCurrency,
  getCouponByCode,
} from "@/lib/booking-engine";
import {
  validateCoupon,
  validateName,
  validateOtp,
  validatePhone,
} from "@/lib/validation";

const INITIAL_AUTH = {
  step: "closed",
  name: "",
  phone: "",
  otp: "",
  error: "",
};

export function BookingClient({ venue, courts, availability }) {
  const dates = useMemo(
    () =>
      buildDateWindow({
        startDate: "2026-05-13",
        advanceBookingDays: venue.advanceBookingDays,
      }),
    [venue.advanceBookingDays],
  );

  const firstSlot = availability[0].slots.find((s) => s.status === "available");

  const [selectedDate, setSelectedDate] = useState(
    dates[2]?.iso ?? dates[0].iso,
  );
  
  // Initialize with reliable identifiers
  const [selected, setSelected] = useState({
    courtId: availability[0].courtId,
    startTime: firstSlot?.startTime,
    endTime: firstSlot?.endTime,
    price: firstSlot?.price || 0,
  });
  
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [hold, setHold] = useState(null);
  const [auth, setAuth] = useState(INITIAL_AUTH);
  const [waiver, setWaiver] = useState({ time: false, policy: false });
  const [paid, setPaid] = useState(false);

  const selectedCourt = courts.find((c) => c.id === selected.courtId);
  const quote = calculateQuote({
    courtFee: selected.price,
    equipmentFee: 100,
    serviceFee: 40,
    taxRate: 0.18,
    coupon,
    creditsApplied: 0,
  });

  const fullTime = `${selectedDate} — ${selected.startTime} to ${selected.endTime}`;

  /* ── Handlers ─────────────────────────────────── */

  function handleSelectSlot(courtId, slot) {
    if (slot.status !== "available") return;
    setSelected({ 
      courtId, 
      startTime: slot.startTime, 
      endTime: slot.endTime, 
      price: slot.price 
    });
    setHold(null);
    setPaid(false);
  }

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
    const nextHold = createBookingHold({
      venueId: venue.id,
      courtId: selected.courtId,
      slotDate: selectedDate,
      startTime: selected.startTime,
      endTime: selected.endTime,
      totalAmount: quote.totalAmount,
    });
    setHold(nextHold);
    setAuth({ ...INITIAL_AUTH, step: "name" });
  }

  function handleSubmitName(event) {
    event.preventDefault();
    const v = validateName(auth.name);
    if (!v.ok) {
      setAuth((a) => ({ ...a, error: v.message }));
      return;
    }
    setAuth((a) => ({ ...a, name: v.value, step: "phone", error: "" }));
  }

  function handleSubmitPhone(event) {
    event.preventDefault();
    const v = validatePhone(auth.phone);
    if (!v.ok) {
      setAuth((a) => ({ ...a, error: v.message }));
      return;
    }
    setAuth((a) => ({ ...a, phone: v.value, step: "otp", error: "" }));
  }

  function handleSubmitOtp(event) {
    event.preventDefault();
    const v = validateOtp(auth.otp);
    if (!v.ok) {
      setAuth((a) => ({ ...a, error: v.message }));
      return;
    }
    if (v.value !== "482913") {
      setAuth((a) => ({ ...a, error: "Use demo OTP 482913 to continue." }));
      return;
    }
    setAuth((a) => ({ ...a, step: "waiver", error: "" }));
  }

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
            <SlotGrid
              availability={availability}
              courts={courts}
              selected={selected}
              onSelectSlot={handleSelectSlot}
            />
          </Card>
        </div>

        {/* Right column — sticky summary */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <OrderSummary
            selectedCourt={selectedCourt}
            selected={selected}
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
          fullTime={fullTime}
          quote={quote}
          waiver={waiver}
          setWaiver={setWaiver}
          paid={paid}
          submitName={handleSubmitName}
          submitPhone={handleSubmitPhone}
          submitOtp={handleSubmitOtp}
          confirmPayment={handleConfirmPayment}
          onClose={() => setAuth(INITIAL_AUTH)}
        />
      )}
    </main>
  );
}