import { VENUE } from "../config/venue.config.js";
import { MAX_SESSION_COURTS, MAX_SESSION_SLOTS } from "./bookingEngine.js";

const DEFAULT_BRAND = "Baseline Arena";

export function enrichVenueConfiguration(venue = {}) {
  const config = VENUE;
  
  // Use database coordinates if they exist (latitude/longitude), otherwise fall back to configuration
  const hasDbLocation = venue.latitude !== undefined && venue.latitude !== null &&
                        venue.longitude !== undefined && venue.longitude !== null;
  const location = hasDbLocation
    ? { lat: Number(venue.latitude), lng: Number(venue.longitude) }
    : config.location || { lat: 21.0907, lng: 79.0834 };

  return {
    ...venue,
    brandName: venue.brandName || config.brandName || DEFAULT_BRAND,
    googleMapsLink: venue.googleMapsLink || config.googleMapsLink || "",
    hours: venue.hours || config.hours || "Mon-Sun: 7 AM to 12 AM",
    location,
  };
}

export function normalizeVenueResponse(venue = {}) {
  const normalized = {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    address: venue.address || "",
    city: venue.city || "",
    timezone: venue.timezone || "Asia/Kolkata",
    currency: venue.currency || "INR",
    advanceBookingDays: venue.advance_booking_days ?? 7,
    rolloverTime: venue.rollover_time ?? "08:00",
    phone: venue.phone || "",
    secondaryPhone: venue.secondary_phone ?? "",
    email: venue.email || "",
    // Backend coordinates (temporary schema gaps representation)
    latitude: venue.latitude !== undefined ? venue.latitude : null,
    longitude: venue.longitude !== undefined ? venue.longitude : null,
    courts: (venue.courts || []).map((court) => ({
      id: court.id,
      name: court.name,
      environment: court.environment,
      surfaceType: court.surface_type ?? "",
      description: court.description || "",
      coverImageUrl: court.cover_image_url ?? "",
      status: court.status,
      displayOrder: court.display_order ?? 0,
    })),
  };

  return enrichVenueConfiguration(normalized);
}

export function normalizeAvailabilityResponse(payload = {}) {
  return (payload.courts || []).map((court) => ({
    courtId: court.court_id,
    courtName: court.court_name,
    environment: court.environment,
    slots: (court.slots || []).map((slot) => ({
      startTime: slot.start_time,
      endTime: slot.end_time,
      status: slot.status,
      // `??` not `||` so a genuinely free slot priced 0 isn't treated as missing (LO-1).
      price: Number(slot.unit_price ?? 0),
    })),
  }));
}

export function normalizePricePreviewResponse(payload = {}) {
  const breakdown = payload.price_breakdown || {};
  const grouped = new Map();

  for (const unit of breakdown.units || []) {
    const key = unit.court_id || unit.court_name;
    const current = grouped.get(key) || {
      label: unit.court_name || key,
      amount: 0,
      slotCount: 0,
    };
    current.amount += Number(unit.unit_price ?? 0);
    current.slotCount += 1;
    grouped.set(key, current);
  }

  return {
    subtotal: Number(breakdown.subtotal || 0),
    courtFee: Number(breakdown.subtotal || 0),
    discountAmount: Number(breakdown.coupon_discount || 0),
    taxAmount: Number(breakdown.tax || 0),
    totalAmount: Number(breakdown.total || 0),
    units: (breakdown.units || []).map((unit) => ({
      courtId: unit.court_id,
      courtName: unit.court_name,
      slotStartTime: unit.slot_start_time,
      slotEndTime: unit.slot_end_time,
      unitPrice: Number(unit.unit_price ?? 0),
    })),
    breakdown: [...grouped.values()].map((item) => ({
      ...item,
      amount: Number(item.amount.toFixed(2)),
    })),
  };
}

