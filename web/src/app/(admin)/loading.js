export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Metrics skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-panel" />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="space-y-3">
        <div className="h-10 w-48 rounded-lg bg-surface-panel" />
        <div className="h-64 rounded-xl bg-surface-panel" />
      </div>
    </div>
  );
}
