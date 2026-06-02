import {
  adminBookings,
  adminStats,
  availability,
  bookings,
  courts,
  reviews,
  venue,
  walletTransactions,
} from "@/data/platform";

const wait = (value) =>
  Promise.resolve(value);

export async function getVenue() {
  return wait({ ...venue, courts });
}

export async function getAvailability() {
  return wait(availability);
}

export async function getPublishedReviews() {
  return wait(reviews);
}

export async function getUserBookings() {
  return wait(bookings);
}

export async function getWallet() {
  return wait({ balance: 0, transactions: [] });
}

export async function getAdminOverview() {
  return wait({
    stats: {
      revenueToday: 0,
      utilization: "0%",
      pendingBookings: 0,
      activeCourts: courts.filter((court) => court.status === "active").length,
    },
    bookings: [],
    courts,
  });
}
