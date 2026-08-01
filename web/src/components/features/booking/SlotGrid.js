"use client";

import { Clock, Lock, Ban } from "lucide-react";
import { formatTime12Hour } from "@/lib/formatters";

const STATUS_LABELS = {
  booked: "Booked",
  pending: "Hold",
  blocked: "Closed",
  past: "Past",
};

/**
 * SlotGrid — renders one slot grid per court.
 * All courts are always visible — no court toggle or filter needed.
 *
 * Click gestures are interpreted by `reduceSlotClick` (via `useBookingSelection`),
 * which mirrors one shared time range across all selected courts — the grid only
 * reports which slot was tapped and renders the resulting state, including the
 * per-court notice when a tap was refused (02-BUSINESS-LOGIC §5.1).
 *
 * When the venue has multiple courts, slots open on EVERY court get a
 * shared-window highlight so group bookings can spot common windows at a glance
 * (03-UI-UX-SPECIFICATION §2.2).
 *
 * @param {Object}   props
 * @param {Array}    props.availability    - Array of { courtId, slots[] } per court
 * @param {Array}    props.courts          - Array of court config objects
 * @param {Map}      props.courtSelections - Map<courtId, { startTime, endTime }>
 * @param {Set}      props.sharedSlotTimes - Start times available on all courts
 * @param {Object}   props.selectionNotice - { courtId, message } | null
 * @param {Function} props.onSlotSelect    - (courtId, slot) => void
 */
