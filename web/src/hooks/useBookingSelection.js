"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildDateWindow,
  getSharedAvailableSlotTimes,
  getSlotRange,
  reduceSlotClick,
} from "@/lib/bookingEngine";
import { couponSchema } from "@/lib/schemas";
import { getAvailabilityAction, previewBookingPriceAction } from "@/lib/actions/booking";
import { buildBookingSelectionPayload } from "@/lib/normalizers";

const EMPTY_QUOTE = {
  subtotal: 0,
  courtFee: 0,
  discountAmount: 0,
  taxAmount: 0,
  totalAmount: 0,
  units: [],
  breakdown: [],
};

/**
 * useBookingSelection — encapsulates the booking wizard's selection, availability,
 * coupon, and server-priced quote state (HI-12). Extracting this out of
 * `BookingClient` leaves that component a thin orchestrator of checkout + auth,
 * and makes the data/selection logic independently reasoned about.
 *
 * @param {object} params
 * @param {object} params.venue
 * @param {object[]} params.courts
 * @param {object[]} params.initialAvailability - Server-rendered availability for `initialDate`.
 * @param {string} params.initialDate
 */
export function useBookingSelection({ venue, courts, initialAvailability, initialDate }) {
  const dates = useMemo(
    () => buildDateWindow({
      startDate: initialDate,
      advanceBookingDays: venue.advanceBookingDays,
    }),
    [initialDate, venue.advanceBookingDays],
  );

  const [selectedDate, setSelectedDate] = useState(dates[0]?.iso ?? initialDate);
  const [availabilityData, setAvailabilityData] = useState(initialAvailability || []);
  const [availabilityError, setAvailabilityError] = useState("");
  const [courtSelections, setCourtSelections] = useState(new Map());
  const [selectionNotice, setSelectionNotice] = useState(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [serverQuote, setServerQuote] = useState(EMPTY_QUOTE);
  const [quoteRequestError, setQuoteRequestError] = useState("");

  // Availability for the initial date is already server-rendered and passed as a
  // prop, so we skip the first client fetch to avoid a server→client→server
  // waterfall / double-fetch (HI-4). Subsequent date changes fetch as normal.
  const initialFetchSkippedRef = useRef(false);
  // Monotonic token so a manual refresh can't be clobbered by a stale in-flight
  // fetch (and vice versa) — only the latest request may write state.
  const fetchTokenRef = useRef(0);

  const fetchAvailability = useCallback((date) => {
    const token = ++fetchTokenRef.current;
    return getAvailabilityAction(venue.id, date)
      .then((res) => {
        if (token !== fetchTokenRef.current) return;
        if (res.ok) {
          setAvailabilityData(res.data);
          setAvailabilityError("");
        } else {
          setAvailabilityData([]);
          setAvailabilityError(res.error.message || "Could not load availability.");
        }
      })
      .catch((error) => {
        if (token !== fetchTokenRef.current) return;
        setAvailabilityData([]);
        setAvailabilityError(error.message || "Could not load availability.");
      });
  }, [venue.id]);

  useEffect(() => {
    if (!initialFetchSkippedRef.current && selectedDate === initialDate) {
      initialFetchSkippedRef.current = true;
      return;
    }
    initialFetchSkippedRef.current = true;
    fetchAvailability(selectedDate);
  }, [selectedDate, initialDate, fetchAvailability]);

  /**
   * Re-fetches availability for the current date without touching the selection.
   * Used after a hold expires or fails on slot contention, so the grid reflects
   * what other users have taken in the meantime.
   */
  const refreshAvailability = useCallback(
    () => fetchAvailability(selectedDate),
    [fetchAvailability, selectedDate],
  );

  // Start times available on EVERY court — the shared booking windows the grid
  // highlights when the venue has multiple courts (03-UI-UX-SPECIFICATION §2.2).
  const sharedSlotTimes = useMemo(
    () => getSharedAvailableSlotTimes(availabilityData, availabilityData.map((c) => c.courtId)),
    [availabilityData],
  );

  const selectedCourtsData = useMemo(() => {
    const result = [];

    for (const court of courts) {
      const selection = courtSelections.get(court.id);
      if (!selection) continue;

      const courtAvailability = availabilityData.find((item) => item.courtId === court.id);
      if (!courtAvailability) continue;

      const slotsRange = getSlotRange(courtAvailability.slots, selection.startTime, selection.endTime);
      if (slotsRange.length === 0) continue;

      result.push({
        courtId: court.id,
        courtName: court.name,
        slots: slotsRange,
      });
    }

    return result;
  }, [availabilityData, courtSelections, courts]);

  const selectionPayload = useMemo(
    () => buildBookingSelectionPayload({
      venueId: venue.id,
      selectedDate,
      selectedCourtsData,
      couponCode: appliedCouponCode,
    }),
    [appliedCouponCode, selectedCourtsData, selectedDate, venue.id],
  );

  const hasSelection = selectedCourtsData.length > 0;
  const quote = hasSelection && selectionPayload.ok ? serverQuote : EMPTY_QUOTE;
  const quoteError = !hasSelection
    ? ""
    : (!selectionPayload.ok ? selectionPayload.message : quoteRequestError);
  const canCheckout = hasSelection && selectionPayload.ok && !quoteError;

  useEffect(() => {
    if (!hasSelection || !selectionPayload.ok) {
      return;
    }

    let active = true;

    previewBookingPriceAction(selectionPayload.value)
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setServerQuote(res.data);
          setQuoteRequestError("");
          if (appliedCouponCode) setCouponMessage(`${appliedCouponCode} applied.`);
        } else {
          setServerQuote(EMPTY_QUOTE);
          setQuoteRequestError(res.error.message || "Could not calculate price.");
          if (appliedCouponCode) {
            setCouponMessage(res.error.message || "Promo code could not be applied.");
          }
        }
      })
      .catch((error) => {
        if (!active) return;
        setServerQuote(EMPTY_QUOTE);
        setQuoteRequestError(error.message || "Could not calculate price.");
        if (appliedCouponCode) {
          setCouponMessage(error.message || "Promo code could not be applied.");
        }
      });

    return () => {
      active = false;
    };
  }, [appliedCouponCode, hasSelection, selectionPayload]);

  /**
   * Handles a slot click. All gesture logic lives in `reduceSlotClick` — the
   * reducer mirrors one shared time range across every selected court, so an
   * asymmetric selection can never be produced by the UI (02-BUSINESS-LOGIC
   * §5.1); `buildBookingSelectionPayload` remains the checkout-time safeguard.
   */
  const selectSlot = useCallback((courtId, slot) => {
    const { selections, notice } = reduceSlotClick({
      selections: courtSelections,
      availabilityData,
      courtId,
      slot,
    });
    setSelectionNotice(notice);
    if (selections !== courtSelections) {
      setServerQuote(EMPTY_QUOTE);
      setQuoteRequestError("");
      setCourtSelections(selections);
    }
  }, [availabilityData, courtSelections]);

  /** Clears every court selection (e.g. after a hold expires mid-checkout). */
  const clearSelections = useCallback(() => {
    setCourtSelections(new Map());
    setSelectionNotice(null);
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
  }, []);


  const applyCoupon = useCallback(() => {
    const parsed = couponSchema.safeParse(couponCode);
    if (!parsed.success) {
      setAppliedCouponCode("");
      setCouponMessage(parsed.error.issues[0]?.message || "Enter a valid promo code.");
      return;
    }

    setAppliedCouponCode(parsed.data);
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    setCouponMessage("Applying promo code...");
  }, [couponCode]);

  const selectDate = useCallback((date) => {
    setSelectedDate(date);
    setAvailabilityError("");
    setCourtSelections(new Map());
    setSelectionNotice(null);
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
  }, []);

  return {
    // Data
    dates,
    selectedDate,
    availabilityData,
    availabilityError,
    courtSelections,
    selectedCourtsData,
    selectionPayload,
    selectionNotice,
    sharedSlotTimes,
    // Coupon
    couponCode,
    setCouponCode,
    couponMessage,
    // Quote
    quote,
    quoteError,
    hasSelection,
    canCheckout,
    // Actions
    selectDate,
    selectSlot,
    clearSelections,
    refreshAvailability,
    applyCoupon,
  };
}
