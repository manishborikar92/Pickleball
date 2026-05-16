/**
 * VenueMarker Component
 * Custom animated marker representing the venue location.
 */
export function VenueMarker({ onClick }) {
  return (
    <div 
      className="group relative cursor-pointer outline-none" 
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-label="Venue location marker"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Outer Pulse */}
      <div className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/20 animate-ping [animation-duration:2.5s] motion-reduce:hidden" />
      
      {/* Inner Glow */}
      <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/40 blur-md motion-reduce:hidden" />

      {/* Actual Marker Pin */}
      <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-accent text-black shadow-lg transition-transform group-hover:scale-110 group-focus:ring-2 group-focus:ring-white group-focus:ring-offset-2 group-focus:ring-offset-black">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>

      {/* Drop Shadow */}
      <div className="absolute -bottom-1 left-1/2 h-1 w-4 -translate-x-1/2 rounded-[100%] bg-black/40 blur-[2px]" />
    </div>
  );
}
