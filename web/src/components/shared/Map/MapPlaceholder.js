import { Card } from "@/components/shared";

/**
 * MapPlaceholder Component
 * Static skeleton UI rendered while the map is loading or before hydration.
 * Matches LocationSection aesthetic to prevent CLS.
 */
export function MapPlaceholder({ className = "" }) {
  return (
    <Card className={`relative min-h-64 overflow-hidden shadow-sm sm:min-h-80 ${className}`}>
      <div 
        className="absolute inset-0 h-full w-full bg-[repeating-linear-gradient(135deg,rgba(202,255,0,0.1)_0_2px,transparent_2px_18px),linear-gradient(135deg,#10272d,#101408)] animate-pulse"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-xs font-bold uppercase tracking-widest text-accent/50">Initializing Map...</span>
        </div>
      </div>
    </Card>
  );
}