export function normalizeBooking(booking = {}, { isDetail = false } = {}) {
  if (!booking) return null;

  // Trust backend API contract for unique, sorted court_names.
  // Fallback to slots extraction without sorting if court_names is missing.
  const rawCourts = booking.court_names ||
    [...new Set((booking.slots || []).map((s) => s.court?.name).filter(Boolean))];
  const courtNames = rawCourts.length > 0 ? rawCourts : [booking.court?.name || "Court"];

  // The list endpoint returns `slot_start_time`/`slot_end_time`; the detail
  // endpoint returns `session_start_time`/`session_end_time`. Read both shapes.
  const startTime = booking.slot_start_time || booking.session_start_time;
  const endTime = booking.slot_end_time || booking.session_end_time;
  const time = startTime && endTime ? `${startTime} - ${endTime}` : "";

  const base = {
    id: booking.id,
    userId: booking.user_id,
    status: booking.status,
    courtNames,
    venueName: booking.venue?.name || "Venue",
    venueSlug: booking.venue?.slug || "",
    date: booking.slot_date,
    time,
    amount: Number(booking.total_amount ?? 0),
    hasReview: Boolean(booking.has_review),
  };

  if (!isDetail) {
    return base;
  }

  return {
    ...base,
    slotDate: booking.slot_date,
    sessionStartTime: booking.session_start_time || startTime,
    sessionEndTime: booking.session_end_time || endTime,
    sessionDurationMins: Number(booking.session_duration_mins ?? 0),
    courtCount: Number(booking.court_count ?? 0),
    slotUnitCount: Number(booking.slot_unit_count ?? 0),
    totalAmount: Number(booking.total_amount ?? 0),
    taxAmount: Number(booking.tax_amount ?? 0),
    discountAmount: Number(booking.discount_amount ?? 0),
    creditsApplied: Number(booking.credits_applied ?? 0),
    expiresAt: booking.expires_at,
    waiverAccepted: Boolean(booking.waiver_accepted),
    waiverAcceptedAt: booking.waiver_accepted_at,
    venue: booking.venue ? normalizeVenueResponse(booking.venue) : null,
    slots: (booking.slots || []).map((slot) => ({
      id: slot.id,
      court: slot.court ? {
        id: slot.court.id,
        name: slot.court.name,
      } : null,
      slotDate: slot.slot_date,
      startTime: slot.slot_start_time,
      endTime: slot.slot_end_time,
      status: slot.status,
      unitPrice: Number(slot.unit_price ?? 0),
    })),
    payments: (booking.payments || []).map((payment) => ({
      id: payment.id,
      gateway: payment.gateway,
      merchantOrderId: payment.merchant_order_id,
      amount: Number(payment.amount || 0),
      status: payment.status,
      createdAt: payment.created_at,
    })),
  };
}

export function normalizeUserBookingsResponse(payload = {}) {
  const rows = Array.isArray(payload) ? payload : payload.data || [];
  return rows.map((booking) => normalizeBooking(booking, { isDetail: false }));
}

export function normalizeBookingDetailResponse(booking = {}) {
  const data = booking?.data || booking;
  return normalizeBooking(data, { isDetail: true });
}

/**
 * Normalizes a booking-hold response (`POST /bookings/hold`) into camelCase (ME-2).
 * @param {object} payload
 */
export function normalizeHoldResponse(payload = {}) {
  return {
    bookingId: payload.booking_id,
    status: payload.status,
    expiresAt: payload.expires_at,
    courtCount: Number(payload.court_count ?? 0),
    slotUnitCount: Number(payload.slot_unit_count ?? 0),
    sessionStartTime: payload.session_start_time,
    sessionEndTime: payload.session_end_time,
    sessionDurationMins: Number(payload.session_duration_mins ?? 0),
  };
}

/**
 * Normalizes an initiate-payment response into a stable, discriminated camelCase
 * shape (ME-2 / HI-13). The backend `type` becomes `kind`:
 *   - "wallet_only" | "already_confirmed" → the booking is (or will be) confirmed
 *   - a gateway name (e.g. "phonepe")     → a redirect/iframe checkout is required
 * @param {object} payload
 */
export function normalizePaymentInitiationResponse(payload = {}) {
  const type = payload.type;
  const isConfirmed = type === "wallet_only" || type === "already_confirmed";
  return {
    kind: isConfirmed ? "confirmed" : "redirect",
    gatewayType: type,
    bookingId: payload.booking_id,
    merchantOrderId: payload.merchant_order_id ?? "",
    redirectUrl: payload.redirect_url ?? "",
    expiresAt: payload.expires_at,
  };
}

/**
 * Normalizes the payment verification response (`GET /payments/verify`)
 * into camelCase (ME-2). `state` is the provider's order state (COMPLETED |
 * FAILED | PENDING | CREATED | UNKNOWN); redirect routing only needs
 * `bookingId` — the unified booking page derives its view from the ledger.
 * @param {object} payload
 */
export function normalizePaymentVerifyResponse(payload = {}) {
  return {
    merchantOrderId: payload.merchant_order_id ?? "",
    bookingId: payload.booking_id ?? "",
    bookingStatus: payload.booking_status ?? "",
    paymentStatus: payload.payment_status ?? "",
    state: payload.state ?? "UNKNOWN",
  };
}

export function normalizeWalletResponse(payload = {}) {
  return {
    balance: Number(payload.balance || 0),
    transactions: (payload.transactions || []).map((transaction) => ({
      id: transaction.id,
      type: transaction.type,
      amount: Number(transaction.amount || 0),
      balanceAfter: Number(transaction.balance_after || 0),
      reason: transaction.reason || "",
      createdAt: transaction.created_at || "",
    })),
  };
}

/**
 * Normalizes a review response (`POST /reviews`, `GET /reviews/me`) into
 * camelCase (ME-2). Returns null for an empty payload. Photo fields are
 * deferred along with the upload feature.
 * @param {object} review
 */
export function normalizeReviewResponse(review) {
  if (!review) return null;
  return {
    id: review.id,
    bookingId: review.booking_id,
    venueId: review.venue_id,
    rating: Number(review.rating ?? 0),
    comment: review.comment || "",
    createdAt: review.created_at || "",
  };
}

/**
 * Normalizes a reward instance (`GET /rewards/instances[/:id]`) into camelCase
 * (ME-2). The backend omits `outcome`/`voucher` while the instance is pending —
 * those stay undefined here so views can branch on their presence.
 * @param {object} instance
 */
