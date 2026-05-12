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
  new Promise((resolve) => {
    setTimeout(() => resolve(value), 80);
  });

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
  return wait({ balance: 500, transactions: walletTransactions });
}

export async function getAdminOverview() {
  return wait({ stats: adminStats, bookings: adminBookings, courts });
}
