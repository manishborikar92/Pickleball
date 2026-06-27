import { DashboardOverview } from "@/components/features/dashboard";
import { getUserBookings, getWallet } from "@/lib/api";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardOverviewPage() {
  const [bookings, wallet] = await Promise.all([getUserBookings(), getWallet()]);
  return <DashboardOverview bookings={bookings} wallet={wallet} />;
}
