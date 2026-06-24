import { Geist } from "next/font/google";
import Script from "next/script";
import AppProviders from "@/providers/AppProviders";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});



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
        url: "/api/og?title=Baseline Arena&desc=Book premium outdoor pickleball courts in Besa, Nagpur.",
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
    images: ["/api/og?title=Baseline Arena&desc=Book premium outdoor pickleball courts in Besa, Nagpur."],
  },
  appleWebApp: {
    title: "Baseline Arena",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
        <Script
          src={
            process.env.NEXT_PUBLIC_PHONEPE_ENV === "PRODUCTION"
              ? "https://mercury.phonepe.com/web/bundle/checkout.js"
              : "https://mercury-uat.phonepe.com/web/bundle/checkout.js"
          }
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
