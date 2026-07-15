import { Check, Star } from "lucide-react";

import { Button, Card } from "@/components/shared";
import { ReviewSessionBanner, formatSessionDate } from "./ReviewShell";

/**
 * Terminal review state — shown right after a successful submission and on
 * every later visit to the booking's review URL.
 *
 * Deliberately identical for both moments: `revalidateTag` inside the submit
 * action makes Next.js re-render this route in the same round trip, replacing
 * the client form (and any local "just submitted" state) with the server's
 * already-reviewed resolution. One unified view means the swap is invisible —
 * the "Submitted on" caption stays accurate either way.
 *
 * @param {Object} props
 * @param {Object} props.booking - Normalized booking detail (banner context).
 * @param {Object} props.review  - Normalized review ({ rating, comment, createdAt }).
 */
export function ReviewSubmittedView({ booking, review }) {
  const submittedOn = formatSessionDate(review?.createdAt ? String(review.createdAt).slice(0, 10) : "");

  return (
    <>
      <ReviewSessionBanner booking={booking} />
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-10 sm:px-6 md:px-8">
        <Card className="w-full max-w-lg border-t-4 border-t-accent p-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent ring-8 ring-accent/5">
            <Check className="h-10 w-10" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-foreground">Review Submitted</h2>
          <p className="mb-6 text-sm text-muted">
            Thanks for your feedback — it helps other players and the venue.
          </p>

          <RatingStars rating={review?.rating} />

          {review?.comment && (
            <blockquote className="mx-auto mt-5 max-w-md rounded-xl border border-line bg-surface-panel/40 p-4 text-sm italic leading-relaxed text-muted">
              &ldquo;{review.comment}&rdquo;
            </blockquote>
          )}

          {submittedOn && (
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted/70">
              Submitted on {submittedOn}
            </p>
          )}

          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button href="/dashboard/bookings" variant="primary" className="w-full justify-center sm:w-auto">
              View My Bookings
            </Button>
            <Button href="/" variant="secondary" className="w-full justify-center sm:w-auto">
              Back to Home
            </Button>
          </div>
        </Card>
      </div>
    </>
  );
}

function RatingStars({ rating = 0 }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="img"
      aria-label={`Rated ${value} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden="true"
          className={`h-7 w-7 ${star <= value ? "text-accent" : "text-muted/30"}`}
          fill={star <= value ? "currentColor" : "none"}
        />
      ))}
    </div>
  );
}
