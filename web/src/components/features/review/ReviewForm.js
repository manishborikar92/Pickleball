"use client";

import { useActionState, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { LogIn, Star } from "lucide-react";

import { Button, Card } from "@/components/shared";
import { reviewSchema } from "@/lib/schemas";
import { submitReview } from "@/lib/actions/review";
import { ReviewSessionBanner } from "./ReviewShell";
import { ReviewSubmittedView } from "./ReviewSubmittedView";

const COMMENT_MAX = 1000; // matches the backend contract (reviews.validators.js)
const RATING_LABELS = { 1: "Poor", 2: "Fair", 3: "Good", 4: "Great", 5: "Excellent" };

/* ── Main Component ──────────────────────────────── */

/**
 * The review submission form. Only rendered by the page orchestrator once the
 * server has resolved the "form" state (authenticated owner, completed booking,
 * no existing review) — so every visible form is submittable.
 *
 * @param {Object} props
 * @param {string} props.bookingId
 * @param {Object} props.booking - Normalized booking detail for session context.
 */
export function ReviewForm({ bookingId, booking }) {
  const router = useRouter();
  const draftKey = `review-draft:${bookingId}`;

  // Draft persistence (best-effort): if the session expires mid-form and the
  // user signs back in via /login?next=…, their rating/comment are restored.
  // The stored draft seeds the inputs until the user touches them; the
  // hydration-safe read happens via useSyncExternalStore (server snapshot null).
  const draft = useStoredDraft(draftKey);
  const [ratingInput, setRatingInput] = useState(null);
  const [commentInput, setCommentInput] = useState(null);
  const rating = ratingInput ?? draft.rating;
  const comment = commentInput ?? draft.comment;

  useEffect(() => {
    try {
      if (rating || comment) {
        window.sessionStorage.setItem(draftKey, JSON.stringify({ rating, comment }));
      }
    } catch {
      // Persistence is an enhancement only.
    }
  }, [draftKey, rating, comment]);

  // React 19 form action (HI-11): the client wrapper validates with the shared
  // schema for instant feedback, then defers to the server action which
  // re-validates authoritatively. `pending` is read via useFormStatus below.
  const [state, formAction] = useActionState(
    async (_prev, formData) => {
      const parsed = reviewSchema.safeParse({
        rating: Number(formData.get("rating")),
        comment: formData.get("comment"),
      });
      if (!parsed.success) {
        return {
          ok: false,
          error: { code: "bad_request", message: parsed.error.issues[0]?.message || "Please complete the review." },
        };
      }
      const result = await submitReview(bookingId, {
        rating: parsed.data.rating,
        comment: parsed.data.comment || undefined,
      });
      if (result.ok) {
        try {
          window.sessionStorage.removeItem(draftKey);
        } catch {
          // Ignore — the draft simply lingers for the session.
        }
      }
      return result;
    },
    { ok: false, error: null },
  );

  // A conflict means a review already exists (double submission or another
  // tab). Re-resolve the page server-side so the submitted state takes over.
  const isConflict = !state.ok && state.error?.code === "conflict";
  useEffect(() => {
    if (!isConflict) return;
    const timer = setTimeout(() => router.refresh(), 1200);
    return () => clearTimeout(timer);
  }, [isConflict, router]);

  // Fallback only: on success the action's `revalidateTag` re-renders the route
  // server-side, which swaps this form for the page-level ReviewSubmittedView.
  // Rendering the SAME view here makes that swap invisible if it races or is
  // skipped, instead of flashing a divergent "thank you" variant.
  if (state.ok) {
    return (
      <ReviewSubmittedView booking={booking} review={state.data || { rating, comment }} />
    );
  }

  const isUnauthorized = state.error?.code === "unauthorized";

  return (
    <>
      <ReviewSessionBanner booking={booking} />

      <form
        action={formAction}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 md:px-8 md:py-10"
        noValidate
      >
        {/* The star widget is not a native control — mirror its value into a
            hidden field so it is included in the submitted FormData. */}
        <input type="hidden" name="rating" value={rating} />

        <StarRatingCard rating={rating} onRate={setRatingInput} />

        <CommentField value={comment} onChange={setCommentInput} />

        {state.error && !isUnauthorized && (
          <FormError
            message={isConflict ? `${state.error.message} Loading your review…` : state.error.message}
          />
        )}
        {isUnauthorized && (
          <SessionExpiredNotice bookingId={bookingId} message={state.error.message} />
        )}

        <div className="pt-2 sm:pt-4">
          <SubmitButton ratingSelected={rating > 0} />
        </div>
      </form>
    </>
  );
}

const EMPTY_DRAFT = { rating: 0, comment: "" };
const subscribeNever = () => () => {};

/**
 * Hydration-safe sessionStorage read: the server snapshot is null (SSR renders
 * a pristine form) and the client snapshot re-seeds the inputs after hydration
 * without a setState-in-effect cascade.
 */
function useStoredDraft(draftKey) {
  const raw = useSyncExternalStore(
    subscribeNever,
    () => {
      try {
        return window.sessionStorage.getItem(draftKey);
      } catch {
        return null;
      }
    },
    () => null,
  );

  return useMemo(() => {
    if (!raw) return EMPTY_DRAFT;
    try {
      const draft = JSON.parse(raw);
      const draftRating = Number(draft?.rating);
      return {
        rating: Number.isInteger(draftRating) && draftRating >= 1 && draftRating <= 5 ? draftRating : 0,
        comment: typeof draft?.comment === "string" ? draft.comment.slice(0, COMMENT_MAX) : "",
      };
    } catch {
      return EMPTY_DRAFT;
    }
  }, [raw]);
}

function SubmitButton({ ratingSelected }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="submit"
        className="w-full text-lg transition-transform active:scale-[0.98]"
        disabled={pending || !ratingSelected}
      >
        {pending ? "Submitting..." : "Submit Review"}
      </Button>
      {!ratingSelected && (
        <p className="text-center text-xs font-semibold text-muted">
          Select a star rating to submit your review.
        </p>
      )}
    </div>
  );
}

