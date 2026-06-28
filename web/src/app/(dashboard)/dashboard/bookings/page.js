import { Suspense } from "react";
import { BookingsView } from "@/components/features/dashboard";
import { getUserBookings } from "@/lib/api";

export const metadata = { title: "My Bookings" };

async function BookingsContent() {
  const bookings = await getUserBookings();
  return <BookingsView bookings={bookings} />;
}

function BookingsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-surface-panel" />
      <div className="h-64 rounded-xl bg-surface-panel" />
    </div>
  );
}

export default function MyBookingsPage() {
  return (
    <Suspense fallback={<BookingsSkeleton />}>
      <BookingsContent />
    </Suspense>
  );
}
