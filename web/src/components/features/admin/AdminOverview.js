import { Card, SectionHeader } from "@/components/shared";
import { AdminTable } from "./AdminTable";
import { formatCurrency } from "@/lib/bookingEngine";

export function AdminOverview({ overview }) {
  // Metrics with no backend source yet come through as null — render "—" rather
  // than fabricating a number or printing "null" (ME-3).
  const isMissing = (value) => value === null || value === undefined;
  const metrics = [
    { label: "Revenue Today", value: isMissing(overview.stats.revenueToday) ? "—" : formatCurrency(overview.stats.revenueToday) },
    { label: "Utilization", value: isMissing(overview.stats.utilization) ? "—" : overview.stats.utilization },
    { label: "Pending Holds", value: isMissing(overview.stats.pendingBookings) ? "—" : String(overview.stats.pendingBookings) },
    { label: "Active Courts", value: String(overview.stats.activeCourts) },
  ];

  return (
    <div className="space-y-6 sm:space-y-8 flex flex-col md:h-full md:min-h-0 md:overflow-hidden">
      <div className="shrink-0">
        <SectionHeader align="left" title="Admin Command Center">
          Live operational context for venue managers, staff, and future super-admin venue orchestration.
        </SectionHeader>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 shrink-0">
        {metrics.map(({ label, value }) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>

      <div className="min-w-0 md:flex-1 md:min-h-0 md:overflow-hidden flex flex-col">
        <AdminTable title="Today's Activity" rows={overview.bookings} className="md:flex-1 md:min-h-0" />
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <Card className="flex flex-col justify-center p-4 sm:p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted sm:text-xs">
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-black tracking-tight text-accent sm:mt-3 sm:text-2xl md:text-3xl">
        {value}
      </p>
    </Card>
  );
}