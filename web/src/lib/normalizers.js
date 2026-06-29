import { VENUE } from "../config/venue.config.js";

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
    advanceBookingDays: venue.advance_booking_days ?? venue.advanceBookingDays ?? 7,
    rolloverTime: venue.rollover_time ?? venue.rolloverTime ?? "08:00",
    phone: venue.phone || "",
    secondaryPhone: venue.secondary_phone ?? venue.secondaryPhone ?? "",
    email: venue.email || "",
    // Backend coordinates (temporary schema gaps representation)
    latitude: venue.latitude !== undefined ? venue.latitude : null,
    longitude: venue.longitude !== undefined ? venue.longitude : null,
    courts: (venue.courts || []).map((court) => ({
      id: court.id,
      name: court.name,
      environment: court.environment,
      surfaceType: court.surface_type ?? court.surfaceType ?? "",
      description: court.description || "",
      coverImageUrl: court.cover_image_url ?? court.coverImageUrl ?? "",
      status: court.status,
      displayOrder: court.display_order ?? court.displayOrder ?? 0,
    })),
  };

  return enrichVenueConfiguration(normalized);
}

export function normalizeAvailabilityResponse(payload = {}) {
  return (payload.courts || []).map((court) => ({
    courtId: court.court_id || court.courtId,
    courtName: court.court_name || court.courtName,
    environment: court.environment,
    slots: (court.slots || []).map((slot) => ({
      startTime: slot.start_time || slot.startTime,
      endTime: slot.end_time || slot.endTime,
      status: slot.status,
      price: Number(slot.unit_price || slot.unitPrice || 0),
    })),
  }));
}

export function normalizePricePreviewResponse(payload = {}) {
  const breakdown = payload.price_breakdown || payload.priceQuote || {};
  const grouped = new Map();

  for (const unit of breakdown.units || []) {
    const key = unit.court_id || unit.courtId || unit.court_name || unit.courtName;
    const current = grouped.get(key) || {
      label: unit.court_name || unit.courtName || key,
      amount: 0,
      slotCount: 0,
    };
    current.amount += Number(unit.unit_price || unit.unitPrice || 0);
    current.slotCount += 1;
    grouped.set(key, current);
  }

  return {
    subtotal: Number(breakdown.subtotal || 0),
    courtFee: Number(breakdown.subtotal || 0),
    discountAmount: Number(breakdown.coupon_discount || breakdown.discountAmount || 0),
    taxAmount: Number(breakdown.tax || breakdown.taxAmount || 0),
    totalAmount: Number(breakdown.total || breakdown.totalAmount || 0),
    units: (breakdown.units || []).map((unit) => ({
      courtId: unit.court_id || unit.courtId,
      courtName: unit.court_name || unit.courtName,
      slotStartTime: unit.slot_start_time || unit.slotStartTime,
      slotEndTime: unit.slot_end_time || unit.slotEndTime,
      unitPrice: Number(unit.unit_price || unit.unitPrice || 0),
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
  const rawCourts = booking.court_names || booking.courtNames ||
    [...new Set((booking.slots || []).map((s) => s.court?.name || s.courtName).filter(Boolean))];
  const courtNames = rawCourts.length > 0 ? rawCourts : [booking.court?.name || "Court"];

  const startTime = booking.slot_start_time || booking.session_start_time || booking.sessionStartTime || booking.startTime;
  const endTime = booking.slot_end_time || booking.session_end_time || booking.sessionEndTime || booking.endTime;
  const time = booking.time || (startTime && endTime ? `${startTime} - ${endTime}` : "");

  const base = {
    id: booking.id,
    status: booking.status,
    courtNames,
    venueName: booking.venue?.name || booking.venueName || "Venue",
    venueSlug: booking.venue?.slug || booking.venueSlug || "",
    date: booking.slot_date || booking.slotDate || booking.date,
    time,
    amount: Number(booking.total_amount ?? booking.totalAmount ?? booking.amount ?? 0),
    hasReview: Boolean(booking.has_review ?? booking.hasReview),
  };

  if (!isDetail) {
    return base;
  }

  return {
    ...base,
    slotDate: booking.slot_date || booking.slotDate || booking.date,
    sessionStartTime: booking.session_start_time || booking.sessionStartTime || startTime,
    sessionEndTime: booking.session_end_time || booking.sessionEndTime || endTime,
    sessionDurationMins: Number(booking.session_duration_mins ?? booking.sessionDurationMins ?? 0),
    courtCount: Number(booking.court_count ?? booking.courtCount ?? 0),
    slotUnitCount: Number(booking.slot_unit_count ?? booking.slotUnitCount ?? 0),
    totalAmount: Number(booking.total_amount ?? booking.totalAmount ?? 0),
    taxAmount: Number(booking.tax_amount ?? booking.taxAmount ?? 0),
    discountAmount: Number(booking.discount_amount ?? booking.discountAmount ?? 0),
    creditsApplied: Number(booking.credits_applied ?? booking.creditsApplied ?? 0),
    expiresAt: booking.expires_at || booking.expiresAt,
    waiverAccepted: Boolean(booking.waiver_accepted ?? booking.waiverAccepted),
    waiverAcceptedAt: booking.waiver_accepted_at || booking.waiverAcceptedAt,
    venue: booking.venue ? normalizeVenueResponse(booking.venue) : null,
    slots: (booking.slots || []).map((slot) => ({
      id: slot.id,
      court: slot.court ? {
        id: slot.court.id,
        name: slot.court.name,
      } : null,
      slotDate: slot.slot_date || slot.slotDate,
      startTime: slot.slot_start_time || slot.startTime || slot.slotStartTime,
      endTime: slot.slot_end_time || slot.endTime || slot.slotEndTime,
      status: slot.status,
      unitPrice: Number(slot.unit_price ?? slot.unitPrice ?? 0),
    })),
    payments: (booking.payments || []).map((payment) => ({
      id: payment.id,
      gateway: payment.gateway,
      merchantOrderId: payment.merchant_order_id || payment.merchantOrderId,
      amount: Number(payment.amount || 0),
      status: payment.status,
      createdAt: payment.created_at || payment.createdAt,
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
