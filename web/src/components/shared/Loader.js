import { cn } from "@/lib/utils";

/**
 * Standardized Loader component.
 * Supports:
 *  - "bar" (default): Cohesive sliding progress bar
 *  - "spinner": Accessible spinning circle
 */
export function Loader({ variant = "bar", className = "" }) {
  if (variant === "spinner") {
    return (
      <div 
        className={cn("flex items-center justify-center p-4", className)}
        role="status"
        aria-label="Loading..."
      >
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-accent" />
      </div>
    );
  }

  return (
    <div 
      className={cn("flex flex-col items-center justify-center p-6", className)}
      role="status"
      aria-label="Loading..."
    >
      <div className="relative h-[2px] w-24 overflow-hidden rounded bg-line">
        <div className="absolute top-0 left-0 h-full w-8 bg-accent animate-loader-slide" />
      </div>
    </div>
  );
}
