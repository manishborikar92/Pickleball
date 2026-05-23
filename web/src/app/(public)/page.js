import { Header } from "@/components/layout";
import { CourtsSection } from "@/components/features/landing";
import { FAQSection } from "@/components/features/landing";
import { FacilitySection } from "@/components/features/landing";
import { HeroSection } from "@/components/features/landing";
import { HowItWorksSection } from "@/components/features/landing";
import { Footer } from "@/components/layout";
import { LocationSection } from "@/components/features/landing";
import { ReviewsSection } from "@/components/features/landing";
import { JsonLd } from "@/components/seo";

export const metadata = {
  title: "Baseline Arena | Pickleball Booking in Besa, Nagpur",
  description:
    "Book premium indoor pickleball courts in Besa, Nagpur with secure checkout, WhatsApp verification, ratings, and role-based operations.",
  alternates: {
    canonical: "/",
  },
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://baselinearena.in/#organization",
  "name": "Baseline Arena",
  "url": "https://baselinearena.in",
  "logo": "https://baselinearena.in/baseline-full-logo.svg",
  "sameAs": ["https://instagram.com/baseline.arena"],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+91-88012-34687",
    "contactType": "customer service",
    "email": "hello@baselinearena.in",
    "areaServed": "IN",
  },
};

const locationSchema = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "@id": "https://baselinearena.in/#venue",
  "name": "Baseline Arena Besa, Nagpur",
  "image": [
    "https://baselinearena.in/court-1.png",
    "https://baselinearena.in/court-2.png",
    "https://baselinearena.in/court-3.png",
  ],
  "priceRange": "₹₹",
  "telephone": "+91-88012-34687",
  "email": "hello@baselinearena.in",
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
    "latitude": 21.0772,
    "longitude": 79.0664,
  },
  "url": "https://baselinearena.in/venues/besa-nagpur/book",
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

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need my own equipment to play?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Bring your own paddle if you prefer playing with familiar gear. However, paddles and balls are available on-site for free.",
      },
    },
    {
      "@type": "Question",
      "name": "How early can I book a court?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "You can book in advance within our available booking window. Slots open daily after rollover time, so we recommend booking early to secure your preferred time.",
      },
    },
    {
      "@type": "Question",
      "name": "Can I cancel or get a refund after booking?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "All confirmed bookings are non-refundable. If a cancellation is initiated from our side, you will receive full credits directly to your wallet for future use.",
      },
    },
    {
      "@type": "Question",
      "name": "Can I bring friends or family who are not playing?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, spectators are always welcome. We have seating available courtside so your friends and family can comfortably watch and cheer you on.",
      },
    },
    {
      "@type": "Question",
      "name": "Can I book a court for a group or private event?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, our courts are available for group sessions, corporate events, and private bookings. Contact us directly to discuss availability and arrangements.",
      },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <JsonLd data={orgSchema} />
      <JsonLd data={locationSchema} />
      <JsonLd data={faqSchema} />
      <main>
        <Header />
        <HeroSection />
        <CourtsSection />
        <FacilitySection />
        <HowItWorksSection />
        <ReviewsSection />
        <LocationSection />
        <FAQSection />
        <Footer />
      </main>
    </>
  );
}
