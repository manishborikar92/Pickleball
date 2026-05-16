import { Plus, TicketCheck, Check } from "lucide-react";
import { SectionHeader } from "@/components/shared";

const STEPS = [
  {
    icon: <Plus className="h-7 w-7 sm:h-8 sm:w-8" />,
    title: "Pick Your Slot",
    body: "Choose available slots freely and pick the one that fits your schedule.",
  },
  {
    icon: <TicketCheck className="h-7 w-7 sm:h-8 sm:w-8" />,
    title: "Quick Verify",
    body: "Confirm your identity via WhatsApp OTP only when you are ready to checkout.",
  },
  {
    icon: <Check className="h-7 w-7 sm:h-8 sm:w-8" />,
    title: "Good to Go",
    body: "Secure your slot with payment and receive instant booking confirmation.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader title="Seamless Experience">
          <span className="text-balance">
            Pick your slot, verify once, and show up ready to play — every step made effortless.
          </span>
        </SectionHeader>
        <ol className="mt-12 grid gap-10 sm:mt-16 sm:grid-cols-3 sm:gap-6 lg:gap-12">
          {STEPS.map(({ icon, title, body }) => (
            <li key={title}>
              <StepCard icon={icon} title={title} body={body} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function StepCard({ icon, title, body }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-accent text-accent shadow-sm sm:h-20 sm:w-20">
        {icon}
      </div>
      <h3 className="mt-6 text-lg font-black text-foreground sm:mt-8 sm:text-xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
        {body}
      </p>
    </div>
  );
}