"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, UserCircle } from "lucide-react";

import { Button, Card } from "@/components/shared";
import { validateReview } from "@/lib/validation";
import { submitReview } from "@/app/(booking)/review/actions";

/* ── Main Component ──────────────────────────────── */

export function ReviewForm({ bookingId }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [error, setError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const validation = validateReview({ rating, comment, photoName });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitReview(bookingId, {
        rating: validation.value.rating,
        comment: validation.value.comment || undefined,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      setIsSuccess(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSuccess) {
    return (
      <main className="min-h-screen bg-background pb-8 md:pb-12">
        <ReviewHeader />
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center gap-6 px-4 py-16 sm:px-6 md:px-8">
          <Card className="w-full max-w-md p-8 text-center">
            <div className="mb-4 text-6xl">✅</div>
            <h2 className="text-2xl font-black">Thank you!</h2>
            <p className="mt-2 text-muted">Your review has been submitted successfully.</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button asChild>
                <Link href="/dashboard/bookings">View My Bookings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back to Home</Link>
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
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 md:px-8 md:py-10"
        noValidate
      >
        <StarRatingCard
          rating={rating}
          onRate={(value) => {
            setRating(value);
            if (error) setError(""); // Clear error upon user action
          }}
        />

        <CommentField value={comment} onChange={setComment} />

        <PhotoUpload photoName={photoName} onPhotoSelect={setPhotoName} />

        {error && <FormError message={error} />}

        <div className="pt-2 sm:pt-4">
          <Button
            type="submit"
            className="w-full text-lg transition-transform active:scale-[0.98]"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Submit Review"}
          </Button>
        </div>
      </form>
    </main>
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

function PhotoUpload({ photoName, onPhotoSelect }) {
  return (
    <div className="flex flex-col gap-2 sm:gap-3">
      <span className="text-base font-bold sm:text-lg" id="photo-upload-label">
        Add a photo
      </span>
      <label 
        htmlFor="photo-upload"
        className="group relative flex min-h-[8rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-line bg-surface/70 p-6 text-center text-muted transition-all hover:border-accent hover:bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-background sm:min-h-[10rem]"
      >
        <input
          id="photo-upload"
          type="file"
          accept="image/jpeg, image/png, image/heic"
          className="sr-only"
          aria-labelledby="photo-upload-label"
          onChange={(e) => onPhotoSelect(e.target.files?.[0]?.name ?? "")}
        />
        
        <span className="flex flex-col items-center gap-2">
          <span className="text-2xl sm:text-3xl" aria-hidden="true">
            {photoName ? "📸" : "📷"}
          </span>
          <span className="max-w-[200px] truncate text-sm font-black text-foreground sm:max-w-xs sm:text-base">
            {photoName ? photoName : "Tap to upload a court selfie"}
          </span>
        </span>

        {!photoName && (
          <span className="mt-2 block text-xs text-muted/80 sm:text-sm">
            JPG, PNG, or HEIC up to 10MB
          </span>
        )}
      </label>
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
