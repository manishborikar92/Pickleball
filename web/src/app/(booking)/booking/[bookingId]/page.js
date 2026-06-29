import { getSession } from "@/lib/session";
import { resolveBookingResult } from "@/lib/bookingResolver";
import { Header, Footer } from "@/components/layout";
import {
  BookingDetailView,
  BookingPendingView,
  BookingFailedView,
  BookingErrorView,
} from "@/components/features/booking";

export default async function BookingStatusOrchestrator(props) {
  const params = await props.params;
  const bookingId = params.bookingId;
  const session = await getSession();

  const result = await resolveBookingResult(bookingId, session);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        {result.status === "success" && (
          <BookingDetailView booking={result.booking} receipt={result.receipt} />
        )}
        {result.status === "pending" && (
          <BookingPendingView bookingId={bookingId} booking={result.booking} />
        )}
        {result.status === "failed" && (
          <BookingFailedView booking={result.booking} />
        )}
        {result.status === "expired" && (
          <BookingErrorView type="expired" booking={result.booking} />
        )}
        {result.status === "cancelled" && (
          <BookingErrorView type="cancelled" booking={result.booking} />
        )}
        {result.status === "forbidden" && (
          <BookingErrorView type="forbidden" />
        )}
        {result.status === "unauthorized" && (
          <BookingErrorView type="unauthorized" redirectBookingId={bookingId} />
        )}
        {result.status === "error" && (
          <BookingErrorView type={result.errorType || "generic"} message={result.message} />
        )}
      </main>
      <Footer />
    </div>
  );
}
