import { Card, SectionHeader } from "@/components/shared";

const reviews = [
  {
    id: "review-1",
    name: "Devendra Deshmukh",
    label: "Nagpur Pickleball Club",
    rating: 5,
    quote:
      "Finally, a professional-grade pickleball setup coming to Besa! Spoke with the team last week—they are importing high-quality net systems and using proper cushion surfaces. Visited the site and construction is in full swing. Can't wait to play here once it opens in August!",
  },
  {
    id: "review-2",
    name: "Rithika Sen",
    label: "Intermediate Player",
    rating: 5,
    quote:
      "Nagpur has been desperately needing dedicated pickleball courts. The location in Besa is perfect for players from Manish Nagar and Somalwada. Booked my first session online, and the process was super smooth. Really looking forward to the floodlights for late evening matches!",
  },
  {
    id: "review-3",
    name: "Chinmay Kulkarni",
    label: "Recreational Player",
    rating: 4,
    quote:
      "I have been following the construction updates on their WhatsApp group. The layout plans look top-class. Pro-cushion courts will be a lifesaver for knees compared to the concrete surfaces we play on right now. Rating it 4 stars for now, will upgrade to 5 once I get my paddle on the court!",
  },
  {
    id: "review-4",
    name: "Kavitha Nair",
    label: "Manish Nagar Resident",
    rating: 5,
    quote:
      "Very responsive management! I had a few questions about coaching sessions for beginners, and they replied immediately on WhatsApp. They are planning to host weekend mixers which is exactly what the Nagpur pickleball community needs to grow. Excitement level is 10/10!",
  },
  {
    id: "review-5",
    name: "Abhinav Jaiswal",
    label: "DUPR 3.5 Player",
    rating: 4,
    quote:
      "The website looks slick and clean, and the booking flow is super smooth. Nagpur has a lot of tennis players switching to pickleball, so having two dedicated courts in a growing area like Besa is a smart move. Hoping to see more court slots open up soon!",
  },
  {
    id: "review-6",
    name: "Tanvi Deshpande",
    label: "Weekend Player",
    rating: 5,
    quote:
      "Super excited about this! Besa is developing so fast, and having recreational facilities like Baseline Arena nearby is amazing. The updates they share show high attention to detail—cushioned flooring, glare-free night lighting, and a neat courtside seating plan. Pre-registered today!",
  },
];

export function ReviewsSection() {
  return (
    <section className="border-t border-line px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader title="Player Reviews">
          <span className="text-balance">
            Published reviews build trust while admin suppression remains available for moderation.
          </span>
        </SectionHeader>

        <ul 
          className="hide-scrollbar mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:flex-wrap sm:justify-center sm:gap-6 lg:grid lg:grid-cols-3 lg:gap-8 sm:overflow-visible sm:pb-0"
          role="list"
          aria-label="Player Testimonials"
        >
          {reviews.map((review) => (
            <li 
              key={review.id} 
              className="flex w-[82vw] max-w-[310px] shrink-0 snap-center sm:w-[calc(50%-12px)] sm:shrink-0 lg:w-auto"
            >
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ReviewCard({ review }) {
  const initials = (review?.name || "Anonymous")
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="flex w-full flex-col bg-surface-soft/40 backdrop-blur-sm border-line/60 p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-[0_12px_30px_rgba(202,255,0,0.03)] focus-within:ring-2 focus-within:ring-accent sm:p-8">
      <div className="flex items-center justify-between gap-4">
        {/* Initials Profile Avatar */}
        <div 
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-xs font-black tracking-wider text-accent"
          aria-hidden="true"
        >
          {initials}
        </div>
        {/* Testimonial Star Ratings */}
        <StarRating rating={review.rating} />
      </div>

      <blockquote className="relative mt-6 grow">
        <span className="pointer-events-none absolute -top-4 -left-2 text-6xl font-serif text-accent/5 select-none leading-none">
          &ldquo;
        </span>
        <p className="relative text-sm leading-relaxed text-muted sm:text-base">
          &ldquo;{review.quote}&rdquo;
        </p>
      </blockquote>

      <div className="mt-6 border-t border-line/40 pt-4">
        <p className="text-sm font-bold text-foreground sm:text-base">
          {review.name}
          <span className="mt-0.5 block text-xs font-normal text-muted sm:inline sm:mt-0 sm:text-sm">
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
      <span className="ml-1 text-xs font-black text-foreground">{rating}/5</span>
    </div>
  );
}