import { Badge, Button } from "@/components/shared";

export function HeroSection() {
  return (
    <section className="court-hero flex min-h-[calc(100svh-4rem)] items-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="max-w-2xl">
          <Badge tone="neutral" className="mb-5 inline-flex items-center gap-2.5 shadow-sm sm:mb-6">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <span className="font-semibold tracking-wide">LIVE NOW</span>
          </Badge>

          <h1 className="text-balance text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            The Future of{" "}
            <span className="text-accent drop-shadow-sm">Pickleball</span>
          </h1>

          <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted sm:mt-6 sm:text-lg sm:leading-8">
            Experience courts tuned for competitive play. Browse live slots,
            verify only when ready, and book Besa, Nagpur in minutes.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:items-center">
            <Button 
              href="/venues/besa-nagpur/book" 
              className="flex min-h-[3rem] w-full items-center justify-center sm:w-auto sm:px-8"
            >
              Book Court
            </Button>
            <Button
              href="/dashboard"
              variant="secondary"
              className="flex min-h-[3rem] w-full items-center justify-center sm:w-auto sm:px-8"
            >
              My Bookings
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}