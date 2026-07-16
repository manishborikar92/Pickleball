import { Suspense } from "react";
import { BookingsView } from "@/components/features/dashboard";
import { getUserBookings } from "@/lib/dal/bookings";
import { getMyRewards } from "@/lib/dal/rewards";

export const metadata = { title: "My Bookings" };

async function BookingsContent() {
  // Rewards are an enhancement on this page (the "Scratch card waiting" badge)
  // — a rewards read failure must never take down the bookings list.
  const [bookings, rewards] = await Promise.all([
    getUserBookings(),
    getMyRewards().catch(() => []),
  ]);

  // One pending instance per booking per mechanism; surface the first pending
  // instance for each booking as its badge target.
  const pendingRewardByBooking = {};
  for (const reward of rewards) {
    if (reward.status === "pending" && reward.bookingId && !pendingRewardByBooking[reward.bookingId]) {
      pendingRewardByBooking[reward.bookingId] = reward.id;
    }
  }

  const enriched = bookings.map((booking) => ({
    ...booking,
    pendingRewardId: pendingRewardByBooking[booking.id] || null,
  }));

  return <BookingsView bookings={enriched} />;
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
