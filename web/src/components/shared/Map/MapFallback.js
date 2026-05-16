import { Card, Button } from "@/components/shared";

/**
 * MapFallback Component
 * Displayed when map loading fails or when offline.
 */
export function MapFallback({ error, onRetry, className = "" }) {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  return (
    <Card className={`relative min-h-64 overflow-hidden flex flex-col items-center justify-center p-8 text-center bg-surface-variant sm:min-h-80 ${className}`}>
      <div className="max-w-xs flex flex-col items-center gap-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
        </div>
        
        <div>
          <h4 className="text-lg font-bold text-foreground">
            {isOffline ? "You're Offline" : "Map Loading Failed"}
          </h4>
          <p className="mt-2 text-sm text-muted">
            {isOffline 
              ? "Please check your internet connection to view the interactive map." 
              : (typeof error === 'string' ? error : "Something went wrong while loading the map engine. You can try again or open in your native maps app.")}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Retry Loading
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
