/**
 * review/[bookingId]/loading.js — Review-shaped skeleton. The page now resolves
 * session + booking + review state server-side, so this streams in immediately
 * while that work completes (the group-level fallback is booking-grid shaped
 * and would misrepresent this route).
 */
export default function ReviewLoading() {
  return (
    <main className="min-h-screen bg-background pb-8 md:pb-12" aria-busy="true">
      {/* Header bar */}
      <div className="border-b border-line bg-background/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <div className="h-5 w-16 animate-pulse rounded bg-surface-panel" />
          <div className="h-6 w-36 animate-pulse rounded bg-surface-panel" />
          <div className="h-5 w-20 animate-pulse rounded bg-surface-panel" />
        </div>
      </div>

      {/* Session banner */}
      <div className="mx-auto h-44 w-full max-w-5xl animate-pulse bg-surface-panel sm:h-56 md:h-64 lg:rounded-b-2xl" />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 md:px-8 md:py-10">
        {/* Rating card */}
        <div className="flex flex-col items-center gap-5 rounded-2xl border border-line/60 bg-surface/40 p-6 sm:p-8">
          <div className="h-7 w-2/3 animate-pulse rounded bg-surface-panel" />
          <div className="flex justify-center gap-2 sm:gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 w-12 animate-pulse rounded-lg bg-surface-panel sm:h-14 sm:w-14 md:h-16 md:w-16" />
            ))}
          </div>
        </div>

        {/* Comment field */}
        <div className="h-36 animate-pulse rounded-xl bg-surface-panel" />

        {/* Submit button */}
        <div className="h-12 animate-pulse rounded-full bg-surface-panel" />
      </div>
    </main>
  );
}
