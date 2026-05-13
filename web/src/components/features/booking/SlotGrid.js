const STATUS_STYLES = {
  available:
    "border-line bg-surface-high text-foreground hover:border-accent hover:bg-accent/10 cursor-pointer",
  booked: "border-line bg-surface/40 text-muted/40 cursor-not-allowed",
  hold: "border-accent/40 bg-accent/5 text-muted/60 cursor-not-allowed",
};

const STATUS_LABELS = {
  booked: "Taken",
  hold: "Hold",
};

export function SlotGrid({ availability, courts, selected, onSelectSlot }) {
  return (
    <div className="mt-5 space-y-6 border-t border-line pt-5 sm:mt-6 sm:space-y-8 sm:pt-6">
      {availability.map((courtAvailability) => {
        const court = courts.find((c) => c.id === courtAvailability.courtId);
        if (!court) return null;
        
        return (
          <CourtSlots
            key={courtAvailability.courtId}
            court={court}
            slots={courtAvailability.slots}
            selected={selected}
            onSelectSlot={onSelectSlot}
          />
        );
      })}
    </div>
  );
}

function CourtSlots({ court, slots, selected, onSelectSlot }) {
  return (
    <section aria-labelledby={`court-${court.id}-label`}>
      <h4
        id={`court-${court.id}-label`}
        className="text-lg font-black sm:text-xl"
      >
        {court.name}
      </h4>
      <div className="mt-3 grid grid-cols-3 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5">
        {slots.map((slot, index) => (
          <SlotButton
            key={`${slot.startTime}-${index}`}
            slot={slot}
            courtId={court.id}
            isSelected={
              selected.courtId === court.id &&
              selected.startTime === slot.startTime
            }
            onSelect={onSelectSlot}
          />
        ))}
      </div>
    </section>
  );
}

function SlotButton({ slot, courtId, isSelected, onSelect }) {
  const isAvailable = slot.status === "available";
  const statusStyle = isSelected
    ? "border-accent bg-accent text-black shadow-sm ring-2 ring-accent ring-offset-2 ring-offset-background cursor-pointer"
    : STATUS_STYLES[slot.status] ?? STATUS_STYLES.available;

  return (
    <button
      type="button"
      disabled={!isAvailable}
      onClick={() => onSelect(courtId, slot)}
      aria-pressed={isSelected}
      aria-label={`${slot.startTime} to ${slot.endTime}${
        !isAvailable ? ` — ${STATUS_LABELS[slot.status] ?? slot.status}` : ""
      }`}
      className={`relative flex min-h-[64px] w-full flex-col items-center justify-center rounded-lg border p-2 text-center text-xs font-bold transition-all sm:min-h-[72px] sm:p-3 ${statusStyle}`}
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