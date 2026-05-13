import Link from "next/link";
import { venue } from "@/data/platform";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface py-10 sm:py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
        
        <div className="flex flex-col items-center sm:items-start">
          <Link 
            href="/" 
            className="rounded-md text-xl font-black text-accent outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface sm:text-2xl"
            aria-label={`Go to ${venue.brandName} homepage`}
          >
            {venue.brandName}
          </Link>
          <p className="mt-3 max-w-xs text-balance text-sm leading-relaxed text-muted sm:max-w-sm sm:mt-2">
            Elevating the pickleball experience through technology and premium facilities.
          </p>
        </div>

        <div className="flex items-center pt-2 sm:pt-0">
          <p className="text-sm font-medium text-muted/70">
            &copy; {new Date().getFullYear()} {venue.brandName}. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
}