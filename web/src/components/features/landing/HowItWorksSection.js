import { Plus, TicketCheck, Check } from "lucide-react";
import { SectionHeader } from "@/components/shared";

const STEPS = [
  {
    icon: <Plus className="h-6 w-6 sm:h-7 sm:w-7" />,
    title: "Pick Your Slot",
    body: "Choose available slots freely and pick the one that fits your schedule.",
  },
  {
    icon: <TicketCheck className="h-6 w-6 sm:h-7 sm:w-7" />,
    title: "Quick Verify",
    body: "Confirm your identity via WhatsApp OTP only when you are ready to checkout.",
  },
  {
    icon: <Check className="h-6 w-6 sm:h-7 sm:w-7" />,
    title: "Good to Go",
    body: "Secure your slot with payment and receive instant booking confirmation.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeader title="Seamless Experience">
          <span className="text-balance">
            Pick your slot, verify once, and show up ready to play — every step made effortless.
          </span>
        </SectionHeader>
        
        <div className="relative mt-12 sm:mt-16">
          {/* Vertical Connecting Line (Mobile only, centered behind circles) */}
          <div 
            className="absolute left-1/2 top-[2rem] bottom-[2rem] w-[2px] -translate-x-1/2 border-l-2 border-dashed border-accent/25 sm:hidden -z-10" 
            aria-hidden="true"
          />

          {/* Horizontal Connecting Line (Tablet/Desktop only) */}
          <div 
            className="absolute top-[2.5rem] left-[16%] right-[16%] hidden h-[2px] border-t-2 border-dashed border-accent/25 sm:block -z-10" 
            aria-hidden="true"
          />
          
          <ol 
            className="flex flex-col gap-12 sm:grid sm:grid-cols-3 sm:gap-6 lg:gap-12"
            role="list"
            aria-label="Workflow booking steps progression"
          >
            {STEPS.map(({ icon, title, body }, index) => (
              <li key={title} className="w-full">
                <StepCard icon={icon} title={title} body={body} index={index} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function StepCard({ icon, title, body, index }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <div 
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-surface-panel text-accent shadow-[0_0_15px_rgba(202,255,0,0.06)] transition-all duration-300 hover:scale-105 hover:border-accent hover:shadow-[0_0_20px_rgba(202,255,0,0.12)] sm:h-20 sm:w-20"
          aria-hidden="true"
        >
          {icon}
        </div>
        <span className="absolute -top-1 -right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-black text-black shadow-sm sm:h-7 sm:w-7 sm:text-xs">
          0{index + 1}
        </span>
      </div>
      <h3 className="mt-6 text-lg font-black text-foreground sm:mt-8 sm:text-xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base max-w-sm">
        {body}
      </p>
    </div>
  );
}