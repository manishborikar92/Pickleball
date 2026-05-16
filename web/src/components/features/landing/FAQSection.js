import { SectionHeader } from "@/components/shared";

const FAQS = [
  {
    question: "Do I need my own equipment to play?",
    answer:
      "Bring your own paddle if you prefer playing with familiar gear. However, paddles and balls are available on-site for free.",
  },
  {
    question: "How early can I book a court?",
    answer:
      "You can book in advance within our available booking window. Slots open daily after rollover time, so we recommend booking early to secure your preferred time.",
  },
  {
    question: "Can I cancel or get a refund after booking?",
    answer:
      "All confirmed bookings are non-refundable. If a cancellation is initiated from our side, you will receive full credits directly to your wallet for future use.",
  },
  {
    question: "Can I bring friends or family who are not playing?",
    answer:
      "Yes, spectators are always welcome. We have seating available courtside so your friends and family can comfortably watch and cheer you on.",
  },
    {
    question: "Can I book a court for a group or private event?",
    answer:
      "Yes, our courts are available for group sessions, corporate events, and private bookings. Contact us directly to discuss availability and arrangements.",
  },
];

export function FAQSection() {
  return (
    <section className="border-t border-line px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeader title="Common Questions" />
        <div className="mt-8 grid gap-4 sm:mt-10 sm:gap-5">
          {FAQS.map(({ question, answer }) => (
            <FAQItem key={question} question={question} answer={answer} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQItem({ question, answer }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-line bg-surface-panel transition-colors hover:border-line/80 open:bg-surface-panel/50">
      <summary className="cursor-pointer list-none p-5 font-bold outline-none transition-all focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:p-6 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-4">
          <span className="text-balance pr-2 text-base sm:text-lg">{question}</span>
          <span className="shrink-0 text-accent" aria-hidden="true">
            <svg
              className="h-5 w-5 transition-transform duration-300 ease-in-out group-open:rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </span>
        </span>
      </summary>
      <div className="px-5 pb-5 sm:px-6 sm:pb-6">
        <p className="text-sm leading-relaxed text-muted sm:text-base">
          {answer}
        </p>
      </div>
    </details>
  );
}