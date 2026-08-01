"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

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

const CURRENT_DRAFT_VERSION = 1;
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function getDraftStorageKey(venueId) {
  return `pb:draft:${venueId}`;
}

function readPersistedDraft(venueId, initialDate) {
  if (typeof window === "undefined" || !venueId) return null;
  try {
    const raw = window.sessionStorage.getItem(getDraftStorageKey(venueId));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (!saved || typeof saved !== "object") return null;

    // Schema versioning & venue isolation check
    if (saved.version !== CURRENT_DRAFT_VERSION || saved.venueId !== venueId) {
      window.sessionStorage.removeItem(getDraftStorageKey(venueId));
      return null;
    }

    // Expiration TTL check (2 hours)
    if (!saved.updatedAt || Date.now() - saved.updatedAt > DRAFT_TTL_MS) {
      window.sessionStorage.removeItem(getDraftStorageKey(venueId));
      return null;
    }

    // Past date check
    if (saved.date && saved.date < initialDate) {
      window.sessionStorage.removeItem(getDraftStorageKey(venueId));
      return null;
    }

    return saved;
  } catch {
    clearPersistedDraft(venueId);
    return null;
  }
}

function persistDraft(venueId, data) {
  if (typeof window === "undefined" || !venueId) return;
  try {
    const payload = {
      version: CURRENT_DRAFT_VERSION,
      venueId,
      updatedAt: Date.now(),
      ...data,
    };
    window.sessionStorage.setItem(getDraftStorageKey(venueId), JSON.stringify(payload));
  } catch {
    // Ignore storage quota/SecurityError gracefully
  }
}

function clearPersistedDraft(venueId) {
  if (typeof window === "undefined" || !venueId) return;
  try {
    window.sessionStorage.removeItem(getDraftStorageKey(venueId));
  } catch {
    // Ignore
  }
}

/**
 * useBookingSelection — encapsulates the booking wizard's selection, availability,
 * coupon, and server-priced quote state (HI-12).
 *
 * @param {object} params
 * @param {object} params.venue
 * @param {object[]} params.courts
 * @param {object[]} params.initialAvailability - Server-rendered availability for `initialDate`.
 * @param {string} params.initialDate
 * @param {string} [params.todayDate] - Current date string for venue's timezone to anchor date window.
 */
