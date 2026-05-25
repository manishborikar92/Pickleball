import { BookingsView } from "@/components/features/dashboard";
import { getUserBookings } from "@/lib/api";

export const metadata = {
  title: "My Bookings",
};

export default async function MyBookingsPage() {
  const bookings = await getUserBookings();
  return <BookingsView bookings={bookings} />;
}
