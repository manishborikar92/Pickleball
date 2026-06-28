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
    const [weekday, day, month] = dateFormatter.format(date).split(" ");

    return {
      iso,
      weekday: weekday.replace(",", "").toUpperCase(),
      day,
      month: month.toUpperCase(),
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

export function getPaymentReceiptDetails(booking) {
  const totalAmount = Number(booking.total_amount || booking.totalAmount || 0);
  const creditsApplied = Number(booking.credits_applied || booking.creditsApplied || 0);
  const taxAmount = Number(booking.tax_amount || booking.taxAmount || 0);
  const upiAmount = totalAmount - creditsApplied;

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

export function getTodayDateString(timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
