import { SectionHeader } from "@/components/shared";

const FAQS = [
  {
    question: "Do I need my own equipment?",
    answer:
      "Bring your own paddle if you prefer. Rental paddles and balls are available on-site.",
  },
  {
    question: "How far ahead can I book?",
    answer:
      "The venue opens slots for the configured advance booking window after the daily rollover time.",
  },
  {
    question: "What is the cancellation policy?",
    answer:
      "Confirmed bookings are non-refundable. Business-initiated cancellations are handled with wallet credits.",
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