import { Card, SectionHeader } from "@/components/shared";

const FACILITY_STANDARDS = [
  [
    "PS",
    "Pro Surface",
    "Tour-grade cushioning and grip for competitive play and injury prevention.",
  ],
  [
    "CC",
    "Climate Control",
    "Consistent indoor conditions across summer, monsoon, and late-night games.",
  ],
  [
    "GE",
    "Pro Shop",
    "Paddles, balls, hydration, and staff support available at the venue.",
  ],
];

export function FacilitySection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionHeader title="Elite Facility Standards">
          <span className="text-balance">
            Engineered for performance, designed for comfort, and ready for daily operations at scale.
          </span>
        </SectionHeader>

        <ul className="mt-10 grid gap-6 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {FACILITY_STANDARDS.map(([icon, title, body]) => (
            <li key={title}>
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
        className="mx-auto mb-5 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xl font-bold tracking-tight text-accent sm:mb-6 sm:h-16 sm:w-16 sm:text-2xl"
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