"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { buildDateWindow, getSlotRange } from "@/lib/bookingEngine";
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
  const [couponCode, setCouponCode] = useState("");
  const [appliedCouponCode, setAppliedCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState("");
  const [serverQuote, setServerQuote] = useState(EMPTY_QUOTE);
  const [quoteRequestError, setQuoteRequestError] = useState("");

  // Availability for the initial date is already server-rendered and passed as a
  // prop, so we skip the first client fetch to avoid a server→client→server
  // waterfall / double-fetch (HI-4). Subsequent date changes fetch as normal.
  const initialFetchSkippedRef = useRef(false);

  useEffect(() => {
    if (!initialFetchSkippedRef.current && selectedDate === initialDate) {
      initialFetchSkippedRef.current = true;
      return;
    }
    initialFetchSkippedRef.current = true;

    let active = true;

    getAvailabilityAction(venue.id, selectedDate)
      .then((res) => {
        if (!active) return;
        if (res.ok) {
          setAvailabilityData(res.data);
          setAvailabilityError("");
        } else {
          setAvailabilityData([]);
          setAvailabilityError(res.error.message || "Could not load availability.");
        }
      })
      .catch((error) => {
        if (!active) return;
        setAvailabilityData([]);
        setAvailabilityError(error.message || "Could not load availability.");
      });

    return () => {
      active = false;
    };
  }, [selectedDate, venue.id, initialDate]);

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

  const selectSlot = useCallback((courtId, slotOrAction) => {
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    setCourtSelections((prev) => {
      const next = new Map(prev);

      if (slotOrAction === null) {
        next.delete(courtId);
        return next;
      }

      if (slotOrAction.startSlot && slotOrAction.endSlot) {
        next.set(courtId, {
          startTime: slotOrAction.startSlot.startTime,
          endTime: slotOrAction.endSlot.endTime,
        });
      } else {
        next.set(courtId, {
          startTime: slotOrAction.startTime,
          endTime: slotOrAction.endTime,
        });
      }

      return next;
    });
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
    applyCoupon,
  };
}
