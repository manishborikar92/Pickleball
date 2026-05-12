"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/shared/Button";
import { Card } from "@/components/shared/Card";
import { validateReview } from "@/lib/validation";

export function ReviewForm({ bookingId }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function submitReview(event) {
    event.preventDefault();
    const validation = validateReview({ rating, comment, photoName });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <main className="grid min-h-screen place-items-center px-6 py-12">
        <Card className="w-full max-w-lg p-8 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-accent text-3xl text-black">OK</div>
          <h1 className="mt-6 text-4xl font-black">Review submitted</h1>
          <p className="mt-4 text-muted">
            Thanks for rating booking {bookingId}. The review is now ready for
            moderation and published venue feeds.
          </p>
          <Button href="/" className="mt-7">Back to Venue</Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-background/90 px-6 backdrop-blur-xl">
        <Link href="/" className="grid h-10 w-10 place-items-center rounded-full bg-surface-high text-xl">X</Link>
        <h1 className="text-xl font-black">Review</h1>
        <span className="h-10 w-10" />
      </header>

      <section className="relative h-56 overflow-hidden bg-[url('/designs/review-reference.png')] bg-cover bg-top">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute bottom-0 left-0 p-6">
          <h2 className="text-3xl font-black">Thank you for playing!</h2>
          <p className="mt-2 text-muted">Court 3 - The Apex Club</p>
        </div>
      </section>

      <form onSubmit={submitReview} className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
        <Card className="p-6 text-center">
          <h2 className="text-3xl font-black">How was your experience?</h2>
          <p className="mt-3 text-muted">Tap a star to rate your session.</p>
          <div className="mt-6 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setRating(value);
                  setError("");
                }}
                className={`rounded-lg px-3 py-2 text-sm font-black transition active:scale-90 ${
                  value <= rating ? "bg-accent text-black" : "bg-surface-high text-muted"
                }`}
                aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
              >
                {value}
              </button>
            ))}
          </div>
        </Card>

        <label className="grid gap-3 text-lg font-bold">
          Share your thoughts
          <div className="relative">
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={5}
              placeholder="How was the court surface? Did you have a good game?"
              className="w-full resize-none rounded-lg border border-line bg-surface-panel p-4 text-base font-normal text-foreground placeholder:text-muted/55"
            />
            <span className="absolute bottom-4 right-4 text-xs font-bold uppercase tracking-[0.18em] text-muted/60">
              Optional
            </span>
          </div>
        </label>

        <label className="grid gap-3 text-lg font-bold">
          Add a photo
          <span className="grid min-h-36 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line bg-surface/70 p-6 text-center text-muted hover:border-accent">
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => setPhotoName(event.target.files?.[0]?.name || "")}
            />
            <span className="text-base font-black">Photo</span>
            <span className="mt-2 block text-base font-normal">
              {photoName || "Tap to upload a court selfie"}
            </span>
          </span>
        </label>

        {error ? <p className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-danger">{error}</p> : null}
        <Button type="submit" className="w-full">Submit Review</Button>
      </form>
    </main>
  );
}
