import { Button } from "@/components/shared";
import { Card } from "@/components/shared";
import { formatCurrency } from "@/lib/booking-engine";
import { Tag, Lock } from "lucide-react";

export function OrderSummary({
  selectedCourt,
  selected,
  quote,
  couponCode,
  couponMessage,
  onCouponCodeChange,
  onApplyCoupon,
  onCheckout,
}) {
  return (
    <Card className="flex flex-col p-5 shadow-lg sm:p-6 lg:p-7">
      <h3 className="text-xl font-black sm:text-2xl">Order Summary</h3>

      <LineItems selectedCourt={selectedCourt} selected={selected} quote={quote} />

      <CouponInput
        couponCode={couponCode}
        couponMessage={couponMessage}
        onChange={onCouponCodeChange}
        onApply={onApplyCoupon}
      />

      <TotalRow totalAmount={quote.totalAmount} />

      <div className="mt-6 flex flex-col gap-3">
        <Button
          type="button"
          onClick={onCheckout}
          className="w-full py-4 text-base font-bold shadow-md"
        >
          Confirm &amp; Pay
        </Button>
        <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-muted">
          <Lock className="h-3 w-3" />
          Secure checkout
        </p>
      </div>
    </Card>
  );
}

function LineItems({ selectedCourt, selected, quote }) {
  return (
    <div className="mt-5 space-y-3.5 text-sm sm:mt-6 sm:text-base">
      <LineItem
        label={`${selectedCourt?.name || "Court"} (${selected?.startTime || "--"})`}
        value={formatCurrency(selected?.price || 0)}
      />
      <LineItem label="Equipment Rental" value={formatCurrency(100)} />
      <LineItem label="Service Fee" value={formatCurrency(40)} />
      {quote.discountAmount ? (
        <div className="flex items-center justify-between gap-4 font-medium text-accent">
          <span>Discount</span>
          <span>-{formatCurrency(quote.discountAmount)}</span>
        </div>
      ) : null}
      <LineItem label="Tax (18%)" value={formatCurrency(quote.taxAmount)} />
    </div>
  );
}

function LineItem({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function CouponInput({ couponCode, couponMessage, onChange, onApply }) {
  return (
    <div className="mt-5 border-t border-line pt-5 sm:mt-6 sm:pt-6">
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
        <p className="mt-2 text-sm font-medium text-accent">
          {couponMessage}
        </p>
      )}
    </div>
  );
}

function TotalRow({ totalAmount }) {
  return (
    <div className="mt-5 flex items-end justify-between border-t border-line pt-5 sm:mt-6 sm:pt-6">
      <span className="text-base font-bold text-muted">Total</span>
      <strong className="text-3xl font-black text-accent sm:text-4xl">
        {formatCurrency(totalAmount)}
      </strong>
    </div>
  );
}