import { Header, Footer } from "@/components/layout";

/**
 * Shared layout for post-payment booking status routes (/booking/[bookingId],
 * /booking/redirect, /booking/error). Provides consistent Header/Footer shell and
 * centered layout for confirmation, receipt, redirect, and error views.
 */
export default function BookingStatusLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center">
        {children}
      </main>
      <Footer />
    </div>
  );
}
