import { SectionHeader } from "@/components/shared";

const STEPS = [
  [
    "1",
    "Book",
    "Pick a court, date, and live slot before authentication interrupts the flow.",
  ],
  [
    "2",
    "Verify",
    "Confirm your phone through WhatsApp OTP only when checkout is ready.",
  ],
  [
    "3",
    "Play",
    "Pay securely, receive confirmation, and arrive with your slot protected.",
  ],
];

export function HowItWorksSection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader title="Seamless Experience">
          <span className="text-balance">
            Browse first, authenticate later, and keep each booking protected
            with a timed hold.
          </span>
        </SectionHeader>

        <ol className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-6 lg:gap-12">
          {STEPS.map(([number, title, body]) => (
            <li key={title}>
              <StepCard number={number} title={title} body={body} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepCard({ number, title, body }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-accent text-xl font-black text-accent shadow-sm sm:h-20 sm:w-20 sm:text-2xl">
        {number}
      </div>
      <h3 className="mt-6 text-lg font-black text-foreground sm:mt-8 sm:text-xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
        {body}
      </p>
    </div>
  );
}