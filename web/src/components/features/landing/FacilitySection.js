import { Spotlight, ShieldCheck, Handbag } from "lucide-react";
import { Card, SectionHeader } from "@/components/shared";

const FACILITY_STANDARDS = [
  {
    icon: <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7" />,
    title: "Play Safe",
    body: "Cushioned, smooth courts for competitive play that keep every game comfortable.",
  },
  {
    icon: <Spotlight className="h-6 w-6 sm:h-7 sm:w-7" />,
    title: "Lights & Visibility",
    body: "Pro-grade LED court lighting, 500+ lux, zero glare, ideal for fast-paced night games.",
  },
  {
    icon: <Handbag className="h-6 w-6 sm:h-7 sm:w-7" />,
    title: "Grab & Go",
    body: "Paddles, balls, and refreshments available on-site, with staff support ready.",
  },
];

export function FacilitySection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader title="Elite Facility Standards">
          <span className="text-balance">
            Every corner is intentionally crafted for your comfort, performance, and the perfect game.
          </span>
        </SectionHeader>
        
        <ul 
          className="hide-scrollbar mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex sm:flex-wrap sm:justify-center sm:gap-6 lg:grid lg:grid-cols-3 lg:gap-8 sm:overflow-visible sm:pb-0"
          role="list"
          aria-label="Elite Facility Standards"
        >
          {FACILITY_STANDARDS.map(({ icon, title, body }) => (
            <li 
              key={title} 
              className="w-[82vw] max-w-[310px] shrink-0 snap-center sm:w-[calc(50%-12px)] sm:shrink-0 lg:w-auto"
            >
              <FacilityCard icon={icon} title={title} body={body} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FacilityCard({ icon, title, body }) {
  return (
    <Card className="flex h-full flex-col bg-surface-soft/40 backdrop-blur-sm border-line/60 p-6 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-[0_12px_30px_rgba(202,255,0,0.04)] focus-within:ring-2 focus-within:ring-accent sm:p-8">
      <div
        className="mx-auto mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-accent/25 bg-accent/5 text-accent shadow-[0_0_15px_rgba(202,255,0,0.05)] sm:mb-6 sm:h-16 sm:w-16"
        aria-hidden="true"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 sm:h-12 sm:w-12">
          {icon}
        </div>
      </div>
      <h3 className="text-lg font-black text-balance text-foreground sm:text-xl">{title}</h3>
      <p className="mt-3 grow text-sm leading-relaxed text-muted sm:text-base">
        {body}
      </p>
    </Card>
  );
}
