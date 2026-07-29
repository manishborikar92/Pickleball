import Image from "next/image";
import { Badge } from "@/components/shared";
import { MapPin, Star } from "lucide-react";

export function VenueHero({ venue }) {
  return (
    <section className="relative aspect-[16/9] max-h-48 w-full overflow-hidden rounded-2xl shadow-md">
      {/* LCP image — optimized with next/image for fast loading and zero layout shift */}
      <Image
        src="/court-2.png"
        alt=""
        fill
        priority
        sizes="(max-width: 1024px) 100vw, (max-width: 1280px) 60vw, 760px"
        className="object-cover object-center"
      />

      {/* Soft, minimal gradient overlay for readability without dark heavy areas */}
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
        aria-hidden="true"
      />

      {/* Content anchored to lower-left with generous padding */}
      <div className="relative flex h-full flex-col items-start justify-end p-4 sm:p-5 md:p-6">
        <Badge className="inline-flex w-fit items-center gap-1.5 shadow-sm">
          <Star className="h-3 w-3 fill-current" />
          <span>Premium Court</span>
        </Badge>

        <h2 className="mt-1.5 text-xl font-black leading-tight text-foreground drop-shadow-sm sm:mt-2 sm:text-2xl md:text-3xl">
          {venue.brandName}
        </h2>

        <p className="mt-1 flex items-start gap-2 text-xs font-medium text-muted sm:mt-1.5 sm:text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span>{venue.address}</span>
        </p>
      </div>
    </section>
  );
}