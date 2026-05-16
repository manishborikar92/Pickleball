/**
 * MapControls Component
 * Subtle floating controls for map interaction.
 */
export function MapControls({ onCenter, onZoomIn, onZoomOut, className = "" }) {
  return (
    <div className={`absolute bottom-6 right-6 flex flex-col gap-2 z-10 ${className}`}>
      {/* Zoom Controls */}
      <div className="flex flex-col rounded-lg bg-surface/90 border border-line/10 shadow-xl overflow-hidden backdrop-blur-sm">
        <ControlButton onClick={onZoomIn} aria-label="Zoom in">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
        </ControlButton>
        <div className="h-px bg-line/10 mx-1.5" />
        <ControlButton onClick={onZoomOut} aria-label="Zoom out">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
        </ControlButton>
      </div>

      {/* Center Control */}
      <div className="rounded-lg bg-surface/90 border border-line/10 shadow-xl overflow-hidden backdrop-blur-sm">
        <ControlButton onClick={onCenter} aria-label="Recenter map">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        </ControlButton>
      </div>
    </div>
  );
}

function ControlButton({ children, onClick, ...props }) {
  return (
    <button
      onClick={onClick}
      className="p-3 text-foreground/70 hover:text-accent hover:bg-white/5 transition-colors focus-visible:outline-accent outline-offset-0"
      {...props}
    >
      {children}
    </button>
  );
}
