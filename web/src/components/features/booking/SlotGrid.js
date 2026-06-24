"use client";

import { useState } from "react";

const STATUS_STYLES = {
  available:
    "border-line bg-surface-high text-foreground hover:border-accent hover:bg-accent/10 cursor-pointer",
  booked:
    "border-line/50 bg-surface/30 text-muted/30 cursor-not-allowed line-through",
  pending:
    "border-accent/20 bg-accent/5 text-muted/40 cursor-not-allowed",
  blocked:
    "border-line/50 bg-surface/30 text-muted/30 cursor-not-allowed",
  past:
    "border-line/50 bg-surface/30 text-muted/30 cursor-not-allowed",
};

const STATUS_LABELS = {
  booked: "Taken",
  pending: "Hold",
  blocked: "Closed",
  past: "Past",
};

/**
 * SlotGrid — renders one slot grid per court.
 * All courts are always visible — no court toggle or filter needed.
 * Supports consecutive multi-slot selection per court.
 *
 * @param {Object}   props
 * @param {Array}    props.availability    - Array of { courtId, slots[] } per court
 * @param {Array}    props.courts          - Array of court config objects
 * @param {Map}      props.courtSelections - Map<courtId, { startTime, endTime }>
 * @param {Function} props.onSlotSelect   - (courtId, slot, allSlots) => void
 */
export function SlotGrid({
  availability,
  courts,
  courtSelections,
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
    <div className="mt-5 space-y-8 border-t border-line pt-5 sm:mt-6 sm:pt-6">
      {availability.map((courtAvailability) => {
        const court = courts.find((c) => c.id === courtAvailability.courtId);
        if (!court) return null;
        const sel = courtSelections.get(court.id) || null;
        return (
          <CourtSlots
            key={court.id}
            court={court}
            slots={courtAvailability.slots}
            selection={sel}
            onSlotSelect={(slot) =>
              onSlotSelect(court.id, slot, courtAvailability.slots)
            }
          />
        );
      })}
    </div>
  );
}

function CourtSlots({ court, slots, selection, onSlotSelect }) {
  const [rangeWarning, setRangeWarning] = useState(false);

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

  function handleClick(slot, idx) {
    if (slot.status !== "available") return;

    if (!selection) {
      // No current selection — start fresh
      setRangeWarning(false);
      onSlotSelect(slot);
      return;
    }

    // If clicking the same single slot, deselect
    if (
      selection.startTime === slot.startTime &&
      selection.endTime === slot.endTime
    ) {
      setRangeWarning(false);
      onSlotSelect(null);
      return;
    }

    // If clicking within the current range — deselect entire range (no gaps)
    if (isInRange(idx)) {
      setRangeWarning(false);
      onSlotSelect(null);
      return;
    }

    // Check adjacency: slot must be immediately adjacent to range
    const isAdjacentBefore = idx === selectedStartIdx - 1;
    const isAdjacentAfter = idx === selectedEndIdx + 1;

    if (isAdjacentBefore || isAdjacentAfter) {
      // Extend the range
      setRangeWarning(false);
      const newStart = isAdjacentBefore
        ? slot
        : slots[selectedStartIdx];
      const newEnd = isAdjacentAfter
        ? slot
        : slots[selectedEndIdx];
      onSlotSelect({ startSlot: newStart, endSlot: newEnd });
      return;
    }

    // Non-adjacent — show warning, don't change selection
    setRangeWarning(true);
    setTimeout(() => setRangeWarning(false), 3000);
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

      {rangeWarning && (
        <div
          role="alert"
          className="mt-2 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-medium text-accent"
        >
          Slots must be consecutive. Tap an adjoining slot to extend your
          selection.
        </div>
      )}

      <div className="relative mt-3 grid grid-cols-3 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5">
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
              onSelect={() => handleClick(slot, idx)}
            />
          );
        })}
      </div>

      {selection && selectedStartIdx !== -1 && (
        <p className="mt-2 text-xs font-medium text-accent">
          Selected:{" "}
          <strong>
            {slots[selectedStartIdx]?.startTime} →{" "}
            {slots[selectedEndIdx]?.endTime}
          </strong>{" "}
          ({selectedEndIdx - selectedStartIdx + 1} slot
          {selectedEndIdx - selectedStartIdx + 1 > 1 ? "s" : ""})
        </p>
      )}
    </section>
  );
}

function SlotButton({ slot, inRange, isFirst, isLast, isSingle, onSelect }) {
  const isAvailable = slot.status === "available";

  let selectedStyle = "";
  if (inRange) {
    if (isSingle) {
      selectedStyle =
        "border-accent bg-accent text-black shadow-sm ring-2 ring-accent ring-offset-1 ring-offset-background rounded-lg";
    } else if (isFirst) {
      selectedStyle =
        "border-accent bg-accent text-black shadow-sm ring-2 ring-accent ring-offset-1 ring-offset-background rounded-l-lg rounded-r-none";
    } else if (isLast) {
      selectedStyle =
        "border-accent bg-accent text-black shadow-sm ring-2 ring-accent ring-offset-1 ring-offset-background rounded-r-lg rounded-l-none";
    } else {
      // Middle of range
      selectedStyle =
        "border-accent bg-accent text-black shadow-sm ring-y-2 ring-accent ring-offset-0 rounded-none border-x-0";
    }
  }

  const baseStyle = inRange
    ? selectedStyle
    : `rounded-lg ${STATUS_STYLES[slot.status] ?? STATUS_STYLES.available}`;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={onSelect}
      aria-pressed={inRange}
      aria-label={`${slot.startTime} to ${slot.endTime}${
        !isAvailable ? ` — ${STATUS_LABELS[slot.status] ?? slot.status}` : ""
      }${inRange ? " (selected)" : ""}`}
      className={`relative flex min-h-[64px] w-full flex-col items-center justify-center border p-2 text-center text-xs font-bold transition-all sm:min-h-[72px] sm:p-3 ${baseStyle}`}
    >
      <span className="block text-[13px] font-bold sm:text-sm">
        {slot.startTime}
      </span>
      <span className="mt-0.5 block text-[10px] font-medium opacity-75 sm:text-[11px]">
        {slot.endTime}
      </span>
      {!isAvailable && (
        <span className="absolute inset-x-0 bottom-1.5 text-[9px] font-black uppercase tracking-wider opacity-60">
          {STATUS_LABELS[slot.status]}
        </span>
      )}
    </button>
  );
}