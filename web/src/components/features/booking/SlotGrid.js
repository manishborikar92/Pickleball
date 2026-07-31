"use client";

import { formatTime12Hour } from "@/lib/formatters";

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

  // Shared-window treatment: accent border on unselected available slots that are
  // open on every court. The selected state always wins visually.
  const sharedStyle = isShared && !inRange ? " border-accent/60" : "";

  const baseStyle = inRange
    ? selectedStyle
    : `rounded-lg ${STATUS_STYLES[slot.status] ?? STATUS_STYLES.available}${sharedStyle}`;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={onSelect}
      aria-pressed={inRange}
      aria-label={`${formattedStart} to ${formattedEnd}${
        !isAvailable ? ` — ${STATUS_LABELS[slot.status] ?? slot.status}` : ""
      }${inRange ? " (selected)" : ""}`}
      className={`relative flex min-h-[64px] w-full flex-col items-center justify-center border p-2 text-center text-xs font-bold transition-all sm:min-h-[72px] sm:p-3 ${baseStyle}`}
    >
      <span className="block text-[12px] font-bold sm:text-xs leading-tight">
        {formattedStart}
      </span>
      <span className="mt-0.5 block text-[10px] font-medium opacity-75 sm:text-[11px] leading-tight">
        {formattedEnd}
      </span>
      {!isAvailable && (
        <span className="absolute inset-x-0 bottom-1.5 text-[9px] font-black uppercase tracking-wider opacity-60">
          {STATUS_LABELS[slot.status]}
        </span>
      )}
    </button>
  );
}
