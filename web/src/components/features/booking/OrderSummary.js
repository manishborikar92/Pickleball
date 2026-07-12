import { Button, Card } from "@/components/shared";
import { formatCurrency, getCheckoutBreakdown, summarizeCourtSlots } from "@/lib/bookingEngine";
import { Tag, Lock, ShieldCheck, CalendarDays, Wallet } from "lucide-react";

/**
 * Sticky booking summary panel displayed in the right column of the booking page.
 * Shows per-court selections with pricing, optional discount, grand total,
 * a promo-code input, and the primary checkout CTA.
 *
 * @param {Object}   props
 * @param {Array}    props.selectedCourtsData  - Active court + slot selections with pricing
 * @param {string}   props.selectedDate        - ISO date string of the selected booking date
 * @param {boolean}  props.hasSelection        - Whether any valid court+slot pair is selected
 * @param {Object}   props.quote               - Calculated price breakdown from booking engine
 * @param {number}   props.walletBalance       - Signed-in user's wallet credits (0 when anonymous)
 * @param {string}   props.couponCode          - Current promo code input value
 * @param {string}   props.couponMessage       - Feedback message after applying a promo code
 * @param {Function} props.onCouponCodeChange  - Handler for promo code input changes
 * @param {Function} props.onApplyCoupon       - Handler to apply the entered promo code
 * @param {Function} props.onCheckout          - Handler to initiate the checkout auth flow
 */
export function OrderSummary({
  selectedCourtsData,
  selectedDate,
  hasSelection,
  quote,
  walletBalance = 0,
  couponCode,
  couponMessage,
  quoteError = "",
  canCheckout = hasSelection,
  onCouponCodeChange,
  onApplyCoupon,
  onCheckout,
}) {
  const breakdown = getCheckoutBreakdown(quote, walletBalance);

  return (
    <Card className="flex flex-col overflow-hidden p-0 shadow-xl">
      {/* Panel header */}
      <div className="border-b border-line/40 px-5 py-4 sm:px-6">
        <h3 className="text-lg font-bold text-foreground">Booking Summary</h3>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* Selection state */}
        {!hasSelection ? (
          <EmptyState />
        ) : (
          <BookingItems
            selectedCourtsData={selectedCourtsData}
            selectedDate={selectedDate}
          />
        )}

        {/* Promo code */}
        <CouponInput
          couponCode={couponCode}
          couponMessage={couponMessage}
          onChange={onCouponCodeChange}
          onApply={onApplyCoupon}
        />

        {quoteError && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
            {quoteError}
          </p>
        )}

        {/* Itemized total: subtotal → promo → tax → wallet → amount payable */}
        <PaymentSummary breakdown={breakdown} />

        {/* CTA + trust signals */}
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            onClick={onCheckout}
            disabled={!canCheckout}
            className="w-full py-4 text-base font-bold shadow-md disabled:opacity-50"
          >
            Proceed to Pay
          </Button>
          <div className="flex items-center justify-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              UPI payments only
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Sub-components ─────────────────────────────── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line/50 bg-surface/20 py-8 text-center">
      <CalendarDays className="h-8 w-8 text-muted/40" />
      <p className="text-sm leading-snug text-muted">
        Select a court and time slot to see your booking summary.
      </p>
    </div>
  );
}

function BookingItems({ selectedCourtsData, selectedDate }) {
  return (
    <div className="space-y-2">
      {/* Per-court booking cards */}
      {selectedCourtsData.map(({ courtId, courtName, slots }) => {
        const { startTime, endTime, slotCount, durationMins, courtTotal } =
          summarizeCourtSlots(slots);

        return (
          <div
            key={courtId}
            className="flex items-start justify-between gap-3 rounded-xl bg-surface/50 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {courtName}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {selectedDate} · {startTime}–{endTime}
              </p>
              <p className="mt-0.5 text-xs text-muted/60">
                {slotCount} slot{slotCount > 1 ? "s" : ""} · {durationMins} min
              </p>
            </div>
            <span className="shrink-0 font-bold text-foreground">
              {formatCurrency(courtTotal)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CouponInput({ couponCode, couponMessage, onChange, onApply }) {
  return (
    <div className="border-t border-line/40 pt-5">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Tag className="h-4 w-4 text-muted" />
          </div>
          <input
            value={couponCode}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Promo code"
            className="w-full rounded-lg border border-line bg-background py-3 pl-9 pr-4 text-[16px] shadow-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            aria-label="Enter promo code"
          />
        </div>
        <Button
          type="button"
          onClick={onApply}
          variant="secondary"
          className="shrink-0 rounded-lg px-5 font-bold"
        >
          Apply
        </Button>
      </div>
      {couponMessage && (
        <p className="mt-2 text-sm font-medium text-accent">{couponMessage}</p>
      )}
    </div>
  );
}

/**
 * Itemized payment breakdown: shows the running total (subtotal → promo → tax →
 * order total → wallet) and, as the hero figure, the amount actually payable via
 * UPI. Adjustment lines only render when there is something to adjust, so a plain
 * cash booking still shows a single clean total.
 */
function PaymentSummary({ breakdown }) {
  const {
    subtotal,
    discountAmount,
    taxAmount,
    totalAmount,
    walletApplied,
    amountPayable,
    hasAdjustments,
    isWalletOnly,
  } = breakdown;

  const payableSubtext = isWalletOnly
    ? "Fully paid from wallet credits"
    : amountPayable > 0
      ? "Payable via UPI"
      : "";

  return (
    <div className="border-t border-line/40 pt-5">
      {hasAdjustments && (
        <dl className="mb-4 space-y-2.5">
          <SummaryLine label="Subtotal" value={formatCurrency(subtotal)} />
          {discountAmount > 0 && (
            <SummaryLine
              label={
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Promo discount
                </span>
              }
              value={`−${formatCurrency(discountAmount)}`}
              accent
            />
          )}
          {taxAmount > 0 && <SummaryLine label="Tax" value={formatCurrency(taxAmount)} />}
          {walletApplied > 0 && (
            <>
              <SummaryLine
                label="Order total"
                value={formatCurrency(totalAmount)}
                className="border-t border-line/30 pt-2.5 font-semibold text-foreground"
              />
              <SummaryLine
                label={
                  <span className="flex items-center gap-1.5">
                    <Wallet className="h-3.5 w-3.5" />
                    Wallet credits
                  </span>
                }
                value={`−${formatCurrency(walletApplied)}`}
                accent
              />
            </>
          )}
        </dl>
      )}

      <div className="flex items-end justify-between border-t border-line/40 pt-4">
        <div>
          <span className="text-base font-bold text-muted">To pay</span>
          {payableSubtext && (
            <p className="mt-0.5 text-xs font-medium text-muted/70">{payableSubtext}</p>
          )}
        </div>
        <strong className="text-3xl font-black text-accent sm:text-4xl">
          {formatCurrency(amountPayable)}
        </strong>
      </div>
    </div>
  );
}

function SummaryLine({ label, value, accent = false, className = "" }) {
  return (
    <div className={`flex items-center justify-between gap-4 text-sm ${className}`}>
      <dt className={accent ? "font-semibold text-accent" : "text-muted"}>{label}</dt>
      <dd className={accent ? "font-semibold text-accent" : "font-medium text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
