import Link from "next/link";
import Image from "next/image";
import { venue } from "@/data/platform";

export function Footer() {
  return (
    <footer className="border-t border-line bg-surface py-10 sm:py-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:flex-row sm:text-left sm:px-6 lg:px-8">
        
        <div className="flex flex-col items-center sm:items-start">
          <Link 
            href="/" 
            className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-surface"
            aria-label={`Go to ${venue.brandName} homepage`}
          >
            <div className="flex shrink-0 items-center justify-center transition-transform group-hover:scale-105">
              <Image src="/baseline-logo.svg" alt={`${venue.brandName} Logo`} width={64} height={64} className="h-12 w-12 sm:h-14 sm:w-14" />
            </div>
            <span className="text-xl font-black text-foreground transition-colors group-hover:text-accent sm:text-2xl">
              {venue.brandName}
            </span>
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