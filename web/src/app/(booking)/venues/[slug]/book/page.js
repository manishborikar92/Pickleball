import { connection } from "next/server";
import Script from "next/script";
import { BookingClient } from "@/components/features/booking";
import { getVenue } from "@/lib/dal/venues";
import { getAvailability } from "@/lib/dal/availability";
import { getWallet } from "@/lib/dal/wallet";
import { verifySession } from "@/lib/dal/session";
import { JsonLd } from "@/components/seo";
import { getPageMetadata } from "@/config/metadata.config";
import { getTodayDateString } from "@/lib/bookingEngine";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const venue = await getVenue(slug);

  const name = venue.name || "Besa, Nagpur";
  const brandName = venue.brandName || "Baseline Arena";

  return getPageMetadata({
    title: `Book Court at ${name} | ${brandName}`,
    description: `Select live pickleball court slots and complete secure checkout at ${brandName} in ${name}. Premium Pro Cushion outdoor courts.`,
    path: `/venues/${slug}/book`,
  });
}

export default async function BookPage({ params }) {
  await connection();
  const { slug } = await params;
  const [venue, session] = await Promise.all([getVenue(slug), verifySession()]);
  const initialDate = getTodayDateString(venue.timezone);
  const [availability, wallet] = await Promise.all([
    getAvailability({ venueId: venue.id, date: initialDate }),
    // Wallet credits are applied at checkout; fetch the balance for signed-in
    // customers so the summary can show the UPI-vs-wallet split up front. Anonymous
    // users (or a failed read) simply get no wallet line. verifySession() is
    // request-cached, so getWallet() reuses the same /users/me round-trip.
    session?.user ? getWallet().catch(() => null) : Promise.resolve(null),
  ]);
  const walletBalance = wallet?.balance ?? 0;

  const locationSchema = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    // Canonical venue entity id — shared with the landing page node so both
    // describe one entity with consistent values (LO-6).
    "@id": "https://baselinearena.in/#venue",
    "name": `${venue.brandName} ${venue.name}`,
    "image": [
      "https://baselinearena.in/court-1.png",
      "https://baselinearena.in/court-2.png",
      "https://baselinearena.in/court-3.png",
    ],
    "priceRange": "₹₹",
    "telephone": venue.phone,
    "email": venue.email,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Baseline Arena, Plot No. 78, Sanskriti Society, Behind Puma Outlet, Besa–Manish Nagar Road",
      "addressLocality": "Nagpur",
      "addressRegion": "Maharashtra",
      "postalCode": "440037",
      "addressCountry": "IN",
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": venue.location.lat,
      "longitude": venue.location.lng,
    },
    "url": `https://baselinearena.in/venues/${slug}/book`,
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      "opens": "07:00",
      "closes": "00:00",
    },
  };

  const phonePeSrc = process.env.NEXT_PUBLIC_PHONEPE_ENV === "PRODUCTION"
    ? "https://mercury.phonepe.com/web/bundle/checkout.js"
    : "https://mercury-uat.phonepe.com/web/bundle/checkout.js";

  return (
    <>
      <JsonLd data={locationSchema} />
      <BookingClient
        venue={venue}
        courts={venue.courts}
        availability={availability}
        initialDate={initialDate}
        session={session}
        walletBalance={walletBalance}
      />
      <Script src={phonePeSrc} strategy="lazyOnload" />
    </>
  );
}
