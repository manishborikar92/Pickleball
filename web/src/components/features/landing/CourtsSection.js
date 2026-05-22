import { Badge, Card, SectionHeader } from "@/components/shared";
import { venue } from "@/data/platform";

const COURT_TAGS = ["Outdoor", "Singles/Doubles", "Precision Lighting"];

export function CourtsSection() {
  return (
    <section className="border-t border-line px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
        <div className="flex flex-col justify-center">
          <SectionHeader align="left" title="Dual Premium Courts">
            Two Elite Courts featuring pro-grade lighting, protective flooring 
            and a secure booking system that guarantees your slot.
          </SectionHeader>
          <ul 
            className="mt-6 flex flex-wrap gap-2 sm:mt-8"
            aria-label="Court Features"
          >
            {COURT_TAGS.map((item) => (
              <li key={item}>
                <Badge>{item}</Badge>
              </li>
            ))}
          </ul>
        </div>

<Card className="flex flex-col overflow-hidden shadow-sm transition-shadow hover:shadow-md">
  <div className="h-72 w-full overflow-hidden sm:h-80 md:h-96 lg:h-80">
    <img
      src="/court-4.png"
      alt="Court preview"
      className="h-full w-full object-center"
    />
  </div>
  <div className="flex flex-col p-5 sm:p-6 lg:p-8">
    <div className="self-start">
      <Badge tone="accent">Outdoor Premium</Badge>
    </div>
    <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">
      Venue-scoped data, court status, schedules, pricing rules, and
      reviews all map back to <strong className="font-medium text-foreground">{venue.name}</strong> for multi-location growth.
    </p>
  </div>
</Card>
      </div>
    </section>
  );
}