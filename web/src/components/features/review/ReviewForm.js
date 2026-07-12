"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { ArrowLeft, UserCircle, Check } from "lucide-react";

import { Button, Card } from "@/components/shared";
import { reviewSchema } from "@/lib/schemas";
import { submitReview } from "@/lib/actions/review";

/* ── Main Component ──────────────────────────────── */

export function ReviewForm({ bookingId }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

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
        return { ok: false, error: { message: parsed.error.issues[0]?.message || "Please complete the review." } };
      }
      return submitReview(bookingId, {
        rating: parsed.data.rating,
        comment: parsed.data.comment || undefined,
      });
    },
    { ok: false, error: null },
  );

  if (state.ok) {
    return (
      <main className="min-h-screen bg-background pb-8 md:pb-12">
        <ReviewHeader />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-16 sm:px-6 md:px-8">
          <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-accent">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/10 text-accent ring-8 ring-accent/5">
              <Check className="h-10 w-10" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">Thank You!</h1>
            <p className="mb-6 text-sm text-muted">Your review has been submitted successfully.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center w-full">
              <Button href="/dashboard/bookings" variant="primary" className="w-full sm:w-auto justify-center">
                View My Bookings
              </Button>
              <Button href="/" variant="secondary" className="w-full sm:w-auto justify-center">
                Back to Home
              </Button>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-8 md:pb-12">
      <ReviewHeader />
      <CourtBanner />

      <form
        action={formAction}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 md:px-8 md:py-10"
        noValidate
      >
        {/* The star widget is not a native control — mirror its value into a
            hidden field so it is included in the submitted FormData. */}
        <input type="hidden" name="rating" value={rating} />

        <StarRatingCard rating={rating} onRate={setRating} />

        <CommentField value={comment} onChange={setComment} />

        {state.error && <FormError message={state.error.message} />}

        <div className="pt-2 sm:pt-4">
          <SubmitButton />
        </div>
      </form>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full text-lg transition-transform active:scale-[0.98]"
      disabled={pending}
    >
      {pending ? "Submitting..." : "Submit Review"}
    </Button>
  );
}

/* ── Sub-components ──────────────────────────────── */

function ReviewHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm font-bold text-muted transition-colors hover:text-accent"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </Link>
        <h1 className="text-lg font-black text-foreground sm:text-xl">
          Leave a Review
        </h1>
        <Link
          href="/dashboard/overview"
          className="flex items-center gap-1.5 text-sm font-bold text-muted transition-colors hover:text-accent"
          aria-label="Go to account"
        >
          <UserCircle className="h-5 w-5" />
          <span className="hidden sm:inline">Account</span>
        </Link>
      </div>
    </header>
  );
}

function CourtBanner() {
  return (
    <section className="relative h-44 w-full overflow-hidden bg-[url('/court-3.png')] bg-cover bg-center sm:h-56 md:h-64 lg:rounded-b-2xl max-w-5xl mx-auto">
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      <div className="absolute bottom-0 left-0 flex w-full flex-col p-4 sm:p-6 md:p-8">
        <h2 className="text-2xl font-black leading-tight sm:text-3xl md:text-4xl">
          Thank you for playing!
        </h2>
        <p className="mt-1 text-sm text-muted sm:mt-2 sm:text-base md:text-lg">
          Court 3 — The Apex Club
        </p>
      </div>
    </section>
  );
}

function StarRatingCard({ rating, onRate }) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <Card className="p-5 text-center sm:p-6 md:p-8">
      <h2 className="text-2xl font-black sm:text-3xl">How was your experience?</h2>
      <p className="mt-2 text-sm text-muted sm:mt-3 sm:text-base">
        Tap a star to rate your session.
      </p>
      
      <div 
        className="mt-5 flex justify-center gap-2 sm:mt-6 sm:gap-3"
        role="radiogroup" 
        aria-label="Star Rating"
      >
        {[1, 2, 3, 4, 5].map((value) => (
          <StarButton
            key={value}
            value={value}
            isActive={value <= (hoverRating || rating)}
            onClick={() => onRate(value)}
            onMouseEnter={() => setHoverRating(value)}
            onMouseLeave={() => setHoverRating(0)}
          />
        ))}
      </div>
    </Card>
  );
}

function StarButton({ value, isActive, onClick, onMouseEnter, onMouseLeave }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isActive}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-label={`${value} star${value === 1 ? "" : "s"}`}
      className={`grid h-12 w-12 place-items-center rounded-lg text-xl font-black transition-all duration-200 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface sm:h-14 sm:w-14 sm:text-2xl md:h-16 md:w-16 ${
        isActive 
          ? "bg-accent text-black scale-105 shadow-sm" 
          : "bg-surface-high text-muted hover:bg-surface-high/80"
      }`}
    >
      {value}
    </button>
  );
}

function CommentField({ value, onChange }) {
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
          onChange={(e) => onChange(e.target.value)}
          rows={5}
          placeholder="How was the court surface? Did you have a good game?"
          className="w-full resize-none rounded-xl border border-line bg-surface-panel p-4 pb-10 text-base font-normal text-foreground placeholder:text-muted/55 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:resize-y sm:p-5 sm:pb-12"
        />
        <span className="absolute bottom-3 right-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted/60 sm:bottom-4 sm:right-4 sm:text-xs pointer-events-none">
          Optional
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
