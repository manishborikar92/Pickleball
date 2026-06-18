import {
  courts,
  reviews,
} from "@/data/platform";
import {
  getVenueAvailabilityAction,
  getVenueBySlugAction,
  getUserBookingsAction,
  getWalletAction,
} from "@/app/actions/booking-actions";

const wait = (value) =>
  Promise.resolve(value);

export async function getVenue(slug = "besa-nagpur") {
  const res = await getVenueBySlugAction(slug);
  if (!res.success) {
    throw new Error(res.error || "Failed to load venue");
  }
  return res.data;
}

export async function getAvailability({ venueId, date }) {
  const res = await getVenueAvailabilityAction(venueId, date);
  if (!res.success) {
    throw new Error(res.error || "Failed to load availability");
  }
  return res.data;
}

export async function getPublishedReviews() {
  return wait(reviews);
}

export async function getUserBookings() {
  const res = await getUserBookingsAction();
  if (!res.success) {
    throw new Error(res.error || "Failed to load bookings");
  }
  return res.data;
}

export async function getWallet() {
  const res = await getWalletAction();
  if (!res.success) {
    throw new Error(res.error || "Failed to load wallet");
  }
  return res.data;
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
