import { redirect } from "next/navigation";

import { verifySession } from "@/lib/dal/session";
import { resolveReviewResult } from "@/lib/services/reviewStatus";
import { getPageMetadata } from "@/config/metadata.config";
import { VENUE } from "@/config/venue.config";
import {
  ReviewForm,
  ReviewShell,
  ReviewSubmittedView,
  ReviewStatusView,
} from "@/components/features/review";

export async function generateMetadata({ params }) {
  const { bookingId } = await params;
  return getPageMetadata({
    title: "Rate Your Experience",
    description: `Rate your pickleball court booking experience at ${VENUE.brandName}, ${VENUE.city}.`,
    path: `/review/${bookingId}`,
    isPrivate: true,
  });
}

/**
 * Review lifecycle orchestrator (mirrors BookingStatusOrchestrator): the state
 * is resolved server-side so users are never shown a form they can't submit —
 * authentication, ownership, booking eligibility, and the one-review-per-booking
 * rule are all settled before render.
 */
export default async function ReviewPage({ params }) {
  const { bookingId } = await params;
  const session = await verifySession();

  // Backend review routes require a completed profile; mirror requireUser's
  // onboarding gate and return here afterwards.
  if (session?.user && session.role === "customer" && !session.user.name) {
    redirect(`/onboarding?next=${encodeURIComponent(`/review/${bookingId}`)}`);
  }

  const result = await resolveReviewResult(bookingId, session);

  return (
    <ReviewShell>
      {result.status === "form" && (
        <ReviewForm bookingId={bookingId} booking={result.booking} />
      )}
      {result.status === "already_reviewed" && (
        <ReviewSubmittedView booking={result.booking} review={result.review} />
      )}
      {!["form", "already_reviewed"].includes(result.status) && (
        <ReviewStatusView
          type={result.status}
          bookingId={bookingId}
          booking={result.booking}
          message={result.message}
        />
      )}
    </ReviewShell>
  );
}
