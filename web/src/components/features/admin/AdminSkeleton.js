/**
 * AdminSkeleton — shared loading placeholder for admin data surfaces (ME-4).
 * Rendered as the Suspense fallback while the admin overview data streams in.
 */
export function AdminSkeleton({ metrics = 4 }) {
  return (
    <div className="space-y-6 sm:space-y-8" aria-busy="true">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-surface-panel" />
      {metrics > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: metrics }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-panel" />
          ))}
        </div>
      )}
      <div className="h-64 animate-pulse rounded-xl bg-surface-panel" />
    </div>
  );
}
