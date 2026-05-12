import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  metadataBase: new URL("https://protechcourts.example"),
  title: {
    default: "Pro-Tech Courts | Pickleball Booking in Besa, Nagpur",
    template: "%s | Pro-Tech Courts",
  },
  description:
    "Book premium indoor pickleball courts in Besa, Nagpur with secure checkout, WhatsApp verification, ratings, and role-based operations.",
  openGraph: {
    title: "Pro-Tech Courts",
    description: "Premium pickleball court booking for Besa, Nagpur.",
    images: ["/court-3.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
