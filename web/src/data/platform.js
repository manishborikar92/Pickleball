export const venue = {
  id: "venue-besa",
  slug: "besa-nagpur",
  name: "Besa, Nagpur",
  brandName: "Pro-Tech Courts",
  address: "123 Pickleball Way, Besa, Nagpur",
  city: "Nagpur",
  timezone: "Asia/Kolkata",
  currency: "INR",
  rolloverTime: "08:00",
  advanceBookingDays: 7,
  phone: "+91 88012 34687",
  email: "hello@protechcourts.com",
  hours: "Mon-Sun: 6:00 AM - 11:00 PM",
};

export const courts = [
  {
    id: "court-1",
    venueId: venue.id,
    name: "Court 1",
    environment: "Indoor",
    surfaceType: "Pro Cushion",
    status: "active",
    price: 500,
  },
  {
    id: "court-2",
    venueId: venue.id,
    name: "Court 2",
    environment: "Indoor",
    surfaceType: "Pro Cushion",
    status: "active",
    price: 550,
  },
];

export const availability = [
  {
    courtId: "court-1",
    slots: [
      { startTime: "08:00", endTime: "09:00", status: "available", price: 500 },
      { startTime: "09:00", endTime: "10:00", status: "available", price: 500 },
      { startTime: "10:00", endTime: "11:00", status: "available", price: 500 },
      { startTime: "11:00", endTime: "12:00", status: "booked", price: 500 },
      { startTime: "18:00", endTime: "19:00", status: "available", price: 650 },
      { startTime: "19:00", endTime: "20:00", status: "pending", price: 650 },
    ],
  },
  {
    courtId: "court-2",
    slots: [
      { startTime: "09:00", endTime: "10:00", status: "available", price: 550 },
      { startTime: "10:00", endTime: "11:00", status: "booked", price: 550 },
      { startTime: "11:00", endTime: "12:00", status: "available", price: 550 },
      { startTime: "12:00", endTime: "13:00", status: "available", price: 550 },
      { startTime: "18:00", endTime: "19:00", status: "available", price: 700 },
      { startTime: "20:00", endTime: "21:00", status: "blocked", price: 700 },
    ],
  },
];

export const reviews = [
  {
    id: "review-1",
    name: "Sarah J.",
    label: "4.5 DUPR",
    rating: 5,
    quote:
      "Best indoor courts in the city. The lighting is incredible and the surface grip is exactly what you want for competitive matches.",
  },
  {
    id: "review-2",
    name: "Mike T.",
    label: "Rec Player",
    rating: 5,
    quote:
      "Booking is so easy. No more waiting around or calling facilities. Just book, show up, and play on premium courts.",
  },
  {
    id: "review-3",
    name: "Anaya P.",
    label: "Weekend Player",
    rating: 4,
    quote:
      "Clean courts, clear booking flow, and the staff helped us get started with equipment in minutes.",
  },
];

export const bookings = [
  {
    id: "BK-2041",
    courtName: "Court 1",
    venueName: venue.name,
    date: "2026-05-15",
    time: "18:00 - 19:00",
    status: "confirmed",
    amount: 767,
    hasReview: false,
  },
  {
    id: "BK-1988",
    courtName: "Court 2",
    venueName: venue.name,
    date: "2026-05-10",
    time: "09:00 - 10:00",
    status: "confirmed",
    amount: 649,
    hasReview: true,
  },
  {
    id: "BK-1902",
    courtName: "Court 1",
    venueName: venue.name,
    date: "2026-05-03",
    time: "20:00 - 21:00",
    status: "cancelled",
    amount: 650,
    hasReview: false,
  },
];

export const walletTransactions = [
  {
    id: "WT-1",
    type: "credit_issued",
    amount: 650,
    balanceAfter: 650,
    reason: "Business cancellation - power outage",
    createdAt: "2026-05-03",
  },
  {
    id: "WT-2",
    type: "credit_redeemed",
    amount: 150,
    balanceAfter: 500,
    reason: "Applied to booking BK-2041",
    createdAt: "2026-05-12",
  },
];

export const adminStats = {
  revenueToday: 12840,
  utilization: "74%",
  pendingBookings: 3,
  activeCourts: 2,
};

export const adminBookings = [
  { id: "BK-2041", player: "Asha Mehta", court: "Court 1", time: "18:00", status: "confirmed", amount: 767 },
  { id: "BK-2040", player: "Raj Kumar", court: "Court 2", time: "19:00", status: "pending_payment", amount: 826 },
  { id: "BK-2038", player: "Walk-in", court: "Court 1", time: "20:00", status: "walk_in", amount: 650 },
];
