import { Geist, Montserrat } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Brand display font. Loaded once here (ME-10) and exposed as a CSS variable
// instead of being pulled into the Header component.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: "800",
  display: "swap",
});

// Query-encoded OG image URL (spaces/commas must be percent-encoded — LO-7).
const OG_IMAGE = `/api/og?title=${encodeURIComponent("Baseline Arena")}&desc=${encodeURIComponent(
  "Book premium outdoor pickleball courts in Besa, Nagpur.",
)}`;

export const metadata = {
  metadataBase: new URL("https://baselinearena.in"),
  title: {
    default: "Baseline Arena | Pickleball Booking in Besa, Nagpur",
    template: "%s | Baseline Arena",
  },
  description:
    "Book premium outdoor pickleball courts in Besa, Nagpur with secure checkout, WhatsApp verification, ratings, and instant booking confirmation.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://baselinearena.in",
    title: "Baseline Arena | Pickleball Booking in Besa, Nagpur",
    description:
      "Book premium outdoor pickleball courts in Besa, Nagpur with secure checkout, WhatsApp verification, ratings, and instant booking confirmation.",
    siteName: "Baseline Arena",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Baseline Arena | Pickleball Booking in Besa, Nagpur",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Baseline Arena | Pickleball Booking in Besa, Nagpur",
    description:
      "Book premium outdoor pickleball courts in Besa, Nagpur with secure checkout, WhatsApp verification, ratings, and instant booking confirmation.",
    images: [OG_IMAGE],
  },
  appleWebApp: {
    title: "Baseline Arena",
  },
};

export const viewport = {
  themeColor: "#0d0f04",
  colorScheme: "dark",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}
