import { Card, SectionHeader } from "@/components/shared";
import { reviews } from "@/data/platform";

export function ReviewsSection() {
  return (
    <section className="border-t border-line px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader title="Player Reviews">
          <span className="text-balance">
            Published reviews build trust while admin suppression remains
            available for moderation.
          </span>
        </SectionHeader>

        <ul className="hide-scrollbar slider-nav-animation mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 sm:mt-12 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 lg:gap-8">
          {reviews.map((review) => (
            <li key={review.id} className="flex slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:w-auto sm:shrink">
              <ReviewCard review={review} />
            </li>
          ))}
          {/* Duplicates for extended mobile scrolling */}
          {reviews.map((review, index) => (
            <li key={`dup1-${index}`} aria-hidden="true" className="flex slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:hidden">
              <ReviewCard review={review} />
            </li>
          ))}
          {reviews.map((review, index) => (
            <li key={`dup2-${index}`} aria-hidden="true" className="flex slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:hidden">
              <ReviewCard review={review} />
            </li>
          ))}
          {reviews.map((review, index) => (
            <li key={`dup3-${index}`} aria-hidden="true" className="flex slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:hidden">
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ReviewCard({ review }) {
  return (
    <Card className="flex w-full flex-col p-6 sm:p-8">
      <StarRating rating={review.rating} />
      <blockquote className="mt-4 grow">
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          &ldquo;{review.quote}&rdquo;
        </p>
      </blockquote>
      <div className="mt-6 border-t border-line/50 pt-4">
        <p className="text-sm font-bold text-foreground sm:text-base">
          {review.name}{" "}
          <span className="block font-normal text-muted sm:inline">
            <span className="hidden sm:inline"> — </span>
            {review.label}
          </span>
        </p>
      </div>
    </Card>
  );
}

function StarRating({ rating }) {
  return (
    <div 
      className="flex items-center gap-1.5" 
      role="img" 
      aria-label={`Rated ${rating} out of 5 stars`}
    >
      <div className="flex" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg
            key={i}
            className={`h-5 w-5 ${i < rating ? "text-accent" : "text-muted/20"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <span className="ml-2 text-sm font-bold text-foreground">{rating}/5</span>
    </div>
  );
}