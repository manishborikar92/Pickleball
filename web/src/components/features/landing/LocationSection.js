import { Card, SectionHeader } from "@/components/shared";
import { venue } from "@/data/platform";
import { Map } from "@/components/shared/Map";

export function LocationSection() {
  return (
    <section className="border-t border-line bg-surface px-4 py-16 sm:px-6 md:py-24 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2 md:gap-12 lg:items-center lg:gap-16">
        <div className="lg:order-last">
          <Map 
            lat={venue.location.lat}
            lng={venue.location.lng}
            name={venue.name}
            address={venue.address}
          />
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