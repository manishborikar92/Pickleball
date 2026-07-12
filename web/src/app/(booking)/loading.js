/**
 * (booking)/loading.js — Instant skeleton for the latency-sensitive checkout
 * group (HI-4). Previously this group had no loading UI, so navigation to the
 * booking route showed a blank/frozen screen while the venue + availability
 * resolved. This renders immediately while the route streams in.
 */
export default function BookingLoading() {
  return (
    <main className="min-h-screen bg-background pb-24 text-foreground" aria-busy="true">
      {/* Header bar */}
      <div className="border-b border-line/60 bg-surface/40">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:h-20 sm:px-6">
          <div className="h-9 w-40 animate-pulse rounded-lg bg-surface-panel" />
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          {/* Venue hero */}
          <div className="h-40 animate-pulse rounded-2xl bg-surface-panel sm:h-52" />

          {/* Date picker + slot grid card */}
          <div className="space-y-4 rounded-2xl border border-line/60 bg-surface/40 p-4 sm:p-6">
            <div className="flex gap-2 overflow-hidden">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-16 w-14 shrink-0 animate-pulse rounded-xl bg-surface-panel" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-panel" />
              ))}
            </div>
          </div>
        </div>

        {/* Order summary */}
        <aside>
          <div className="h-80 animate-pulse rounded-2xl border border-line/60 bg-surface/40" />
        </aside>
      </div>
    </main>
  );
}
