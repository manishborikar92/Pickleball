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
