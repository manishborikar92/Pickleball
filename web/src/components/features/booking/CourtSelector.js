"use client";

/**
 * CourtSelector — toggle buttons to activate/deactivate individual courts.
 * At least one court must remain active at all times.
 *
 * Props:
 *   courts       — array of court objects from venue config
 *   activeCourts — Set<courtId> of currently-active courts
 *   onToggle     — (courtId: string) => void
 */
export function CourtSelector({ courts, activeCourts, onToggle }) {
  if (!courts || courts.length <= 1) return null;

  return (
    <div className="mt-5 sm:mt-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-muted">
        Select Court
      </h3>
      <div
        className="mt-3 flex flex-wrap gap-2"
        role="group"
        aria-label="Select courts to book"
      >
        {courts.map((court) => {
          const isActive = activeCourts.has(court.id);
          const isOnlyOne = activeCourts.size === 1 && isActive;

          return (
            <button
              key={court.id}
              type="button"
              onClick={() => onToggle(court.id)}
              disabled={isOnlyOne}
              aria-pressed={isActive}
              aria-label={`${court.name}${isActive ? " (selected)" : ""}`}
              title={
                isOnlyOne
                  ? "At least one court must be selected"
                  : isActive
                    ? `Deselect ${court.name}`
                    : `Add ${court.name}`
              }
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-bold transition-all ${
                isActive
                  ? "border-accent bg-accent/10 text-accent shadow-sm"
                  : "border-line bg-surface-high text-muted hover:border-accent/50 hover:text-foreground"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isActive && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-accent"
                  aria-hidden="true"
                />
              )}
              {court.name}
            </button>
          );
        })}
      </div>
      {activeCourts.size > 1 && (
        <p className="mt-2 text-xs font-medium text-muted">
          Both courts selected — you can book them simultaneously for the same
          time slot.
        </p>
      )}
    </div>
  );
}
