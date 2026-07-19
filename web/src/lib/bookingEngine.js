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
 * The set of slot start times that are "available" on EVERY given court.
 * Powers the shared-window (intersection) highlight on the slot grids: when the
 * user has two or more courts in their session, these are the windows the whole
 * session can occupy or extend into.
 *
 * @param {Array<{courtId: string, slots: Array}>} availabilityData
 * @param {string[]} courtIds - Courts to intersect (order irrelevant).
 * @returns {Set<string>} Start times available on all courts; empty if < 2 courts.
 */
export function getSharedAvailableSlotTimes(availabilityData = [], courtIds = []) {
  const shared = new Set();
  if (courtIds.length < 2) return shared;

  const slotLists = courtIds.map(
    (id) => availabilityData.find((court) => court.courtId === id)?.slots || [],
  );
  const [first, ...rest] = slotLists;

  for (const slot of first) {
    if (slot.status !== "available") continue;
    const onAllCourts = rest.every((slots) =>
      slots.some((s) => s.startTime === slot.startTime && s.status === "available"),
    );
    if (onAllCourts) shared.add(slot.startTime);
  }
  return shared;
}

/**
 * Backend session limits (server-side: bookings.validators.js — Joi caps
 * `slot_start_times` at 12 and `court_ids` at 8). Enforced proactively in the
 * selection reducer so an over-limit selection is refused with a clear notice
 * instead of surfacing later as a generic price-preview failure.
 */
export const MAX_SESSION_SLOTS = 12;
export const MAX_SESSION_COURTS = 8;

/** Whether every slot of a court's `startTime`–`endTime` range is "available". */
function isRangeAvailable(slots, { startTime, endTime }) {
  const range = getSlotRange(slots, startTime, endTime);
  return range.length > 0 && range.every((slot) => slot.status === "available");
}

/** The first given court (by grid order) that is not free for the whole range, or null. */
function findCourtNotFreeForRange(availabilityData, courtIds, range) {
  for (const id of courtIds) {
    const court = availabilityData.find((item) => item.courtId === id);
    if (!court || !isRangeAvailable(court.slots, range)) {
      return { courtId: id, courtName: court?.courtName || "Another court" };
    }
  }
  return null;
}

/**
 * The multi-court selection reducer: a booking is one session — one date, one
 * contiguous time range, shared by every selected court (02-BUSINESS-LOGIC §5.1).
 * The reducer makes an asymmetric selection unrepresentable in the UI:
 *
 *  - First click starts the session range on that court.
 *  - On a selected court: a click inside the range removes that court from the
 *    session (clearing everything if it was the last court); a click outside
 *    the range extends the shared range up to the clicked slot, auto-filling
 *    every slot in between (e.g. 7:00 selected, tap 11:00 → 7:00–12:00) on ALL
 *    selected courts — refused with a notice if any selected court is not free
 *    for the whole extended range, or if it would exceed MAX_SESSION_SLOTS.
 *  - On an unselected court: a click inside the shared range joins that court to
 *    the session, mirroring the full range — refused with a notice if the court
 *    is not free for the whole range or the session already has
 *    MAX_SESSION_COURTS courts. A click outside the range is refused with a
 *    notice (the session has exactly one time range).
 *
 * Pure: returns the same Map instance when nothing changed, so callers can use
 * reference equality to skip downstream resets.
 *
 * @param {object} params
 * @param {Map<string, {startTime: string, endTime: string}>} params.selections
 * @param {Array<{courtId: string, courtName: string, slots: Array}>} params.availabilityData
 * @param {string} params.courtId - The court whose slot was clicked.
 * @param {{startTime: string, endTime: string, status: string}} params.slot
 * @returns {{selections: Map, notice: {courtId: string, message: string}|null}}
 */
export function reduceSlotClick({ selections, availabilityData, courtId, slot }) {
  if (slot.status !== "available") {
    return { selections, notice: null };
  }

  const courtSlots = availabilityData.find((c) => c.courtId === courtId)?.slots || [];

  if (selections.size === 0) {
    const next = new Map(selections);
    next.set(courtId, { startTime: slot.startTime, endTime: slot.endTime });
    return { selections: next, notice: null };
  }

  // All selected courts share one range — read it off any entry.
  const shared = selections.values().next().value;
  const selectedCourtIds = [...selections.keys()];
  const startIdx = courtSlots.findIndex((s) => s.startTime === shared.startTime);
  const endIdx = courtSlots.findIndex((s) => s.endTime === shared.endTime);
  const clickedIdx = courtSlots.findIndex((s) => s.startTime === slot.startTime);
  const inRange = startIdx !== -1 && clickedIdx >= startIdx && clickedIdx <= endIdx;

  if (selections.has(courtId)) {
    if (inRange) {
      // Tap your own selection → drop this court from the session.
      const next = new Map(selections);
      next.delete(courtId);
      return { selections: next, notice: null };
    }

    // Extend the range up to the clicked slot, auto-filling everything between
    // (7:00 selected + tap on 11:00 → 7:00 through 12:00). The whole extended
    // range must be free on every selected court — a gap can never form.
    const newRange = clickedIdx < startIdx
      ? { startTime: slot.startTime, endTime: shared.endTime }
      : { startTime: shared.startTime, endTime: slot.endTime };
    const newSlotCount = (clickedIdx < startIdx ? endIdx - clickedIdx : clickedIdx - startIdx) + 1;

    if (newSlotCount > MAX_SESSION_SLOTS) {
      return {
        selections,
        notice: {
          courtId,
          message: `You can book up to ${MAX_SESSION_SLOTS} consecutive slots in one session.`,
        },
      };
    }

    const blocking = findCourtNotFreeForRange(availabilityData, selectedCourtIds, newRange);
    if (blocking) {
      return {
        selections,
        notice: {
          courtId,
          message: blocking.courtId === courtId
            ? `The ${newRange.startTime}–${newRange.endTime} range includes slots that aren't free on this court.`
            : `${blocking.courtName} isn't free for ${newRange.startTime}–${newRange.endTime}. All selected courts share the same time range.`,
        },
      };
    }

    const next = new Map(selections);
    for (const id of selectedCourtIds) next.set(id, newRange);
    return { selections: next, notice: null };
  }

  // Unselected court.
  if (inRange) {
    if (selections.size >= MAX_SESSION_COURTS) {
      return {
        selections,
        notice: {
          courtId,
          message: `You can book up to ${MAX_SESSION_COURTS} courts in one session.`,
        },
      };
    }
    if (isRangeAvailable(courtSlots, shared)) {
      const next = new Map(selections);
      next.set(courtId, { startTime: shared.startTime, endTime: shared.endTime });
      return { selections: next, notice: null };
    }
    return {
      selections,
      notice: {
        courtId,
        message: `This court isn't free for the full ${shared.startTime}–${shared.endTime} range.`,
      },
    };
  }

  return {
    selections,
    notice: {
      courtId,
      message: `All courts share the same time range (${shared.startTime}–${shared.endTime}). Tap inside that range to add this court, or adjust your current selection first.`,
    },
  };
}

/**
 * Seconds remaining until an ISO timestamp, floored at 0. Recomputed from the
 * clock on every call (rather than decremented) so countdowns survive tab
 * sleep / interval throttling without drifting.
 *
 * @param {string} expiresAt - ISO timestamp.
 * @param {number} [now=Date.now()]
 * @returns {number}
 */
export function getRemainingSeconds(expiresAt, now = Date.now()) {
  const target = new Date(expiresAt).getTime();
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/** Formats a second count as a m:ss countdown label (e.g. 599 → "9:59"). */
export function formatCountdown(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
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
