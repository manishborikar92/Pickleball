import Link from "next/link";
import { Button } from "@/components/shared";
import { formatCountdown, formatCurrency, getCheckoutBreakdown, summarizeCourtSlots } from "@/lib/bookingEngine";
import { formatTime12Hour } from "@/lib/formatters";
import { X, Lock, CalendarDays, Clock, Wallet, Tag, TimerReset } from "lucide-react";
import { CustomerCheckoutAuthGate } from "@/components/features/auth";
import { useOverlay } from "@/hooks/useOverlay";

/**
 * Full-screen checkout modal that walks users through auth → waiver → success steps.
 *
 * Checkout is commit-on-confirm: the waiver step opens instantly with the live
 * price preview and reserves nothing. Once Confirm & Pay commits the booking
 * (hold + payment initiation), a live countdown shows the remaining 10-minute
 * payment window, and an expired window renders a dedicated panel that routes
 * the user back to the slot grid.
 *
 * @param {Object}   props
 * @param {Object}   props.auth                 - Current auth step state machine object
 * @param {string}   props.selectedDate         - ISO date string of the selected booking date
 * @param {Array}    props.selectedCourtsData   - Active court + slot selections with pricing
 * @param {Object}   props.quote                - Calculated price quote from booking engine
 * @param {number}   props.walletBalance        - Signed-in user's wallet credits (0 when anonymous)
 * @param {Object}   props.waiver               - Current waiver checkbox checked states
 * @param {Function} props.setWaiver            - Waiver state setter
 * @param {Object}   props.hold                 - Hold state machine: { status, bookingId, expiresAt }
 * @param {number}   props.holdRemainingSeconds - Live seconds left on the active hold
 * @param {Function} props.onAuthSuccess        - Callback when authentication completes
 * @param {Function} props.confirmPayment       - Callback to commit/resume payment
 * @param {Function} props.onReturnToGrid       - Callback to release checkout state and reselect
 * @param {Function} props.onClose              - Callback to close/dismiss the modal
 */
