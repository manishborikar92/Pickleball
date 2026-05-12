import { DashboardOverview } from "@/components/features/dashboard/DashboardViews";
import { getUserBookings, getWallet } from "@/lib/api";
import { requireRouteAccess } from "@/lib/session";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  await requireRouteAccess("/dashboard");
  const [bookings, wallet] = await Promise.all([getUserBookings(), getWallet()]);
  return <DashboardOverview bookings={bookings} wallet={wallet} />;
}
