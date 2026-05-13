import { Badge, Card, SectionHeader } from "@/components/shared";
import { venue } from "@/data/platform";

const COURT_TAGS = ["Indoor", "Singles/Doubles", "Climate Controlled", "No-Refund Waiver"];

export function CourtsSection() {
  return (
    <section className="border-t border-line px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
        <div className="flex flex-col justify-center">
          <SectionHeader align="left" title="Twin Premium Courts">
            Two identical indoor courts with high-visibility lighting,
            shock-absorption flooring, accessible play, and a booking model
            designed to prevent double holds.
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
          <div 
            className="h-56 w-full bg-[linear-gradient(135deg,#1d2411,#090b03_46%,#caff00_47%,#caff00_49%,#151910_50%)] sm:h-72 md:h-80 lg:h-72" 
            aria-hidden="true"
          />
          <div className="flex flex-col p-5 sm:p-6 lg:p-8">
            <div className="self-start">
              <Badge tone="accent">Indoor Premium</Badge>
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