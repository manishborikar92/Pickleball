const DEFAULT_BRAND = "Baseline Arena";

export function normalizeVenueResponse(venue = {}) {
  return {
    id: venue.id,
    name: venue.name,
    slug: venue.slug,
    brandName: venue.brandName || venue.brand_name || DEFAULT_BRAND,
    address: venue.address || "",
    city: venue.city || "",
    timezone: venue.timezone || "Asia/Kolkata",
    currency: venue.currency || "INR",
    advanceBookingDays: venue.advance_booking_days ?? venue.advanceBookingDays ?? 7,
    rolloverTime: venue.rollover_time ?? venue.rolloverTime ?? "08:00",
    phone: venue.phone || "",
    secondaryPhone: venue.secondary_phone || "",
    email: venue.email || "",
    location: venue.location || { lat: 21.0907, lng: 79.0834 },
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
      price: Number(slot.unit_price || 0),
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

export function normalizeUserBookingsResponse(payload = {}) {
  const rows = Array.isArray(payload) ? payload : payload.data || [];
  return rows.map((booking) => ({
    id: booking.id,
    courtName: booking.court?.name || "Court",
    venueName: booking.venue?.name || "Venue",
    date: booking.slot_date,
    time: `${booking.slot_start_time} - ${booking.slot_end_time}`,
    status: booking.status,
    amount: Number(booking.total_amount || 0),
    hasReview: Boolean(booking.has_review),
  }));
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