export function SlotGrid({
  availability,
  courts,
  courtSelections,
  sharedSlotTimes,
  selectionNotice,
  isFetching = false,
  onSlotSelect,
}) {
  if (!availability || availability.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-line/50 bg-surface/30 p-6 text-center text-sm text-muted">
        No courts are available for the selected date.
      </div>
    );
  }

  return (
    <div className={`mt-5 space-y-8 border-t border-line pt-5 sm:mt-6 sm:pt-6 transition-opacity duration-200 ${isFetching ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
      {availability.map((courtAvailability) => {
        const court = courts.find((c) => c.id === courtAvailability.courtId);
        if (!court) return null;
        return (
          <CourtSlots
            key={court.id}
            court={court}
            slots={courtAvailability.slots}
            selection={courtSelections.get(court.id) || null}
            sharedSlotTimes={availability.length > 1 ? sharedSlotTimes : undefined}
            notice={selectionNotice?.courtId === court.id ? selectionNotice.message : ""}
            onSlotSelect={(slot) => onSlotSelect(court.id, slot)}
          />
        );
      })}
    </div>
  );
}

function CourtSlots({ court, slots, selection, sharedSlotTimes, notice, onSlotSelect }) {
  // Compute which slots are in the selected range
  const selectedStartIdx = selection
    ? slots.findIndex((s) => s.startTime === selection.startTime)
    : -1;
  const selectedEndIdx = selection
    ? slots.findIndex((s) => s.endTime === selection.endTime)
    : -1;

  function isInRange(idx) {
    if (selectedStartIdx === -1) return false;
    return idx >= selectedStartIdx && idx <= selectedEndIdx;
  }

  return (
    <section aria-labelledby={`court-${court.id}-label`}>
      <h4
        id={`court-${court.id}-label`}
        className="text-base font-black sm:text-lg"
      >
        {court.name}
        <span className="ml-2 text-xs font-medium text-muted">
          {court.environment} · {court.surfaceType}
        </span>
      </h4>

      {notice && (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent"
        >
          {notice}
        </div>
      )}

      {/* Grid columns bounded strictly between 3 (min) and 5 (max) */}
      <div className="relative mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5">
        {slots.map((slot, idx) => {
          const inRange = isInRange(idx);
          const isFirst = idx === selectedStartIdx;
          const isLast = idx === selectedEndIdx;
          const isSingle = selectedStartIdx === selectedEndIdx && inRange;

          return (
            <SlotButton
              key={`${slot.startTime}-${idx}`}
              slot={slot}
              inRange={inRange}
              isFirst={isFirst}
              isLast={isLast}
              isSingle={isSingle}
              isShared={Boolean(sharedSlotTimes?.has(slot.startTime))}
              onSelect={() => onSlotSelect(slot)}
            />
          );
        })}
      </div>

      {selection && selectedStartIdx !== -1 && (
        <p className="mt-2 text-xs font-medium text-accent">
          Selected:{" "}
          <strong>
            {formatTime12Hour(slots[selectedStartIdx]?.startTime)} →{" "}
            {formatTime12Hour(slots[selectedEndIdx]?.endTime)}
          </strong>{" "}
          ({selectedEndIdx - selectedStartIdx + 1} slot
          {selectedEndIdx - selectedStartIdx + 1 > 1 ? "s" : ""})
        </p>
      )}
    </section>
  );
}

function SlotButton({ slot, inRange, isFirst, isLast, isSingle, isShared, onSelect }) {
  const isAvailable = slot.status === "available";
  const formattedStart = formatTime12Hour(slot.startTime);
  const formattedEnd = formatTime12Hour(slot.endTime);
  const label = STATUS_LABELS[slot.status];

  // Selected range styling
  let selectedStyle = "";
  if (inRange) {
    if (isSingle) {
      selectedStyle =
        "border-accent bg-accent text-black shadow-md ring-2 ring-accent ring-offset-1 ring-offset-background rounded-xl";
    } else if (isFirst) {
      selectedStyle =
        "border-accent bg-accent text-black shadow-md ring-2 ring-accent ring-offset-1 ring-offset-background rounded-l-xl rounded-r-none";
    } else if (isLast) {
      selectedStyle =
        "border-accent bg-accent text-black shadow-md ring-2 ring-accent ring-offset-1 ring-offset-background rounded-r-xl rounded-l-none";
    } else {
      // Middle of range
      selectedStyle =
        "border-accent bg-accent text-black shadow-md ring-2 ring-accent ring-offset-1 ring-offset-background rounded-none";
    }
  }

  // Shared-window treatment: accent border on unselected available slots open on all courts
  const sharedStyle = isShared && !inRange ? " border-accent/60" : "";

  // Base state styles matching Section 8 Recommended Design System
  let baseStyle = "";
  if (inRange) {
    baseStyle = selectedStyle;
  } else if (slot.status === "pending") {
    baseStyle = "rounded-xl border border-amber-500/30 bg-amber-500/10 text-foreground cursor-not-allowed";
  } else if (slot.status === "booked") {
    baseStyle = "rounded-xl border border-line/40 bg-surface/20 text-foreground/60 opacity-60 cursor-not-allowed";
  } else if (slot.status === "blocked") {
    baseStyle = "rounded-xl border border-line/40 bg-surface/20 text-foreground/50 opacity-50 cursor-not-allowed";
  } else if (slot.status === "past") {
    baseStyle = "rounded-xl border border-line/30 bg-surface/10 text-muted opacity-30 cursor-not-allowed";
  } else if (slot.status === "disabled") {
    baseStyle = "rounded-xl border border-line/20 bg-surface/10 text-muted opacity-40 cursor-not-allowed";
  } else {
    // Available default
    baseStyle = `rounded-xl border border-line bg-surface-high text-foreground hover:border-accent hover:bg-accent/10 cursor-pointer shadow-2xs${sharedStyle}`;
  }

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={onSelect}
      aria-pressed={inRange}
      aria-label={`${formattedStart} to ${formattedEnd}${
        !isAvailable ? ` — ${label ?? slot.status}` : ""
      }${inRange ? " (selected)" : ""}`}
      className={`relative flex min-h-[72px] sm:min-h-[80px] w-full flex-col items-center justify-center p-3 sm:p-3.5 text-center transition-all ${baseStyle}`}
    >
      {/* Top-Right Signifiers */}
      {!inRange && slot.status === "pending" && (
        <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center text-amber-400">
          <Clock className="h-3 w-3" />
        </span>
      )}
      {!inRange && slot.status === "booked" && (
        <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center text-muted/60">
          <Lock className="h-3 w-3" />
        </span>
      )}
      {!inRange && slot.status === "blocked" && (
        <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center text-muted/60">
          <Ban className="h-3 w-3" />
        </span>
      )}

      {/* Start Time */}
      <span
        className={`block text-xs sm:text-sm font-bold leading-none ${
          slot.status === "booked" || slot.status === "past" ? "line-through" : ""
        }`}
      >
        {formattedStart}
      </span>

      {/* End Time */}
      <span
        className={`mt-1 block text-[10px] sm:text-[11px] font-medium leading-none ${
          inRange
            ? "text-black/80"
            : slot.status === "booked"
            ? "text-muted/50"
            : slot.status === "blocked"
            ? "text-muted/40"
            : "text-muted"
        }`}
      >
        {formattedEnd}
      </span>

      {/* Bottom Status Label */}
      {!inRange && label && (
        <span
          className={`mt-2 text-[10px] font-semibold leading-none ${
            slot.status === "pending"
              ? "text-amber-300"
              : slot.status === "booked" || slot.status === "blocked"
              ? "text-muted/60"
              : "text-muted"
          }`}
        >
          {label}
        </span>
      )}
    </button>
  );
}
