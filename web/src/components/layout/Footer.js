import Link from "next/link";
import Image from "next/image";
import { venue } from "@/data/platform";
import { MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid - Proportionate Scaling Applied */}
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          
          {/* Column 1: Brand & Socials (Takes 2 cols on Tablet & Desktop) */}
          <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-2 lg:pr-8">
            <Link 
              href="/" 
              className="group inline-block w-fit rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
              aria-label={`Go to ${venue.brandName} homepage`}
            >
              <div className="transition-transform duration-200 group-hover:scale-[1.02]">
                <Image 
                  src="/baseline-full-logo.svg" 
                  alt={`${venue.brandName} Full Logo`} 
                  width={160} 
                  height={45} 
                  className="h-auto w-40 sm:w-44" 
                />
              </div>
            </Link>
            <p className="max-w-md text-xs leading-relaxed text-muted sm:text-sm">
              Nagpur&apos;s premier outdoor pickleball destination. Experience professional-grade Pro Cushion courts, expert LED lighting, and effortless digital booking.
            </p>
            {/* Instagram Social Handle */}
            <div className="mt-2 flex flex-col gap-2">
              <a
                href="https://instagram.com/baseline.arena"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-fit items-center gap-2 rounded px-1 py-0.5 text-xs font-semibold text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                aria-label="Follow us on Instagram"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-panel text-muted transition-colors group-hover:bg-accent/15 group-hover:text-accent">
                  <InstagramIcon className="h-4 w-4" />
                </div>
                <span>@baseline.arena</span>
              </a>
            </div>
          </div>

          {/* Column 2: Book & Explore */}
          <div className="flex flex-col gap-4 sm:col-span-1 lg:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
              Book &amp; Explore
            </h3>
            <ul className="flex flex-col gap-2 text-xs sm:text-sm">
              <li>
                <Link href="/interest" className="font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4">
                  Join the Waitlist
                </Link>
              </li>
              <li>
                <Link href="/venues/besa-nagpur/book" className="font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4">
                  Book Court Slots
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Help & Support */}
          <div className="flex flex-col gap-4 sm:col-span-1 lg:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
              Support &amp; Hub
            </h3>
            <ul className="flex flex-col gap-2 text-xs sm:text-sm">
              <li>
                <Link href="/about" className="font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4">
                  About Our Arena
                </Link>
              </li>
              <li>
                <Link href="/support" className="font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4">
                  Help &amp; FAQs
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Policies */}
          <div className="flex flex-col gap-4 sm:col-span-1 lg:col-span-1">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground">
              Legal &amp; Safety
            </h3>
            <ul className="flex flex-col gap-2 text-xs sm:text-sm">
              <li>
                <Link href="/terms" className="font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4">
                  Terms &amp; Conditions
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="font-medium text-muted outline-none transition-colors hover:text-accent focus-visible:text-accent focus-visible:underline focus-visible:underline-offset-4">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar - Fluid alignments without strict magic numbers */}
        <div className="mt-12 flex flex-col items-center border-t border-line/40 pt-4 text-center md:flex-row md:items-start md:text-left">
          <p className="shrink-0 text-xs font-semibold text-muted/65">
            &copy; {new Date().getFullYear()} {venue.brandName}. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}

function Clock({ className }) {
  return (
    <svg 
      className={className} 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function InstagramIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}