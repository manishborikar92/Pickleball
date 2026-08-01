import { Card } from "@/components/shared";

/**
 * venues/[slug]/book/loading.js — Route loading boundary for the venue booking page.
 * Renders a pixel-matched skeleton header and structural skeletons for VenueHero,
 * DatePicker, SlotGrid, and OrderSummary.
 */
export default function BookPageLoading() {
  return (
    <main className="min-h-screen bg-background pb-24 text-foreground sm:pb-32" aria-busy="true">
      {/* BookingHeader Skeleton — matches BookingHeader layout, heights, and flex alignment */}
      <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded animate-pulse bg-surface-panel" />
            <div className="hidden h-4 w-10 rounded animate-pulse bg-surface-panel sm:inline-block" />
          </div>
          <div className="h-6 w-24 rounded-lg animate-pulse bg-surface-panel sm:h-7 sm:w-28" />
          <div className="flex items-center gap-1.5">
            <div className="h-5 w-5 rounded-full animate-pulse bg-surface-panel" />
            <div className="hidden h-4 w-16 rounded animate-pulse bg-surface-panel sm:inline-block" />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-8 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        <div className="min-w-0 space-y-5 sm:space-y-6">
          {/* VenueHero Skeleton */}
          <section className="relative aspect-[16/9] max-h-48 w-full overflow-hidden rounded-2xl border border-line/60 bg-surface/40 shadow-md">
            <div className="relative flex h-full flex-col items-start justify-end p-4 sm:p-5 md:p-6 space-y-2">
              <div className="h-5 w-28 rounded-full animate-pulse bg-surface-panel" />
              <div className="h-7 w-48 rounded-lg animate-pulse bg-surface-panel sm:h-8 sm:w-64 md:h-9 md:w-72" />
              <div className="mt-1 flex items-center gap-2">
                <div className="h-4 w-4 rounded-full animate-pulse bg-surface-panel" />
                <div className="h-4 w-40 rounded animate-pulse bg-surface-panel sm:w-56" />
              </div>
            </div>
          </section>

          {/* DatePicker & SlotGrid Card Skeleton */}
          <Card className="p-4 sm:p-6">
            <div>
              <div className="h-7 w-48 rounded-lg animate-pulse bg-surface-panel sm:h-8 sm:w-56" />
              <div className="mt-4 flex items-stretch gap-2 sm:mt-5 sm:gap-3 overflow-hidden">
                <div className="hide-scrollbar flex flex-1 snap-x gap-2 overflow-x-auto pb-2">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className="grid h-[72px] min-w-[64px] shrink-0 snap-start place-items-center rounded-lg border border-line/40 bg-surface-panel/40 animate-pulse px-2 sm:h-20 sm:min-w-[72px] sm:px-3 gap-1"
                    >
                      <div className="h-2.5 w-6 rounded bg-surface-panel" />
                      <div className="h-5 w-5 rounded bg-surface-panel" />
                      <div className="h-2.5 w-7 rounded bg-surface-panel" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-8 border-t border-line pt-5 sm:mt-6 sm:pt-6">
              {/* Court 1 Skeleton */}
              <section>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-36 rounded-md animate-pulse bg-surface-panel" />
                  <div className="h-4 w-28 rounded animate-pulse bg-surface-panel" />
                </div>
                <div className="relative mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5 sm:gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex min-h-[72px] sm:min-h-[80px] flex-col items-center justify-center gap-1 rounded-xl border border-line/40 bg-surface-panel/40 animate-pulse p-2"
                    />
                  ))}
                </div>
              </section>

              {/* Court 2 Skeleton */}
              <section>
                <div className="flex items-center gap-2">
                  <div className="h-5 w-36 rounded-md animate-pulse bg-surface-panel" />
                  <div className="h-4 w-28 rounded animate-pulse bg-surface-panel" />
                </div>
                <div className="relative mt-3 grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-3 lg:grid-cols-5 sm:gap-3">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex min-h-[72px] sm:min-h-[80px] flex-col items-center justify-center gap-1 rounded-xl border border-line/40 bg-surface-panel/40 animate-pulse p-2"
                    />
                  ))}
                </div>
              </section>
            </div>
          </Card>
        </div>

        {/* OrderSummary Skeleton */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Card className="flex flex-col overflow-hidden p-0 shadow-xl border border-line/60 bg-surface/40">
            <div className="border-b border-line/40 px-5 py-4 sm:px-6">
              <div className="h-6 w-36 rounded animate-pulse bg-surface-panel" />
            </div>
            <div className="flex flex-col gap-5 p-5 sm:p-6">
              <div className="h-28 rounded-xl border border-line/40 bg-surface-panel/30 animate-pulse" />
              
              <div className="flex gap-2">
                <div className="h-10 flex-1 rounded-xl bg-surface-panel/50 animate-pulse" />
                <div className="h-10 w-20 rounded-xl bg-surface-panel/50 animate-pulse" />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between">
                  <div className="h-4 w-20 rounded bg-surface-panel animate-pulse" />
                  <div className="h-4 w-16 rounded bg-surface-panel animate-pulse" />
                </div>
                <div className="flex justify-between">
                  <div className="h-4 w-24 rounded bg-surface-panel animate-pulse" />
                  <div className="h-4 w-14 rounded bg-surface-panel animate-pulse" />
                </div>
                <div className="flex justify-between border-t border-line/40 pt-3">
                  <div className="h-6 w-24 rounded bg-surface-panel animate-pulse" />
                  <div className="h-6 w-20 rounded bg-surface-panel animate-pulse" />
                </div>
              </div>

              <div className="h-12 w-full rounded-xl bg-surface-panel animate-pulse mt-1" />

              <div className="flex items-center justify-center gap-4 text-xs">
                <div className="h-3 w-28 rounded bg-surface-panel animate-pulse" />
                <div className="h-3 w-28 rounded bg-surface-panel animate-pulse" />
              </div>
            </div>
          </Card>
        </aside>
      </div>
    </main>
  );
}