export function useBookingSelection({ venue, courts, initialAvailability, initialDate, todayDate }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();

  const venueId = venue?.id;
  const urlDate = searchParams ? searchParams.get("date") : null;

  // Anchor date window to venue's todayDate so window remains stable across date selections
  const baseDate = todayDate || initialDate;

  const dates = useMemo(
    () => buildDateWindow({
      startDate: baseDate,
      advanceBookingDays: venue.advanceBookingDays,
    }),
    [baseDate, venue.advanceBookingDays],
  );

  // Single source of truth: selectedDate derived cleanly from URL search parameter
  const selectedDate = useMemo(() => {
    if (urlDate && typeof urlDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(urlDate)) {
      if (dates.some((d) => d.iso === urlDate)) {
        return urlDate;
      }
    }
    return dates[0]?.iso ?? initialDate;
  }, [urlDate, dates, initialDate]);

  // Lazy draft evaluation for initial state
  const initialDraft = useMemo(() => {
    return readPersistedDraft(venueId, initialDate);
  }, [venueId, initialDate]);

  const [availabilityData, setAvailabilityData] = useState(initialAvailability || []);
  const [availabilityError, setAvailabilityError] = useState("");

  const [courtSelections, setCourtSelections] = useState(() => {
    if (!initialDraft || initialDraft.date !== selectedDate || !Array.isArray(initialDraft.courtSelections)) {
      return new Map();
    }
    const newMap = new Map();
    for (const item of initialDraft.courtSelections) {
      if (!item.courtId || !item.startTime || !item.endTime) continue;
      const courtAvail = (initialAvailability || []).find((c) => c.courtId === item.courtId);
      if (!courtAvail) continue;

      const range = getSlotRange(courtAvail.slots, item.startTime, item.endTime);
      const allAvailable = range.length > 0 && range.every((s) => s.status === "available");

      if (allAvailable) {
        newMap.set(item.courtId, { startTime: item.startTime, endTime: item.endTime });
      }
    }
    return newMap;
  });

  const [selectionNotice, setSelectionNotice] = useState(() => {
    if (!initialDraft || initialDraft.date !== selectedDate || !Array.isArray(initialDraft.courtSelections)) {
      return null;
    }
    let hasInvalidSlot = false;
    for (const item of initialDraft.courtSelections) {
      if (!item.courtId || !item.startTime || !item.endTime) continue;
      const courtAvail = (initialAvailability || []).find((c) => c.courtId === item.courtId);
      if (!courtAvail) {
        hasInvalidSlot = true;
        continue;
      }
      const range = getSlotRange(courtAvail.slots, item.startTime, item.endTime);
      const allAvailable = range.length > 0 && range.every((s) => s.status === "available");
      if (!allAvailable) {
        hasInvalidSlot = true;
      }
    }
    return hasInvalidSlot ? "Some previously selected slots are no longer available." : null;
  });

  const [couponCode, setCouponCode] = useState(() => {
    return initialDraft?.appliedCouponCode && typeof initialDraft.appliedCouponCode === "string"
      ? initialDraft.appliedCouponCode
      : "";
  });
  const [appliedCouponCode, setAppliedCouponCode] = useState(() => {
    return initialDraft?.appliedCouponCode && typeof initialDraft.appliedCouponCode === "string"
      ? initialDraft.appliedCouponCode
      : "";
  });

  const [couponMessage, setCouponMessage] = useState("");
  const [serverQuote, setServerQuote] = useState(EMPTY_QUOTE);
  const [quoteRequestError, setQuoteRequestError] = useState("");

  const initialFetchSkippedRef = useRef(false);
  const fetchTokenRef = useRef(0);

  // Synchronize selection state when selectedDate changes (via date click or browser navigation)
  const prevDateRef = useRef(selectedDate);
  if (prevDateRef.current !== selectedDate) {
    prevDateRef.current = selectedDate;
    setCourtSelections(new Map());
    setSelectionNotice(null);
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    if (venueId) clearPersistedDraft(venueId);
  }

  const [isFetchingAvailability, setIsFetchingAvailability] = useState(false);

  const fetchAvailability = useCallback((date) => {
    const token = ++fetchTokenRef.current;
    setIsFetchingAvailability(true);
    return getAvailabilityAction(venueId, date)
      .then((res) => {
        if (token !== fetchTokenRef.current) return;
        setIsFetchingAvailability(false);
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
        setIsFetchingAvailability(false);
        setAvailabilityData([]);
        setAvailabilityError(error.message || "Could not load availability.");
      });
  }, [venueId]);

  useEffect(() => {
    if (!initialFetchSkippedRef.current && selectedDate === initialDate) {
      initialFetchSkippedRef.current = true;
      return;
    }
    initialFetchSkippedRef.current = true;
    fetchAvailability(selectedDate);
  }, [selectedDate, initialDate, fetchAvailability]);

  // Persist draft updates to sessionStorage
  useEffect(() => {
    if (!venueId) return;

    const serializedSelections = Array.from(courtSelections.entries()).map(([courtId, range]) => ({
      courtId,
      startTime: range.startTime,
      endTime: range.endTime,
    }));

    if (serializedSelections.length > 0 || appliedCouponCode) {
      persistDraft(venueId, {
        date: selectedDate,
        courtSelections: serializedSelections,
        appliedCouponCode,
      });
    } else {
      clearPersistedDraft(venueId);
    }
  }, [venueId, selectedDate, courtSelections, appliedCouponCode]);

  const refreshAvailability = useCallback(
    () => fetchAvailability(selectedDate),
    [fetchAvailability, selectedDate],
  );

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
      venueId,
      selectedDate,
      selectedCourtsData,
      couponCode: appliedCouponCode,
    }),
    [appliedCouponCode, selectedCourtsData, selectedDate, venueId],
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

  const clearSelections = useCallback(() => {
    setCourtSelections(new Map());
    setSelectionNotice(null);
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    if (venueId) clearPersistedDraft(venueId);
  }, [venueId]);

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
    setAvailabilityError("");
    setCourtSelections(new Map());
    setSelectionNotice(null);
    setServerQuote(EMPTY_QUOTE);
    setQuoteRequestError("");
    if (venueId) clearPersistedDraft(venueId);

    // Synchronize selected date to URL search param using React 19 startTransition to prevent layout flashes
    if (router && pathname && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("date") !== date) {
        params.set("date", date);
        startTransition(() => {
          router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        });
      }
    }
  }, [venueId, router, pathname, startTransition]);

  return {
    // Data
    dates,
    selectedDate,
    availabilityData,
    availabilityError,
    isFetchingAvailability,
    isNavigating,
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
