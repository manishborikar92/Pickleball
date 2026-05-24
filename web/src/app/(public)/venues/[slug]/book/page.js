import { BookingClient } from "@/components/features/booking";
import { getAvailability, getVenue } from "@/lib/api";
import { JsonLd } from "@/components/seo";
import { getPageMetadata } from "@/config/metadata";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const venue = await getVenue();

  const name = venue.name || "Besa, Nagpur";
  const brandName = venue.brandName || "Baseline Arena";

  return getPageMetadata({
    title: `Book Court at ${name} | ${brandName}`,
    description: `Select live pickleball court slots and complete secure checkout at ${brandName} in ${name}. Premium Pro Cushion indoor courts.`,
    path: `/venues/${slug}/book`,
  });
}

export default async function BookPage({ params }) {
  const { slug } = await params;
  const [venue, availability] = await Promise.all([getVenue(), getAvailability()]);

  const locationSchema = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": `https://baselinearena.in/venues/${slug}/book/#venue`,
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
      "streetAddress": "123 Pickleball Way, Besa",
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
      "opens": "06:00",
      "closes": "23:00",
    },
  };

  return (
    <>
      <JsonLd data={locationSchema} />
      <BookingClient venue={venue} courts={venue.courts} availability={availability} />
    </>
  );
}
