import { Card, SectionHeader } from "@/components/shared";
import { AdminTable } from "./AdminTable";
import { formatCurrency } from "@/lib/booking-engine";

export function AdminOverview({ overview }) {
  const metrics = [
    { label: "Revenue Today", value: formatCurrency(overview.stats.revenueToday) },
    { label: "Utilization", value: overview.stats.utilization },
    { label: "Pending Holds", value: String(overview.stats.pendingBookings) },
    { label: "Active Courts", value: String(overview.stats.activeCourts) },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeader align="left" title="Admin Command Center">
        Live operational context for venue managers, staff, and future super-admin venue orchestration.
      </SectionHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(({ label, value }) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>

      <div className="min-w-0">
        <AdminTable title="Today's Activity" rows={overview.bookings} />
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