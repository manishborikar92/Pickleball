import { Card, SectionHeader } from "@/components/shared";
import { venue } from "@/data/platform";
import { Map } from "@/components/shared/Map";

export function LocationSection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:gap-12 lg:items-center lg:gap-16">
        <div className="lg:order-last w-full">
          {/* 
            Premium Responsive Map Architecture
            - Uses 'aspect-video' (16/9) globally to maintain a cinematic, premium look.
            - Implements a 'max-height' constraint using CSS clamp to prevent vertical overflow on small/landscape mobile.
            - The map will be 16:9 as long as it doesn't exceed 60% of the viewport height.
          */}
          <div 
            className="relative w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-surface-variant border border-line/10"
            style={{ 
              maxHeight: 'clamp(300px, 60vh, 600px)' 
            }}
          >
            <Map 
              lat={venue.location.lat}
              lng={venue.location.lng}
              name={venue.name}
              address={venue.address}
            />
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <SectionHeader align="left" title="Find Us">
            {venue.address}
          </SectionHeader>
          
          <address className="mt-8 not-italic sm:mt-10">
            <dl className="grid gap-6 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2 text-muted">
              <LocationDetail label="Hours" value={venue.hours} />
              <LocationDetail
                label="Contact"
                value={
                  <span className="flex flex-col gap-1">
                    <a href={`mailto:${venue.email}`} className="hover:text-accent focus-visible:outline-accent">
                      {venue.email}
                    </a>
                    <a href={`tel:${venue.phone.replace(/\D/g, '')}`} className="hover:text-accent focus-visible:outline-accent">
                      {venue.phone}
                    </a>
                    {venue.secondaryPhone && (
                      <a href={`tel:${venue.secondaryPhone.replace(/\D/g, '')}`} className="hover:text-accent focus-visible:outline-accent">
                        {venue.secondaryPhone}
                      </a>
                    )}
                  </span>
                }
              />
            </dl>
          </address>
        </div>
      </div>
    </section>
  );
}

function LocationDetail({ label, value }) {
  return (
    <div className="flex flex-col">
      <dt className="text-sm font-bold uppercase tracking-wider text-foreground/80">{label}</dt>
      <dd className="mt-2 text-base leading-relaxed text-foreground">{value}</dd>
    </div>
  );
}