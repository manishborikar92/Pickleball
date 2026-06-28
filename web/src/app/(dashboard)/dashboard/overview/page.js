import { Suspense } from "react";
import { DashboardOverview } from "@/components/features/dashboard";
import { getUserBookings, getWallet } from "@/lib/api";
import { SectionHeader } from "@/components/shared";

export const metadata = {
  title: "Dashboard",
};

async function DashboardContent() {
  const [bookings, wallet] = await Promise.all([getUserBookings(), getWallet()]);
  return <DashboardOverview bookings={bookings} wallet={wallet} />;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-panel" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-surface-panel" />
    </div>
  );
}

export default function DashboardOverviewPage() {
  return (
    <div className="space-y-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}
