import { InfoPageLayout } from "@/components/layout";
import Image from "next/image";
import { Award, Compass, Heart } from "lucide-react";
import { JsonLd } from "@/components/seo";

export const metadata = {
  title: "About Us",
  description:
    "Discover the story of Baseline Arena, Nagpur's premier indoor pickleball facility offering top-tier cushion courts and professional play conditions.",
  alternates: {
    canonical: "/about",
  },
};

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://baselinearena.in/#organization",
  "name": "Baseline Arena",
  "url": "https://baselinearena.in",
  "logo": "https://baselinearena.in/baseline-full-logo.svg",
  "sameAs": ["https://instagram.com/baseline.arena"],
};

const VALUE_CARDS = [
  {
    Icon: Award,
    title: "Premium Standards",
    desc: "From tournament-grade Pro Cushion surfaces to professional glare-free LED lighting, we never cut corners on quality.",
  },
  {
    Icon: Compass,
    title: "Innovation First",
    desc: "Frictionless online bookings, secure checkouts, and seamless WhatsApp confirmations built to elevate the sport experience.",
  },
  {
    Icon: Heart,
    title: "Community Heart",
    desc: "A warm, inclusive space for players of all ages and skills (from DUPR 4.5+ competitors to weekend recreational enthusiasts).",
  },
];

export default function AboutPage() {
  return (
    <>
      <JsonLd data={orgSchema} />
      <InfoPageLayout
        eyebrow="Our Story"
        title="Nagpur's Premier Indoor Pickleball Hub"
        description="Baseline Arena is elevating the pickleball experience through cutting-edge technology and world-class sports facilities."
      >
      <div className="space-y-8">
        {/* Intro Section */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-foreground sm:text-2xl">
            Welcome to Baseline Arena
          </h2>
          <p className="text-sm leading-relaxed sm:text-base">
            Founded in Besa, Nagpur, Baseline Arena was born out of a simple passion: to build a dedicated, weatherproof, and high-performance environment for the fastest-growing sport in the world. We noticed that local enthusiasts were often restricted by unstable weather conditions, poor outdoor lighting, and tedious booking procedures.
          </p>
          <p className="text-sm leading-relaxed sm:text-base">
            We solved this by establishing a premium indoor sports arena where players can enjoy perfect court conditions 365 days a year. By combining high-grade sports infrastructure with a frictionless, automated mobile checkout system, we have made booking a game as simple as tapping a screen.
          </p>
        </section>

        {/* Court Tech & Feature Highlight */}
        <section className="rounded-xl border border-line bg-surface/50 p-5 sm:p-6">
          <h3 className="text-lg font-black text-foreground sm:text-xl">
            Facility Specifications
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-muted">
            Our Besa facility hosts two meticulously engineered courts built to standard sizes:
          </p>
          <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Playing Surface
              </span>
              <p className="text-sm font-bold text-foreground">Pro Cushion Multi-Layer Court</p>
              <p className="text-xs text-muted">Reduces joint impact and provides optimal grip and ball bounce consistency.</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Indoor Climate &amp; Lights
              </span>
              <p className="text-sm font-bold text-foreground">Anti-Glare Sports LED Lighting</p>
              <p className="text-xs text-muted">High-lux overhead fixture layout prevents blind spots and shadows during fast rallies.</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Court Dimensions
              </span>
              <p className="text-sm font-bold text-foreground">Standard 20 x 44 feet</p>
              <p className="text-xs text-muted">Generous out-of-bounds space with premium perimeter padding for safety.</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-accent uppercase tracking-wider">
                Player Amenities
              </span>
              <p className="text-sm font-bold text-foreground">Seating, Hydration &amp; Equipment</p>
              <p className="text-xs text-muted">Free paddles and balls available on-site, courtside rest areas, and clean changing rooms.</p>
            </div>
          </div>
        </section>

        {/* Our Values
            FIX (CRITICAL): Original was `grid-cols-1 md:grid-cols-3` — no intermediate
            breakpoint. On 640px–767px (landscape phones, small tablets) it stayed 1-col,
            wasting significant space before the abrupt jump to 3 columns at md.

            New grid: grid-cols-1 sm:grid-cols-2 lg:grid-cols-3
              - <640px:  1 column  (compact mobile portrait)
              - 640–767px: 2 columns (landscape phone / small tablet)
              - 768–1023px: still 2 columns inside the ~480px md article — correct width
              - 1024px+: 3 columns in the ~720px lg article — each card ~240px ✓

            The lg:grid-cols-3 (not md:grid-cols-3) ensures we only go 3-col when the
            article is wide enough (~720px) to give cards meaningful space.
        */}
        <section className="space-y-4">
          <h2 className="text-xl font-black text-foreground sm:text-2xl">
            What Drives Us
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {VALUE_CARDS.map(({ Icon, title, desc }) => (
              <div
                key={title}
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface-panel/30 p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-foreground text-sm sm:text-base">{title}</h4>
                  <p className="mt-1.5 text-xs text-muted leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Future Vision */}
        <section className="space-y-4 pt-4 border-t border-line/35">
          <h2 className="text-lg font-black text-foreground sm:text-xl">
            Looking Ahead
          </h2>
          <p className="text-xs sm:text-sm leading-relaxed">
            While our initial launch focuses on our premier Besa venue in Nagpur, our architecture and company structure are venue-aware from day one. As the pickleball community expands, we plan to bring our signature premium indoor court standard to other locations, keeping the same standard of visual luxury, athletic quality, and seamless booking technology.
          </p>
        </section>
      </div>
    </InfoPageLayout>
    </>
  );
}