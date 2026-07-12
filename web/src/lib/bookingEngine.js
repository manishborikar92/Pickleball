const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Asia/Kolkata",
});

export function formatCurrency(amount) {
  return currencyFormatter.format(Number(amount || 0));
}

export function buildDateWindow({ startDate, advanceBookingDays }) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return Array.from({ length: advanceBookingDays }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const iso = date.toISOString().slice(0, 10);

    // Read named parts rather than splitting the formatted string positionally,
    // which is locale/format fragile (LO-3).
    const parts = dateFormatter.formatToParts(date);
    const partValue = (type) => parts.find((part) => part.type === type)?.value || "";

    return {
      iso,
      weekday: partValue("weekday").replace(",", "").toUpperCase(),
      day: partValue("day"),
      month: partValue("month").toUpperCase(),
    };
  });
}

/**
 * Extract a consecutive range of slots between startTime and endTime (inclusive).
 * Returns [] if the range is invalid or has gaps.
 */
export function getSlotRange(slots, startTime, endTime) {
  const startIdx = slots.findIndex((s) => s.startTime === startTime);
  const endIdx = slots.findIndex((s) => s.endTime === endTime);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return [];
  return slots.slice(startIdx, endIdx + 1);
}

/**
 * Derives the display summary for one court's contiguous slot selection: the
 * session window, slot count, duration, and summed price. Shared by the booking
 * summary panel and the checkout confirm card so the two stay in lock-step.
 *
 * @param {Array<{startTime?: string, endTime?: string, price?: number|string}>} [slots=[]]
 * @returns {{startTime: string|undefined, endTime: string|undefined, slotCount: number, durationMins: number, courtTotal: number}}
 */
export function summarizeCourtSlots(slots = []) {
  const slotCount = slots.length;
  return {
    startTime: slots[0]?.startTime,
    endTime: slots[slotCount - 1]?.endTime,
    slotCount,
    durationMins: slotCount * 60, // one-hour slots
    courtTotal: slots.reduce((sum, slot) => sum + Number(slot.price || 0), 0),
  };
}

export function getPaymentReceiptDetails(booking) {
  const totalAmount = Number(booking.total_amount || booking.totalAmount || 0);
  const creditsApplied = Number(booking.credits_applied || booking.creditsApplied || 0);
  const taxAmount = Number(booking.tax_amount || booking.taxAmount || 0);
  // Clamp so bad data (credits > total) can't produce a negative UPI amount that
  // would misclassify a wallet-only checkout as "mixed" (LO-2).
  const upiAmount = Math.max(0, totalAmount - creditsApplied);

  if (creditsApplied > 0) {
    if (upiAmount === 0) {
      return {
        paymentModeLabel: "Payment Method: Wallet Credits",
        displayAmount: creditsApplied,
        upiAmount,
        creditsApplied,
        totalAmount,
        taxAmount,
        isMixed: false,
        isWalletOnly: true,
      };
    } else {
      return {
        paymentModeLabel: "Payment Method: UPI + Wallet",
        displayAmount: totalAmount,
        upiAmount,
        creditsApplied,
        totalAmount,
        taxAmount,
        isMixed: true,
        isWalletOnly: false,
      };
    }
  }

  return {
    paymentModeLabel: "Payment Method: UPI",
    displayAmount: upiAmount,
    upiAmount,
    creditsApplied,
    totalAmount,
    taxAmount,
    isMixed: false,
    isWalletOnly: false,
  };
}

/**
 * Pre-checkout payment breakdown for the booking summary.
 *
 * Wallet credits are applied server-side at payment initiation (the backend
 * consumes credits up to the order total); this mirrors that `min(balance, total)`
 * split so the summary can show what the user actually pays via UPI versus what
 * comes off their wallet — before the transaction runs. Purely presentational; the
 * authoritative split is recorded on the booking (see `getPaymentReceiptDetails`).
 *
 * `walletBalance` is 0 for anonymous users (unknown until sign-in), so the wallet
 * line simply does not appear until a balance is known.
 *
 * @param {object} [quote={}]              - Server price quote for the selection.
 * @param {number} [quote.subtotal=0]       - Court fees before discount/tax.
 * @param {number} [quote.discountAmount=0] - Promo-code discount.
 * @param {number} [quote.taxAmount=0]      - Tax, when charged.
 * @param {number} [quote.totalAmount=0]    - Order total (after discount + tax).
 * @param {number} [walletBalance=0]        - Available wallet credits (0 when anonymous).
 * @returns {{subtotal:number,discountAmount:number,taxAmount:number,totalAmount:number,walletApplied:number,amountPayable:number,hasAdjustments:boolean,isWalletOnly:boolean}}
 */
export function getCheckoutBreakdown(quote = {}, walletBalance = 0) {
  const {
    subtotal = 0,
    discountAmount = 0,
    taxAmount = 0,
    totalAmount = 0,
  } = quote ?? {};

  const total = Number(totalAmount || 0);
  const discount = Number(discountAmount || 0);
  const tax = Number(taxAmount || 0);
  // Clamp the balance so bad data can't credit more than the order total or push
  // the UPI amount negative (same guard as getPaymentReceiptDetails, LO-2).
  const walletApplied = Math.min(Math.max(0, Number(walletBalance || 0)), total);
  const amountPayable = Math.max(0, total - walletApplied);

  return {
    subtotal: Number(subtotal || 0),
    discountAmount: discount,
    taxAmount: tax,
    totalAmount: total,
    walletApplied,
    amountPayable,
    hasAdjustments: discount > 0 || tax > 0 || walletApplied > 0,
    isWalletOnly: walletApplied > 0 && amountPayable === 0,
  };
}

/**
 * Returns the most recent payment on a normalized booking (by createdAt), or null.
 * A booking can hold several attempts (e.g. failed → retried); the latest one is
 * authoritative for both status classification and order-id display.
 *
 * @param {Object} booking - Normalized booking with a `payments` array.
 * @returns {Object|null}
 */
export function getLatestPayment(booking) {
  const payments = booking?.payments || [];
  if (payments.length === 0) return null;
  return payments
    .slice()
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
}

export function getTodayDateString(timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
