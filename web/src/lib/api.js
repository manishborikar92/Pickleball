import {
  getVenueAvailabilityAction,
  getVenueBySlugAction,
  getUserBookingsAction,
  getWalletAction,
  getPaymentStatusAction,
  getBookingByIdAction,
} from "@/app/actions/booking-actions";

const wait = (value) =>
  Promise.resolve(value);

export async function getVenue(slug) {
  if (!slug) {
    throw new Error("Venue slug is required");
  }
  const res = await getVenueBySlugAction(slug);
  if (!res.success) {
    throw new Error(res.error || `Failed to load venue: ${slug}`);
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
  // TODO: Replace with real admin API once developed.
  const courts = [
    { id: "court-1", name: "Court 1", status: "active" },
    { id: "court-2", name: "Court 2", status: "active" },
  ];

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

export async function getPaymentStatus(orderId) {
  const res = await getPaymentStatusAction(orderId);
  if (!res.success) {
    throw new Error(res.error || "Failed to load payment status");
  }
  return res.data;
}

export async function getBookingById(bookingId) {
  const res = await getBookingByIdAction(bookingId);
  if (!res.success) {
    throw new Error(res.error || "Failed to load booking details");
  }
  return res.data;
}

