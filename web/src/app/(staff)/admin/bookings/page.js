import { AdminBookings } from "@/components/features/admin";
import { getAdminOverview } from "@/lib/api";

export default async function AdminBookingsPage() {
  const overview = await getAdminOverview();
  return <AdminBookings initialRows={overview.bookings} />;
}
