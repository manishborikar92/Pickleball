import { Suspense } from "react";
import { AdminBookings, AdminSkeleton } from "@/components/features/admin";
import { getAdminOverview } from "@/lib/dal/admin";
import { requireRouteAccess } from "@/lib/dal/session";

async function BookingsContent() {
  const overview = await getAdminOverview();
  return <AdminBookings initialRows={overview.bookings} />;
}

export default async function AdminBookingsPage() {
  await requireRouteAccess("/admin/bookings");
  return (
    <Suspense fallback={<AdminSkeleton metrics={0} />}>
      <BookingsContent />
    </Suspense>
  );
}