/* ── Sub-components ──────────────────────────────── */

function StarRatingCard({ rating, onRate }) {
  const [hoverRating, setHoverRating] = useState(0);

  // Radiogroup keyboard contract: arrow keys move the selection.
  function handleKeyDown(event) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault();
      onRate(Math.min(5, (rating || 0) + 1));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault();
      onRate(Math.max(1, (rating || 2) - 1));
    }
  }

  return (
    <Card className="p-5 text-center sm:p-6 md:p-8">
      <h2 className="text-2xl font-black sm:text-3xl">How was your experience?</h2>
      <p className="mt-2 text-sm text-muted sm:mt-3 sm:text-base">
        Tap a star to rate your session.
      </p>

      <div
        className="mt-5 flex justify-center gap-2 sm:mt-6 sm:gap-3"
        role="radiogroup"
        aria-label="Star rating"
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setHoverRating(0)}
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <StarButton
            key={value}
            value={value}
            isFilled={value <= (hoverRating || rating)}
            isSelected={value === rating}
            tabbable={value === rating || (rating === 0 && value === 1)}
            onClick={() => onRate(value)}
            onMouseEnter={() => setHoverRating(value)}
          />
        ))}
      </div>
      <p
        className="mt-4 min-h-4 text-xs font-bold uppercase tracking-[0.18em] text-muted"
        aria-live="polite"
      >
        {RATING_LABELS[hoverRating || rating] || ""}
      </p>
    </Card>
  );
}

function StarButton({ value, isFilled, isSelected, tabbable, onClick, onMouseEnter }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabIndex={tabbable ? 0 : -1}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      aria-label={`${value} star${value === 1 ? "" : "s"}`}
      className={`grid h-12 w-12 place-items-center rounded-lg transition-all duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:h-14 sm:w-14 md:h-16 md:w-16 ${
        isFilled
          ? "bg-accent text-black scale-105 shadow-sm"
          : "bg-surface-high text-muted hover:bg-surface-high/80"
      }`}
    >
      <Star
        className="h-6 w-6 sm:h-7 sm:w-7"
        fill={isFilled ? "currentColor" : "none"}
        aria-hidden="true"
      />
    </button>
  );
}

function CommentField({ value, onChange }) {
  const remaining = COMMENT_MAX - value.length;
  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <label htmlFor="comment" className="text-base font-bold sm:text-lg">
        Share your thoughts
      </label>
      <div className="relative">
        <textarea
          id="comment"
          name="comment"
          value={value}
          maxLength={COMMENT_MAX}
          onChange={(e) => onChange(e.target.value.slice(0, COMMENT_MAX))}
          rows={5}
          placeholder="How was the court surface? Did you have a good game?"
          className="w-full resize-none rounded-xl border border-line bg-surface-panel p-4 pb-10 text-base font-normal text-foreground placeholder:text-muted/55 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:resize-y sm:p-5 sm:pb-12"
        />
        <span className="pointer-events-none absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted/60 sm:bottom-4 sm:right-4 sm:text-xs">
          {value.length === 0 ? "Optional" : `${remaining} left`}
        </span>
      </div>
    </div>
  );
}

function FormError({ message }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-center gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm font-medium text-danger animate-in fade-in slide-in-from-top-2"
    >
      <span aria-hidden="true" className="text-lg">⚠</span>
      <p>{message}</p>
    </div>
  );
}

/**
 * Rare edge: the session died between page load and submit (refresh-token
 * expiry, cookies cleared). The draft is already in sessionStorage, so signing
 * back in through /login?next=… restores the exact form state.
 */
function SessionExpiredNotice({ bookingId, message }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-medium text-amber-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>{message} Your rating and comment are saved on this device.</p>
      <Button
        href={`/login?next=${encodeURIComponent(`/review/${bookingId}`)}`}
        variant="secondary"
        className="shrink-0 justify-center"
      >
        <LogIn className="mr-2 h-4 w-4" />
        <span>Sign In</span>
      </Button>
    </div>
  );
}
