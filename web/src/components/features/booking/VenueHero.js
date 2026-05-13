import { Badge } from "@/components/shared";
import { MapPin, Star } from "lucide-react";

export function VenueHero({ venue }) {
  return (
    <section className="grid gap-4 sm:gap-5 md:grid-cols-[260px_1fr] md:items-center">
      <div className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-line bg-[url('/court-2.png')] bg-cover bg-top shadow-sm md:aspect-auto md:h-48" />
      <div className="flex flex-col items-start">
        <Badge className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          Premium Court
        </Badge>
        <h2 className="mt-3 text-2xl font-black leading-tight text-foreground sm:mt-4 sm:text-4xl">
          {venue.brandName}
        </h2>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-muted sm:mt-3 sm:text-base">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{venue.address}</span>
        </p>
      </div>
    </section>
  );
}