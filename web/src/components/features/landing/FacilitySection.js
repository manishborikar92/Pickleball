import { Spotlight, ShieldCheck, Handbag } from "lucide-react";
import { Card, SectionHeader } from "@/components/shared";

const FACILITY_STANDARDS = [
  {
    icon: <ShieldCheck className="h-7 w-7 sm:h-8 sm:w-8" />,
    title: "Play Safe",
    body: "Cushioned, smooth courts for competitive play that keep every game comfortable.",
  },
  {
    icon: <Spotlight className="h-7 w-7 sm:h-8 sm:w-8" />,
    title: "Lights & Visibility",
    body: "Pro-grade LED court lighting, 500+ lux, zero glare, ideal for fast-paced night games.",
  },
  {
    icon: <Handbag className="h-7 w-7 sm:h-8 sm:w-8" />,
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
        <ul className="hide-scrollbar slider-nav-animation mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 sm:mt-12 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:pb-0 lg:grid-cols-3 lg:gap-8">
          {FACILITY_STANDARDS.map(({ icon, title, body }) => (
            <li key={title} className="slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:w-auto sm:shrink">
              <FacilityCard icon={icon} title={title} body={body} />
            </li>
          ))}
          {/* Duplicates for extended mobile scrolling */}
          {FACILITY_STANDARDS.map(({ icon, title, body }, index) => (
            <li key={`dup1-${index}`} aria-hidden="true" className="slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:hidden">
              <FacilityCard icon={icon} title={title} body={body} />
            </li>
          ))}
          {FACILITY_STANDARDS.map(({ icon, title, body }, index) => (
            <li key={`dup2-${index}`} aria-hidden="true" className="slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:hidden">
              <FacilityCard icon={icon} title={title} body={body} />
            </li>
          ))}
          {FACILITY_STANDARDS.map(({ icon, title, body }, index) => (
            <li key={`dup3-${index}`} aria-hidden="true" className="slider-nav-animation-fadein w-[80vw] shrink-0 snap-center sm:hidden">
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
    <Card className="flex h-full flex-col p-6 text-center transition-transform hover:-translate-y-1 sm:p-8">
      <div
        className="mx-auto mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent sm:mb-6 sm:h-16 sm:w-16"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="text-lg font-black text-balance sm:text-xl">{title}</h3>
      <p className="mt-3 grow text-sm leading-relaxed text-muted sm:text-base">
        {body}
      </p>
    </Card>
  );
}
