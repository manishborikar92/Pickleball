export const venue = {
  id: "venue-besa",
  slug: "besa-nagpur",
  name: "Besa, Nagpur",
  brandName: "Baseline Arena",
  address: "Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa-Manish Nagar Road, Nagpur",
  city: "Nagpur",
  timezone: "Asia/Kolkata",
  currency: "INR",
  rolloverTime: "08:00",
  advanceBookingDays: 7,
  phone: "+91 99704 09410",
  secondaryPhone: "+91 90960 30362",
  email: "hello@baselinearena.in",
  hours: "Mon-Sun: 7 AM to 12 AM",
  googleMapsLink: "https://maps.app.goo.gl/18jsuTs2SrhpvGnz8",
  location: {
    lat: 21.0851090,
    lng: 79.0859310,
  },
};

export const courts = [
  {
    id: "court-1",
    venueId: venue.id,
    name: "Court 1",
    environment: "Outdoor",
    surfaceType: "Pro Cushion",
    status: "active",
    price: 500,
  },
  {
    id: "court-2",
    venueId: venue.id,
    name: "Court 2",
    environment: "Outdoor",
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
    name: "Devendra Deshmukh",
    label: "Nagpur Pickleball Club",
    rating: 5,
    quote:
      "Finally, a professional-grade pickleball setup coming to Besa! Spoke with the team last week—they are importing high-quality net systems and using proper cushion surfaces. Visited the site and construction is in full swing. Can't wait to play here once it opens in August!",
  },
  {
    id: "review-2",
    name: "Rithika Sen",
    label: "Intermediate Player",
    rating: 5,
    quote:
      "Nagpur has been desperately needing dedicated pickleball courts. The location in Besa is perfect for players from Manish Nagar and Somalwada. I signed up for their early-access waitlist, and the process was super smooth. Really looking forward to the floodlights for late evening matches!",
  },
  {
    id: "review-3",
    name: "Chinmay Kulkarni",
    label: "Recreational Player",
    rating: 4,
    quote:
      "I have been following the construction updates on their WhatsApp group. The layout plans look top-class. Pro-cushion courts will be a lifesaver for knees compared to the concrete surfaces we play on right now. Rating it 4 stars for now, will upgrade to 5 once I get my paddle on the court!",
  },
  {
    id: "review-4",
    name: "Kavitha Nair",
    label: "Manish Nagar Resident",
    rating: 5,
    quote:
      "Very responsive management! I had a few questions about coaching sessions for beginners, and they replied immediately on WhatsApp. They are planning to host weekend mixers which is exactly what the Nagpur pickleball community needs to grow. Excitement level is 10/10!",
  },
  {
    id: "review-5",
    name: "Abhinav Jaiswal",
    label: "DUPR 3.5 Player",
    rating: 4,
    quote:
      "The website looks slick and clean, was able to fill out the interest form in under a minute. Nagpur has a lot of tennis players switching to pickleball, so having two dedicated courts in a growing area like Besa is a smart move. Hoping they stick to the launch timeline!",
  },
  {
    id: "review-6",
    name: "Tanvi Deshpande",
    label: "Weekend Player",
    rating: 5,
    quote:
      "Super excited about this! Besa is developing so fast, and having recreational facilities like Baseline Arena nearby is amazing. The updates they share show high attention to detail—cushioned flooring, glare-free night lighting, and a neat courtside seating plan. Pre-registered today!",
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
