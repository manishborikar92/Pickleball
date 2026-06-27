import { Badge, Card, SectionHeader } from "@/components/shared";
import { VENUE } from "@/config/venue.config";
import Image from "next/image";

const COURT_TAGS = ["Outdoor", "Singles/Doubles", "Precision Lighting", "Sports Canteen", "Refreshments"];

export function CourtsSection() {
  return (
    <section className="border-t border-line px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <div className="flex flex-col justify-center">
            <SectionHeader align="left" title="Premium Courts & Amenities">
              Two Elite Courts featuring pro-grade lighting, protective flooring, 
              and a dedicated refreshment corner to recharge between games.
            </SectionHeader>
            <ul 
              className="mt-6 flex flex-wrap gap-2 sm:mt-8"
              aria-label="Court and Facility Features"
            >
              {COURT_TAGS.map((item) => (
                <li key={item}>
                  <Badge>{item}</Badge>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:gap-8">
            <Card className="flex flex-col overflow-hidden shadow-sm transition-shadow hover:shadow-md">
              <div className="relative h-48 w-full overflow-hidden sm:h-56">
                <Image
                  src="/court-4.png"
                  alt="Court preview"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
                  className="object-cover object-center"
                  priority={false}
                />
              </div>
              <div className="flex-1 flex flex-col p-5">
                <div className="self-start">
                  <Badge tone="accent">Outdoor Premium</Badge>
                </div>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-muted">
                  Fully-equipped professional pickleball courts mapping back to <strong className="font-medium text-foreground">{VENUE.name}</strong>.
                </p>
              </div>
            </Card>

            <Card className="flex flex-col overflow-hidden shadow-sm transition-shadow hover:shadow-md">
              <div className="relative h-48 w-full overflow-hidden sm:h-56">
                <Image
                  src="/canteen-beverages.png"
                  alt="Canteen and refreshments"
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 300px"
                  className="object-cover object-center"
                  priority={false}
                />
              </div>
              <div className="flex-1 flex flex-col p-5">
                <div className="self-start">
                  <Badge tone="accent">Beverage Bar</Badge>
                </div>
                <p className="mt-4 text-xs sm:text-sm leading-relaxed text-muted">
                  Grab chilled sports drinks, water, and fresh refreshments at our courtside canteen to keep your energy high.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
}