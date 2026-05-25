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

/**
 * Calculate a price quote for multiple selected courts and a time range.
 * @param {Object} params
 * @param {Array<{courtId: string, courtName: string, slots: Array}>} params.selectedCourts - each entry has courtId + selected slot range
 * @param {Object|null} params.coupon
 */
export function calculateMultiQuote({
  selectedCourts = [],
  coupon = null,
}) {
  // Sum all slot prices across all selected courts
  const courtFee = selectedCourts.reduce((total, { slots }) => {
    return total + slots.reduce((sum, slot) => sum + Number(slot.price || 0), 0);
  }, 0);

  const subtotal = courtFee;
  let discountAmount = 0;

  if (coupon?.discountType === "flat") {
    discountAmount = Math.min(Number(coupon.value), subtotal);
  }
  if (coupon?.discountType === "percentage") {
    discountAmount = subtotal * (Number(coupon.value) / 100);
  }

  const totalAmount = Math.max(0, subtotal - discountAmount);

  const courtBreakdown = selectedCourts.map(({ courtId, courtName, slots }) => ({
    label: courtName || courtId,
    amount: slots.reduce((s, slot) => s + Number(slot.price || 0), 0),
    slotCount: slots.length,
  }));

  return {
    subtotal,
    courtFee,
    discountAmount: Number(discountAmount.toFixed(2)),
    totalAmount,
    breakdown: courtBreakdown,
  };
}

export function createBookingHold({
  now = new Date(),
  venueId,
  courtId,
  slotDate,
  startTime,
  endTime,
  totalAmount,
}) {
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  return {
    id: `hold-${courtId}-${slotDate}-${startTime}`.replace(/[^a-zA-Z0-9-]/g, ""),
    venueId,
    courtId,
    status: "pending_payment",
    expiresAt: expiresAt.toISOString(),
    totalAmount,
    slot: {
      date: slotDate,
      startTime,
      endTime,
      label: `${startTime} - ${endTime}`,
    },
  };
}

export function getCouponByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized === "FIRST50") {
    return { code: normalized, discountType: "flat", value: 50 };
  }
  if (normalized === "BESA100") {
    return { code: normalized, discountType: "flat", value: 100 };
  }
  return null;
}

