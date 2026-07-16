import { verifySession } from "@/lib/dal/session";
import { resolveBookingResult } from "@/lib/services/bookingStatus";
import { getRewardsForBooking } from "@/lib/dal/rewards";
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
  const session = await verifySession();

  const result = await resolveBookingResult(bookingId, session);

  // Rewards issued with this booking's confirmation — the scratch card renders
  // inline on the confirmation view. Non-throwing enhancement read.
  const rewards = result.status === "success"
    ? await getRewardsForBooking(bookingId)
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 flex items-center justify-center">
        {result.status === "success" && (
          <BookingDetailView booking={result.booking} receipt={result.receipt} rewards={rewards} />
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
