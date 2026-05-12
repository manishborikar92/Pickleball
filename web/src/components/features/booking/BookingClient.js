"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/shared/Badge";
import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
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

const initialAuth = {
  step: "closed",
  name: "",
  phone: "",
  otp: "",
  error: "",
};

export function BookingClient({ venue, courts, availability }) {
  const dates = useMemo(
    () => buildDateWindow({ startDate: "2026-05-13", advanceBookingDays: venue.advanceBookingDays }),
    [venue.advanceBookingDays],
  );
  const firstSlot = availability[0].slots.find((slot) => slot.status === "available");
  const [selectedDate, setSelectedDate] = useState(dates[2]?.iso || dates[0].iso);
  const [selected, setSelected] = useState({
    courtId: availability[0].courtId,
    ...firstSlot,
  });
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState("");
  const [hold, setHold] = useState(null);
  const [auth, setAuth] = useState(initialAuth);
  const [waiver, setWaiver] = useState({ time: false, policy: false });
  const [paid, setPaid] = useState(false);

  const selectedCourt = courts.find((court) => court.id === selected.courtId);
  const quote = calculateQuote({
    courtFee: selected.price,
    equipmentFee: 100,
    serviceFee: 40,
    taxRate: 0.18,
    coupon,
    creditsApplied: 0,
  });

  const fullTime = `${selectedDate} - ${selected.startTime} to ${selected.endTime}`;

  function selectSlot(courtId, slot) {
    if (slot.status !== "available") return;
    setSelected({ courtId, ...slot });
    setHold(null);
    setPaid(false);
  }

  function applyCoupon() {
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

  function startCheckout() {
    const nextHold = createBookingHold({
      venueId: venue.id,
      courtId: selected.courtId,
      slotDate: selectedDate,
      startTime: selected.startTime,
      endTime: selected.endTime,
      totalAmount: quote.totalAmount,
    });
    setHold(nextHold);
    setAuth({ ...initialAuth, step: "name" });
  }

  function submitName(event) {
    event.preventDefault();
    const validation = validateName(auth.name);
    if (!validation.ok) {
      setAuth((current) => ({ ...current, error: validation.message }));
      return;
    }
    setAuth((current) => ({ ...current, name: validation.value, step: "phone", error: "" }));
  }

  function submitPhone(event) {
    event.preventDefault();
    const validation = validatePhone(auth.phone);
    if (!validation.ok) {
      setAuth((current) => ({ ...current, error: validation.message }));
      return;
    }
    setAuth((current) => ({ ...current, phone: validation.value, step: "otp", error: "" }));
  }

  function submitOtp(event) {
    event.preventDefault();
    const validation = validateOtp(auth.otp);
    if (!validation.ok) {
      setAuth((current) => ({ ...current, error: validation.message }));
      return;
    }
    if (validation.value !== "482913") {
      setAuth((current) => ({ ...current, error: "Use demo OTP 482913 to continue." }));
      return;
    }
    setAuth((current) => ({ ...current, step: "waiver", error: "" }));
  }

  function confirmPayment() {
    if (!waiver.time || !waiver.policy) return;
    setPaid(true);
    setAuth((current) => ({ ...current, step: "success" }));
  }

  return (
    <main className="min-h-screen bg-background pb-32 text-foreground">
      <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-muted hover:text-accent" aria-label="Back home">Back</Link>
          <h1 className="text-xl font-black text-accent">Checkout</h1>
          <Link href="/dashboard" className="text-sm font-semibold text-muted hover:text-accent">Account</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <section className="grid gap-5 md:grid-cols-[260px_1fr] md:items-center">
            <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line bg-[url('/designs/checkout-reference.png')] bg-cover bg-top" />
            <div>
              <Badge>Premium Court</Badge>
              <h2 className="mt-4 text-4xl font-black leading-tight">{venue.brandName}</h2>
              <p className="mt-3 text-muted">{venue.address}</p>
            </div>
          </section>

          <Card className="p-5 sm:p-6">
            <h3 className="text-2xl font-black">Select Date & Time</h3>
            <div className="mt-5 flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {dates.map((date) => (
                <button
                  key={date.iso}
                  type="button"
                  onClick={() => setSelectedDate(date.iso)}
                  className={`grid h-20 min-w-16 place-items-center rounded-lg border px-3 text-center text-xs font-bold ${
                    selectedDate === date.iso
                      ? "border-accent bg-accent text-black"
                      : "border-line bg-surface-high text-muted"
                  }`}
                >
                  <span>{date.weekday}</span>
                  <span className="text-xl">{date.day}</span>
                  <span>{date.month}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCouponMessage("Calendar picker will connect to the backend date window.")}
                className="grid h-20 min-w-16 place-items-center rounded-lg border border-line bg-surface-high text-accent"
                aria-label="Open calendar"
              >
                Cal
              </button>
            </div>

            <div className="mt-6 space-y-6 border-t border-line pt-6">
              {availability.map((courtAvailability) => {
                const court = courts.find((item) => item.id === courtAvailability.courtId);
                return (
                  <section key={courtAvailability.courtId}>
                    <h4 className="text-xl font-black">{court.name}</h4>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                      {courtAvailability.slots.map((slot) => {
                        const isSelected =
                          selected.courtId === courtAvailability.courtId &&
                          selected.startTime === slot.startTime;
                        const disabled = slot.status !== "available";
                        return (
                          <button
                            key={`${courtAvailability.courtId}-${slot.startTime}`}
                            type="button"
                            disabled={disabled}
                            onClick={() => selectSlot(courtAvailability.courtId, slot)}
                            className={`min-h-20 rounded-lg border p-3 text-center transition ${
                              isSelected
                                ? "border-accent bg-accent text-black"
                                : disabled
                                  ? "cursor-not-allowed border-line bg-surface/60 text-muted/45 line-through"
                                  : "border-line bg-surface-soft text-foreground hover:border-accent"
                            }`}
                          >
                            <span className="block font-bold">{slot.startTime}</span>
                            <span className="mt-1 block text-sm opacity-75">{slot.endTime}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5 sm:p-6">
            <h3 className="text-2xl font-black">Summary</h3>
            <div className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted">{selectedCourt.name} ({selected.startTime})</span><span>{formatCurrency(selected.price)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted">Equipment Rental</span><span>{formatCurrency(100)}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted">Service Fee</span><span>{formatCurrency(40)}</span></div>
              {quote.discountAmount ? (
                <div className="flex justify-between gap-4 text-accent"><span>Discount</span><span>-{formatCurrency(quote.discountAmount)}</span></div>
              ) : null}
              <div className="flex justify-between gap-4"><span className="text-muted">Tax</span><span>{formatCurrency(quote.taxAmount)}</span></div>
            </div>
            <div className="mt-5 flex gap-2 border-t border-line pt-5">
              <input
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="Promo code"
                className="min-w-0 flex-1 rounded-lg border border-line bg-background px-4 py-3 text-sm"
              />
              <Button type="button" onClick={applyCoupon} className="rounded-lg">Apply</Button>
            </div>
            {couponMessage ? <p className="mt-3 text-sm text-muted">{couponMessage}</p> : null}
            <div className="mt-6 flex items-end justify-between border-t border-line pt-5">
              <span className="text-muted">Total</span>
              <strong className="text-4xl text-accent">{formatCurrency(quote.totalAmount)}</strong>
            </div>
            <Button type="button" onClick={startCheckout} className="mt-6 w-full rounded-lg text-base">
              Confirm & Pay
            </Button>
            <p className="mt-3 text-center text-xs font-bold uppercase tracking-[0.2em] text-muted">Secure checkout</p>
          </Card>
        </aside>
      </div>

      {auth.step !== "closed" ? (
        <AuthFlow
          auth={auth}
          setAuth={setAuth}
          hold={hold}
          fullTime={fullTime}
          quote={quote}
          waiver={waiver}
          setWaiver={setWaiver}
          paid={paid}
          submitName={submitName}
          submitPhone={submitPhone}
          submitOtp={submitOtp}
          confirmPayment={confirmPayment}
        />
      ) : null}
    </main>
  );
}

function AuthFlow({
  auth,
  setAuth,
  hold,
  fullTime,
  quote,
  waiver,
  setWaiver,
  submitName,
  submitPhone,
  submitOtp,
  confirmPayment,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-background/85 backdrop-blur-sm md:items-center md:justify-center">
      <div className="w-full rounded-t-3xl border-t border-line bg-surface-high p-6 shadow-2xl md:max-w-md md:rounded-3xl md:border">
        <button
          type="button"
          onClick={() => setAuth(initialAuth)}
          className="mx-auto mb-6 block h-1.5 w-12 rounded-full bg-muted/30 md:hidden"
          aria-label="Close checkout"
        />

        {auth.step === "name" ? (
          <form onSubmit={submitName} className="space-y-5">
            <h2 className="text-center text-4xl font-black">Almost there!</h2>
            <p className="text-center text-muted">Tell us your name to finish your booking.</p>
            <label className="block text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Full Name
              <input
                value={auth.name}
                onChange={(event) => setAuth((current) => ({ ...current, name: event.target.value, error: "" }))}
                placeholder="Enter your full name"
                className="mt-2 w-full rounded-lg border border-line bg-background px-4 py-4 text-base normal-case tracking-normal text-foreground"
              />
            </label>
            <FlowError message={auth.error} />
            <Button className="w-full" type="submit">Next -&gt;</Button>
          </form>
        ) : null}

        {auth.step === "phone" ? (
          <form onSubmit={submitPhone} className="space-y-5">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-sm font-black text-accent">OTP</div>
            <h2 className="text-center text-3xl font-black">Verify to Book</h2>
            <p className="text-center text-muted">Enter your phone number to receive a 6-digit code.</p>
            <div className="flex overflow-hidden rounded-lg border border-line bg-background">
              <span className="flex items-center gap-2 border-r border-line px-4 font-bold text-muted">IN +91</span>
              <input
                value={auth.phone}
                onChange={(event) => setAuth((current) => ({ ...current, phone: event.target.value, error: "" }))}
                placeholder="98765 43210"
                inputMode="tel"
                className="min-w-0 flex-1 bg-transparent px-4 py-4"
              />
            </div>
            <FlowError message={auth.error} />
            <Button className="w-full rounded-lg" type="submit">Send OTP -&gt;</Button>
          </form>
        ) : null}

        {auth.step === "otp" ? (
          <form onSubmit={submitOtp} className="space-y-5">
            <h2 className="text-center text-3xl font-black">Enter Code</h2>
            <p className="text-center text-muted">Sent to {auth.phone}. Demo OTP: 482913</p>
            <input
              value={auth.otp}
              onChange={(event) => setAuth((current) => ({ ...current, otp: event.target.value, error: "" }))}
              placeholder="482913"
              inputMode="numeric"
              maxLength={6}
              className="w-full rounded-lg border border-line bg-background px-4 py-4 text-center text-3xl font-black tracking-[0.35em]"
            />
            <button type="button" onClick={() => setAuth((current) => ({ ...current, error: "Code resent. Use 482913." }))} className="mx-auto block text-sm font-bold text-accent">
              Resend Code
            </button>
            <FlowError message={auth.error} />
            <Button className="w-full rounded-lg" type="submit">Verify OTP</Button>
          </form>
        ) : null}

        {auth.step === "waiver" ? (
          <div className="space-y-5">
            <h2 className="text-3xl font-black">Confirm & Pay</h2>
            <Card className="p-4 text-sm">
              <p className="font-bold">Booking hold active</p>
              <p className="mt-1 text-muted">Expires at {new Date(hold.expiresAt).toLocaleTimeString("en-IN")}</p>
              <p className="mt-3 text-muted">{fullTime}</p>
              <p className="mt-3 text-2xl font-black text-accent">{formatCurrency(quote.totalAmount)}</p>
            </Card>
            <label className="flex gap-3 text-sm text-muted">
              <input type="checkbox" checked={waiver.time} onChange={(event) => setWaiver((current) => ({ ...current, time: event.target.checked }))} />
              I confirm this booking is for {fullTime} and understand it is non-refundable.
            </label>
            <label className="flex gap-3 text-sm text-muted">
              <input type="checkbox" checked={waiver.policy} onChange={(event) => setWaiver((current) => ({ ...current, policy: event.target.checked }))} />
              I accept the Terms & Conditions and Liability Waiver.
            </label>
            <Button type="button" disabled={!waiver.time || !waiver.policy} onClick={confirmPayment} className="w-full rounded-lg">
              Pay {formatCurrency(quote.totalAmount)}
            </Button>
          </div>
        ) : null}

        {auth.step === "success" ? (
          <div className="space-y-5 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-3xl text-black">OK</div>
            <h2 className="text-4xl font-black">You are booked!</h2>
            <p className="text-muted">A WhatsApp confirmation and receipt would be sent after the payment webhook confirms the transaction.</p>
            <Button href="/booking/confirmed" className="w-full">View Confirmation</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FlowError({ message }) {
  if (!message) return null;
  return <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{message}</p>;
}
