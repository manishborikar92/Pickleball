import { CalendarDays } from "lucide-react";

export function DatePicker({ dates, selectedDate, onSelect, onCalendarOpen }) {
  return (
    <div>
      <h3 className="text-xl font-black sm:text-2xl">Select Date &amp; Time</h3>
      
      {/* Container holding both scrollable dates and fixed button */}
      <div className="mt-4 flex items-stretch gap-2 sm:mt-5 sm:gap-3">
        
        {/* Scrollable Date Track */}
        <div
          className="hide-scrollbar flex flex-1 snap-x gap-2 overflow-x-auto pb-2"
          role="group"
          aria-label="Select booking date"
        >
          {dates.map((date) => (
            <DateButton
              key={date.iso}
              date={date}
              isSelected={selectedDate === date.iso}
              onSelect={onSelect}
            />
          ))}
        </div>

        {onCalendarOpen && (
          <div className="shrink-0 pb-2">
            <CalendarButton onClick={onCalendarOpen} />
          </div>
        )}
      </div>
    </div>
  );
}

function DateButton({ date, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(date.iso)}
      aria-pressed={isSelected}
      className={`grid h-[72px] min-w-[64px] snap-start place-items-center rounded-lg border px-2 text-center transition-all sm:h-20 sm:min-w-[72px] sm:px-3 ${
        isSelected
          ? "border-accent bg-accent text-black shadow-sm"
          : "border-line bg-surface-high text-muted hover:border-accent/50 hover:bg-surface-high/80"
      }`}
    >
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 sm:text-xs">
        {date.weekday}
      </span>
      <span className="text-lg font-black leading-tight sm:text-xl">
        {date.day}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 sm:text-xs">
        {date.month}
      </span>
    </button>
  );
}

function CalendarButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[72px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface-high text-accent transition-colors hover:border-accent/50 hover:bg-surface-high/80 sm:h-20 sm:min-w-[72px]"
      aria-label="Open full calendar"
    >
      <CalendarDays className="h-5 w-5" />
      <span className="text-[10px] font-bold uppercase tracking-wider">
        Cal
      </span>
    </button>
  );
}
