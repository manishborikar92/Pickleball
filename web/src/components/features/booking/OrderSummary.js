import { Button } from "@/components/shared";
import { Card } from "@/components/shared";
import { formatCurrency } from "@/lib/booking-engine";
import { Tag, Lock, ShieldCheck, CalendarDays } from "lucide-react";

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
  couponCode,
  couponMessage,
  onCouponCodeChange,
  onApplyCoupon,
  onCheckout,
}) {
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
            quote={quote}
          />
        )}

        {/* Promo code */}
        <CouponInput
          couponCode={couponCode}
          couponMessage={couponMessage}
          onChange={onCouponCodeChange}
          onApply={onApplyCoupon}
        />

        {/* Grand total */}
        <TotalRow totalAmount={quote.totalAmount} />

        {/* CTA + trust signals */}
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            onClick={onCheckout}
            disabled={!hasSelection}
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

function BookingItems({ selectedCourtsData, selectedDate, quote }) {
  return (
    <div className="space-y-2">
      {/* Per-court booking cards */}
      {selectedCourtsData.map(({ courtId, courtName, slots }) => {
        const startTime = slots[0]?.startTime;
        const endTime = slots[slots.length - 1]?.endTime;
        const slotCount = slots.length;
        const durationMins = slotCount * 30;
        const courtTotal = slots.reduce(
          (sum, s) => sum + Number(s.price || 0),
          0,
        );

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

      {/* Discount — only when a coupon is applied */}
      {quote.discountAmount > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-xl bg-accent/10 px-4 py-2.5 text-sm font-semibold text-accent">
          <span>Discount applied</span>
          <span>−{formatCurrency(quote.discountAmount)}</span>
        </div>
      )}

      {/* Service fee — only when non-zero */}
      {quote.breakdown
        .filter((item) => item.label === "Service Fee" && item.amount > 0)
        .map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-4 px-1 text-sm text-muted"
          >
            <span>{item.label}</span>
            <span>{formatCurrency(item.amount)}</span>
          </div>
        ))}

      {/* Tax — only when non-zero */}
      {quote.taxAmount > 0 && (
        <div className="flex items-center justify-between gap-4 px-1 text-sm text-muted">
          <span>Tax (18%)</span>
          <span>{formatCurrency(quote.taxAmount)}</span>
        </div>
      )}
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

function TotalRow({ totalAmount }) {
  return (
    <div className="flex items-center justify-between border-t border-line/40 pt-5">
      <span className="text-base font-bold text-muted">Total</span>
      <strong className="text-3xl font-black text-accent sm:text-4xl">
        {formatCurrency(totalAmount)}
      </strong>
    </div>
  );
}