export function normalizeRewardInstance(instance) {
  if (!instance) return null;
  return {
    id: instance.id,
    mechanismType: instance.mechanism_type,
    mechanismName: instance.mechanism_name || "",
    status: instance.status,
    bookingId: instance.booking_id,
    bookingSlotDate: instance.booking_slot_date || "",
    cardTheme: instance.card_theme || "",
    expiresAt: instance.expires_at || "",
    createdAt: instance.created_at || "",
    revealedAt: instance.revealed_at || "",
    outcome: instance.outcome
      ? {
          prizeId: instance.outcome.prize_id,
          label: instance.outcome.label,
          type: instance.outcome.type,
          terms: instance.outcome.terms || "",
        }
      : undefined,
    voucher: instance.voucher
      ? {
          code: instance.voucher.code,
          validUntil: instance.voucher.valid_until || "",
          redeemed: Boolean(instance.voucher.redeemed),
          redeemedAt: instance.voucher.redeemed_at || "",
        }
      : undefined,
  };
}

export function normalizeMyRewardsResponse(payload = {}) {
  const rows = Array.isArray(payload) ? payload : payload.data || [];
  return rows.map(normalizeRewardInstance);
}

/**
 * Normalizes a reward mechanism (`GET/POST/PATCH /rewards/mechanisms`) into
 * camelCase (ME-2). The prize pool keeps its backend snake_case field names
 * (`validity_days`) — it is a JSONB config passed back verbatim on save.
 * @param {object} mechanism
 */
export function normalizeRewardMechanism(mechanism) {
  if (!mechanism) return null;
  return {
    id: mechanism.id,
    venueId: mechanism.venue_id,
    name: mechanism.name,
    type: mechanism.type,
    triggerEvent: mechanism.trigger_event,
    config: mechanism.config || { prizes: [] },
    instanceExpiryDays: Number(mechanism.instance_expiry_days ?? 7),
    isActive: Boolean(mechanism.is_active),
    validFrom: mechanism.valid_from || "",
    validUntil: mechanism.valid_until || "",
    createdAt: mechanism.created_at || "",
    updatedAt: mechanism.updated_at || "",
  };
}

/**
 * Normalizes a moderation-view instance (`GET /rewards/instances/moderation`).
 * Staff surface: outcome/voucher are present regardless of status, plus the
 * owning user and any redemption note for lookup at the stall.
 * @param {object} instance
 */
export function normalizeModerationInstance(instance) {
  if (!instance) return null;
  return {
    ...normalizeRewardInstance(instance),
    redemptionNote: instance.redemption_note || "",
    user: instance.user
      ? { id: instance.user.id, name: instance.user.name || "", phone: instance.user.phone || "" }
      : null,
  };
}

/**
 * Normalizes the reveal response (`POST /rewards/instances/:id/reveal`). The
 * shape intentionally matches `normalizeRewardInstance` where fields overlap so
 * the reveal screen can settle on the same view a revisit renders (ADR-W004 —
 * identical success views server/client).
 * @param {object} payload
 */
export function normalizeRevealResponse(payload = {}) {
  return normalizeRewardInstance({
    id: payload.instance_id,
    mechanism_type: payload.mechanism_type,
    status: payload.status,
    revealed_at: payload.revealed_at,
    outcome: payload.outcome,
    voucher: payload.voucher,
  });
}

export function buildBookingSelectionPayload({
  venueId,
  selectedDate,
  selectedCourtsData = [],
  couponCode = "",
}) {
  if (!venueId || !selectedDate || selectedCourtsData.length === 0) {
    return { ok: false, message: "Select at least one court and time slot." };
  }

  const slotRanges = selectedCourtsData.map(({ slots }) => (
    (slots || []).map((slot) => slot.startTime)
  ));

  if (slotRanges.some((range) => range.length === 0)) {
    return { ok: false, message: "Select a valid consecutive slot range." };
  }

  const reference = JSON.stringify(slotRanges[0]);
  const allMatch = slotRanges.every((range) => JSON.stringify(range) === reference);
  if (!allMatch) {
    return { ok: false, message: "Select the same time range for each selected court." };
  }

  // Backend session limits (Joi caps in bookings.validators.js). The selection
  // reducer refuses over-limit clicks up front; this is the checkout-time
  // safeguard so an oversized selection never reads as a pricing failure.
  if (selectedCourtsData.length > MAX_SESSION_COURTS) {
    return { ok: false, message: `You can book up to ${MAX_SESSION_COURTS} courts in one session.` };
  }
  if (slotRanges[0].length > MAX_SESSION_SLOTS) {
    return { ok: false, message: `You can book up to ${MAX_SESSION_SLOTS} consecutive slots in one session.` };
  }

  const normalizedCoupon = String(couponCode || "").trim().toUpperCase();
  return {
    ok: true,
    value: {
      venue_id: venueId,
      court_ids: selectedCourtsData.map((court) => court.courtId),
      slot_date: selectedDate,
      slot_start_times: slotRanges[0],
      ...(normalizedCoupon ? { coupon_code: normalizedCoupon } : {}),
    },
  };
}
