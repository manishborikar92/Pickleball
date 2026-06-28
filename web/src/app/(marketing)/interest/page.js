import { InterestForm } from "@/components/features/interest";
import { Badge } from "@/components/shared";
import { CircleDashed, Smartphone, Trophy } from "lucide-react";
import { getPageMetadata } from "@/config/metadata";

export const metadata = getPageMetadata({
  title: "Coming Soon — Join the Wait List",
  description:
    "Baseline Arena is launching soon in Besa, Nagpur. Register your interest to be the first notified when courts open for booking.",
  path: "/interest",
});

const PERKS = [
  {
    Icon: CircleDashed,
    title: "Early Access",
    body: "Be first in line when bookings open — before the public.",
  },
  {
    Icon: Smartphone,
    title: "WhatsApp Alert",
    body: "Get a direct notification on your phone the moment we go live.",
  },
  {
    Icon: Trophy,
    title: "Founding Player",
    body: "Special recognition and offers reserved for early registrants.",
  },
];

export default function InterestPage() {
  return (
    <>
      {/* Hero */}
      <section className="court-hero flex flex-col items-center justify-center px-4 py-16 text-center sm:px-6 sm:py-28 lg:px-8">
        <Badge
          tone="neutral"
          className="mb-6 inline-flex items-center gap-2.5 shadow-sm"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <span className="font-semibold tracking-wide">COMING SOON</span>
        </Badge>

        <h1 className="text-balance text-[2.5rem] font-black leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          Courts Opening{" "}
          <span className="text-accent drop-shadow-sm block sm:inline mt-1 sm:mt-0">Soon</span>
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-balance text-sm leading-relaxed text-muted sm:mt-6 sm:text-lg sm:leading-8">
          Baseline Arena is putting the finishing touches on Nagpur&apos;s
          premier outdoor pickleball facility. Leave your details and we&apos;ll
          reach out the moment bookings open.
        </p>
      </section>

      {/* Form + Perks */}
      <section className="flex-1 border-t border-line bg-background px-4 py-10 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:gap-16 lg:items-start">
          {/* Left — Form card */}
          <div className="glass-panel rounded-2xl p-5 sm:p-8">
            <h2 className="text-2xl font-black text-foreground sm:text-3xl">
              Notify Me When Live
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
              Enter your name and number — we&apos;ll reach out via WhatsApp
              as soon as courts open.
            </p>
            <div className="mt-7">
              <InterestForm />
            </div>
          </div>

          {/* Right — Perks */}
          <div className="flex flex-col justify-center gap-6 lg:gap-8">
            <div>
              <h2 className="text-xl font-black text-foreground sm:text-2xl">
                Why Register Early?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                We&apos;re building something special — and founding players
                get treated like it.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-1 sm:gap-5">
              {PERKS.map(({ Icon, title, body }) => (
                <li
                  key={title}
                  className="flex items-start gap-3.5 sm:gap-4 rounded-xl border border-line bg-surface-panel p-4 sm:p-5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-black text-foreground">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
