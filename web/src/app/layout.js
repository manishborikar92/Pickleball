import { Geist } from "next/font/google";
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
    "Book premium indoor pickleball courts in Besa, Nagpur with secure checkout, WhatsApp verification, ratings, and role-based operations.",
  openGraph: {
    title: "Baseline Arena",
    description: "Premium pickleball court booking for Besa, Nagpur.",
    images: ["/court-3.png"],
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
        {children}
      </body>
    </html>
  );
}