export function AuthFlow({
  auth,
  selectedDate,
  selectedCourtsData,
  quote,
  walletBalance = 0,
  waiver,
  setWaiver,
  hold,
  holdRemainingSeconds = 0,
  checkoutError = "",
  checkoutLoading = false,
  onAuthSuccess,
  confirmPayment,
  onReturnToGrid,
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
        <div className="overflow-y-auto hide-scrollbar p-5 pb-safe pt-12 sm:p-6 sm:pt-14">
          {["phone", "otp", "name"].includes(auth.step) && (
            <CustomerCheckoutAuthGate
              inline={true}
              onSuccess={onAuthSuccess}
              showAdminLoginLink={false}
              initialPhone={auth.phone}
              initialStep={auth.step}
            />
          )}
          {auth.step === "waiver" && (
            <WaiverStep
              selectedDate={selectedDate}
              selectedCourtsData={selectedCourtsData}
              quote={quote}
              walletBalance={walletBalance}
              waiver={waiver}
              setWaiver={setWaiver}
              hold={hold}
              holdRemainingSeconds={holdRemainingSeconds}
              checkoutError={checkoutError}
              checkoutLoading={checkoutLoading}
              onConfirm={confirmPayment}
              onReturnToGrid={onReturnToGrid}
            />
          )}
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
 * Before commit nothing is reserved, so the step renders instantly from the
 * live price preview. After commit (active hold) the live countdown shows the
 * remaining payment window; an expired window replaces the step with a release
 * panel that returns the user to the grid.
 *
 * @param {Object}   props
 * @param {string}   props.selectedDate         - ISO date of booking
 * @param {Array}    props.selectedCourtsData   - Courts with slots and pricing
 * @param {Object}   props.quote                - Price quote from booking engine
 * @param {Object}   props.waiver               - Checked state for waiver fields
 * @param {Function} props.setWaiver            - Waiver setter
 * @param {Object}   props.hold                 - Hold state machine object
 * @param {number}   props.holdRemainingSeconds - Live seconds left on the hold
 * @param {Function} props.onConfirm            - Commit/resume payment callback
 * @param {Function} props.onReturnToGrid       - Release checkout state and reselect
 */
function WaiverStep({
  selectedDate,
  selectedCourtsData,
  quote,
  walletBalance = 0,
  waiver,
  setWaiver,
  hold,
  holdRemainingSeconds,
  checkoutError,
  checkoutLoading,
  onConfirm,
  onReturnToGrid,
}) {
  const allChecked = waiver?.time && waiver?.policy;
  const courts = selectedCourtsData ?? [];
  const breakdown = getCheckoutBreakdown(quote, walletBalance);

  if (hold?.status === "expired") {
    return (
      <HoldEndedPanel
        title="Your payment window has expired"
        message="The 10-minute payment window ran out, so your slots were released. Please reselect a time that works for you."
        actionLabel="Back to slot selection"
        onAction={onReturnToGrid}
      />
    );
  }

  const holdActive = hold?.status === "active";

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

      {holdActive && <HoldCountdown remainingSeconds={holdRemainingSeconds} />}

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
            const { startTime, endTime, durationMins, courtTotal } =
              summarizeCourtSlots(slots);

            return (
              <div
                key={courtId}
                className="flex items-center justify-between gap-4 px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{courtName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <Clock className="h-3 w-3 shrink-0" />
                    {formatTime12Hour(startTime)}–{formatTime12Hour(endTime)} · {durationMins} min
                  </p>
                </div>
                <span className="shrink-0 font-bold text-foreground">
                  {formatCurrency(courtTotal)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Promo discount — only when applied */}
        {breakdown.discountAmount > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-line/30 bg-accent/5 px-4 py-3 text-sm font-semibold text-accent">
            <span className="flex items-center gap-1.5">
              <Tag className="h-4 w-4" />
              Promo discount
            </span>
            <span>−{formatCurrency(breakdown.discountAmount)}</span>
          </div>
        )}

        {/* Wallet credits — only when the signed-in user has credits to apply */}
        {breakdown.walletApplied > 0 && (
          <div className="flex items-center justify-between gap-4 border-t border-line/30 bg-accent/5 px-4 py-3 text-sm font-semibold text-accent">
            <span className="flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              Wallet credits
            </span>
            <span>−{formatCurrency(breakdown.walletApplied)}</span>
          </div>
        )}

        {/* Amount payable via UPI (order total shown above it when wallet applies) */}
        <div className="border-t border-line/40 bg-surface/50 px-4 py-3.5">
          {breakdown.walletApplied > 0 && (
            <div className="mb-1.5 flex items-center justify-between gap-4 text-xs text-muted">
              <span>Order total</span>
              <span>{formatCurrency(breakdown.totalAmount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm font-semibold text-muted">
              To pay
            </span>
            <strong className="text-2xl font-black text-accent">
              {formatCurrency(breakdown.amountPayable)}
            </strong>
          </div>
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

      {/* Pay CTA — commits the booking (reserve + pay) on first click; with an
          active hold it resumes the same payment instead */}
      <Button
        type="button"
        disabled={!allChecked || checkoutLoading}
        onClick={onConfirm}
        className="w-full py-4 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checkoutLoading
          ? "Reserving & confirming..."
          : breakdown.amountPayable > 0
            ? `Pay ${formatCurrency(breakdown.amountPayable)}`
            : "Confirm booking"}
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


/* ── Helpers ──────────────────────────────────────── */

/**
 * The live payment-window countdown pill, shown once the booking is committed
 * (slots reserved, payment initiated). Counts down the 10-minute window,
 * switching to the danger tone for the final minute. The `role="timer"` label
 * announces at minute granularity rather than every second.
 *
 * @param {Object}  props
 * @param {number}  props.remainingSeconds - Seconds left on the payment window
 */
function HoldCountdown({ remainingSeconds }) {
  const urgent = remainingSeconds <= 60;

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
        urgent
          ? "border-red-500/40 bg-red-500/10"
          : "border-accent/30 bg-accent/5"
      }`}
    >
      <span
        className={`flex min-w-0 items-center gap-2 text-sm font-semibold ${
          urgent ? "text-red-200" : "text-foreground"
        }`}
      >
        <TimerReset className={`h-4 w-4 shrink-0 ${urgent ? "text-red-300" : "text-accent"}`} aria-hidden="true" />
        Slots reserved for you
      </span>
      <span
        role="timer"
        aria-label={`${Math.ceil(remainingSeconds / 60)} minutes remaining to complete payment`}
        className={`shrink-0 font-mono text-lg font-black tabular-nums ${
          urgent ? "text-red-300" : "text-accent"
        }`}
      >
        {formatCountdown(remainingSeconds)}
      </span>
    </div>
  );
}

/**
 * Terminal hold panel (expired payment window): explains what happened and
 * routes the user back to the grid to reselect.
 *
 * @param {Object}   props
 * @param {string}   props.title
 * @param {string}   props.message
 * @param {string}   props.actionLabel
 * @param {Function} props.onAction
 * @param {string}   [props.secondaryLabel]
 * @param {Function} [props.onSecondaryAction]
 */
function HoldEndedPanel({ title, message, actionLabel, onAction, secondaryLabel, onSecondaryAction }) {
  return (
    <div className="space-y-5 py-4 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line/40 bg-surface/50">
        <TimerReset className="h-7 w-7 text-muted" />
      </div>
      <div role="alert">
        <h2 className="text-2xl font-black">{title}</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {message}
        </p>
      </div>
      <div className="space-y-3">
        <Button
          type="button"
          onClick={onAction}
          className="w-full py-4 text-base font-bold"
        >
          {actionLabel}
        </Button>
        {secondaryLabel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onSecondaryAction}
            className="w-full py-3 text-sm font-bold"
          >
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

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
