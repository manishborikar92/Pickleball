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

export function calculateQuote({
  courtFee,
  equipmentFee = 0,
  serviceFee = 0,
  taxRate = 0,
  coupon,
  creditsApplied = 0,
}) {
  const subtotal = Number(courtFee) + Number(equipmentFee) + Number(serviceFee);
  let discountAmount = 0;

  if (coupon?.discountType === "flat") {
    discountAmount = Math.min(Number(coupon.value), subtotal);
  }

  if (coupon?.discountType === "percentage") {
    discountAmount = subtotal * (Number(coupon.value) / 100);
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const appliedCredits = Math.min(Number(creditsApplied || 0), afterDiscount);
  const taxableAmount = Math.max(0, afterDiscount - appliedCredits);
  const taxAmount = Number((taxableAmount * Number(taxRate || 0)).toFixed(2));
  const totalAmount = Number((taxableAmount + taxAmount).toFixed(2));

  return {
    subtotal,
    discountAmount: Number(discountAmount.toFixed(2)),
    creditsApplied: Number(appliedCredits.toFixed(2)),
    taxAmount,
    totalAmount,
    breakdown: [
      { label: "Court Fee", amount: Number(courtFee) },
      { label: "Equipment Rental", amount: Number(equipmentFee) },
      { label: "Service Fee", amount: Number(serviceFee) },
    ],
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
