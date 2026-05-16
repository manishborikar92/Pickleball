import { Card } from "@/components/shared";

/**
 * MapPlaceholder Component
 * Static skeleton UI rendered while the map is loading or before hydration.
 * Matches LocationSection aesthetic to prevent CLS.
 */
export function MapPlaceholder({ className = "" }) {
  return (
    <Card className={`absolute inset-0 h-full w-full overflow-hidden shadow-sm border-none bg-surface-variant ${className}`}>
      <div 
        className="absolute inset-0 h-full w-full bg-[repeating-linear-gradient(135deg,rgba(202,255,0,0.05)_0_2px,transparent_2px_18px),linear-gradient(135deg,#101408,#0D0D0D)] animate-pulse"
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-10 w-10 rounded-full border-2 border-accent/20" />
            <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent/40">Initializing Map Engine</span>
        </div>
      </div>
    </Card>
  );
}
