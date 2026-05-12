import { AdminBookings } from "@/components/features/admin/AdminViews";
import { getAdminOverview } from "@/lib/api";
import { requireRouteAccess } from "@/lib/session";

export default async function AdminBookingsPage() {
  await requireRouteAccess("/admin/bookings");
  const overview = await getAdminOverview();
  return <AdminBookings initialRows={overview.bookings} />;
}
