import Link from "next/link";
import { Button } from "@/components/shared";
import { Card } from "@/components/shared";
import { formatCurrency } from "@/lib/bookingEngine";
import { CheckCircle2, X, Lock, CalendarDays, Clock } from "lucide-react";
import { CustomerCheckoutAuthGate } from "@/components/features/auth";
import { useOverlay } from "@/hooks/useOverlay";

/**
 * Full-screen checkout modal that walks users through auth → waiver → success steps.
 *
 * @param {Object}   props
 * @param {Object}   props.auth               - Current auth step state machine object
 * @param {string}   props.selectedDate       - ISO date string of the selected booking date
 * @param {Array}    props.selectedCourtsData - Active court + slot selections with pricing
 * @param {Object}   props.quote              - Calculated price quote from booking engine
 * @param {Object}   props.waiver             - Current waiver checkbox checked states
 * @param {Function} props.setWaiver          - Waiver state setter
 * @param {Function} props.onAuthSuccess      - Callback when authentication completes
 * @param {Function} props.confirmPayment     - Callback to initiate payment confirmation
 * @param {Function} props.onClose            - Callback to close/dismiss the modal
 */
export function AuthFlow({
  auth,
  selectedDate,
  selectedCourtsData,
  quote,
  waiver,
  setWaiver,
  checkoutError = "",
  checkoutLoading = false,
  confirmedBookingId = "",
  onAuthSuccess,
  confirmPayment,
  onClose,
}) {
  const { containerRef, contentRef, handleBackdropClick } = useOverlay({
    isOpen: auth.step !== "closed",
    onClose,
  });

  return (
    <div
      ref={containerRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-background/80 backdrop-blur-md animate-overlay-fade-in md:items-center md:justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Booking checkout"
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className="relative flex max-h-[90dvh] w-full flex-col rounded-t-3xl border-t border-line bg-surface-high shadow-2xl animate-modal-slide-up focus:outline-none md:max-h-[85vh] md:max-w-md md:rounded-3xl md:border md:animate-modal-scale-in"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-panel hover:text-foreground focus-visible:bg-surface-panel focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Close checkout"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Drag handle — mobile only */}
        <div className="flex shrink-0 items-center justify-center pb-2 pt-4 md:hidden">
          <button
            type="button"
            onClick={onClose}
            className="h-1.5 w-12 rounded-full bg-muted/30 transition-colors hover:bg-muted/50"
            aria-label="Close checkout"
          />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-5 pb-safe pt-12 sm:p-6 sm:pt-14">
          {["phone", "otp", "name"].includes(auth.step) && (
            <CustomerCheckoutAuthGate
              inline={true}
              onSuccess={onAuthSuccess}
              showStaffLoginLink={false}
              initialPhone={auth.phone}
              initialStep={auth.step}
            />
          )}
          {auth.step === "waiver" && (
            <WaiverStep
              selectedDate={selectedDate}
              selectedCourtsData={selectedCourtsData}
              quote={quote}
              waiver={waiver}
              setWaiver={setWaiver}
              checkoutError={checkoutError}
              checkoutLoading={checkoutLoading}
              onConfirm={confirmPayment}
            />
          )}
          {auth.step === "success" && <SuccessStep bookingId={confirmedBookingId} />}
        </div>
      </div>
    </div>
  );
}

/* ── Steps ──────────────────────────────────────── */

/**
 * Final confirmation step: shows a clean booking summary card with court, date,
 * time, and total — plus the liability waiver checkbox and pay CTA.
 *
 * @param {Object}   props
 * @param {string}   props.selectedDate        - ISO date of booking
 * @param {Array}    props.selectedCourtsData  - Courts with slots and pricing
 * @param {Object}   props.quote               - Price quote from booking engine
 * @param {Object}   props.waiver              - Checked state for waiver fields
 * @param {Function} props.setWaiver           - Waiver setter
 * @param {Function} props.onConfirm           - Payment confirmation callback
 */
function WaiverStep({
  selectedDate,
  selectedCourtsData,
  quote,
  waiver,
  setWaiver,
  checkoutError,
  checkoutLoading,
  onConfirm,
}) {
  const allChecked = waiver?.time && waiver?.policy;
  const courts = selectedCourtsData ?? [];

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-accent">
          Almost there
        </p>
        <h2 className="mt-1 text-2xl font-black sm:text-3xl">
          Confirm Booking
        </h2>
      </div>

      {/* Booking summary card */}
      <div className="overflow-hidden rounded-2xl border border-line/40 bg-surface/30">
        {/* Date row */}
        <div className="flex items-center gap-2.5 border-b border-line/30 bg-surface/60 px-4 py-3">
          <CalendarDays className="h-4 w-4 shrink-0 text-accent" />
          <p className="font-semibold text-foreground">{selectedDate}</p>
        </div>

        {/* Per-court rows */}
        <div className="divide-y divide-line/20">
          {courts.map(({ courtId, courtName, slots }) => {
            const startTime = slots[0]?.startTime;
            const endTime = slots[slots.length - 1]?.endTime;
            const slotCount = slots.length;
            const durationMins = slotCount * 60;
            const courtTotal = slots.reduce(
              (sum, s) => sum + Number(s.price || 0),
              0,
            );

            return (
              <div
                key={courtId}
                className="flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{courtName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Clock className="h-3 w-3 shrink-0" />
                    {startTime}–{endTime} · {durationMins} min
                  </p>
                </div>
                <span className="shrink-0 font-bold text-foreground">
                  {formatCurrency(courtTotal)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Discount row — only when applied */}
        {(quote?.discountAmount ?? 0) > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-line/30 bg-accent/5 px-4 py-3 text-sm font-semibold text-accent">
            <span>Discount applied</span>
            <span>−{formatCurrency(quote.discountAmount)}</span>
          </div>
        )}

        {/* Total due */}
        <div className="flex items-center justify-between gap-4 border-t border-line/40 bg-surface/50 px-4 py-3.5">
          <span className="text-sm font-semibold text-muted">Total due</span>
          <strong className="text-2xl font-black text-accent">
            {formatCurrency(quote?.totalAmount ?? 0)}
          </strong>
        </div>
      </div>

      {/* Waiver checkbox */}
      <WaiverCheckbox
        checked={allChecked || false}
        onChange={(v) => setWaiver({ time: v, policy: v })}
        label={
          <span>
            I agree to the{" "}
            <Link
              href="/terms"
              target="_blank"
              className="font-semibold text-accent underline hover:text-accent-dim focus-visible:outline-none"
            >
              Terms of Service &amp; Liability Waiver
            </Link>{" "}
            and acknowledge the strict{" "}
            <span className="font-semibold text-accent">
              non-refundable policy
            </span>
            .
          </span>
        }
      />

      {/* Pay CTA */}
      <Button
        type="button"
        disabled={!allChecked || checkoutLoading}
        onClick={onConfirm}
        className="w-full py-4 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checkoutLoading ? "Confirming..." : `Pay ${formatCurrency(quote?.totalAmount ?? 0)}`}
      </Button>

      {checkoutError && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-sm font-semibold text-red-200">
          {checkoutError}
        </p>
      )}

      {/* Trust signal */}
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
        <Lock className="h-3 w-3" />
        Payments secured via PhonePe UPI
      </p>
    </div>
  );
}

function SuccessStep({ bookingId }) {
  return (
    <div className="space-y-5 py-6 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent text-black">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <h2 className="text-3xl font-black sm:text-4xl">You are booked!</h2>
      <p className="text-sm leading-relaxed text-muted sm:text-base">
        A WhatsApp confirmation and receipt will be sent after the payment
        webhook confirms the transaction.
      </p>
      <Button href={`/booking/confirmed${bookingId ? `?bookingId=${bookingId}` : ""}`} className="mt-2 w-full py-4 text-base">
        View Confirmation
      </Button>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────── */

/**
 * Custom styled accessible checkbox with animated checkmark and focus ring.
 *
 * @param {Object}    props
 * @param {boolean}   props.checked   - Current checked state
 * @param {Function}  props.onChange  - Called with new boolean value on change
 * @param {ReactNode} props.label     - Label content (may contain JSX links)
 */
function WaiverCheckbox({ checked, onChange, label }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line/30 bg-surface/30 p-3 transition-all hover:border-line/60 hover:bg-surface/60 focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-background">
      <div className="relative mt-0.5 flex shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${
            checked ? "border-accent bg-accent" : "border-line bg-surface-panel"
          }`}
        >
          {checked && (
            <svg
              className="h-3 w-3 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="3.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      </div>
      <span className="select-none text-sm leading-snug text-muted">
        {label}
      </span>
    </label>
  );
}
