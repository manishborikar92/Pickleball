import Link from "next/link";
import Image from "next/image";
import "../globals.css";

export const metadata = {
  title: {
    default: "Baseline Arena | Login",
    template: "%s | Baseline Arena",
  },
  description: "Secure login portal for Baseline Arena",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground justify-between relative">
        {/* Subtle glowing background pattern */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 h-[35rem] w-[35rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/5 blur-[125px]" />
        </div>

        {/* Standalone Brand Logo Header */}
        <header className="flex justify-center pt-10 pb-4">
          <Link
            href="/"
            className="outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 rounded-md"
            aria-label="Go to homepage"
          >
            <Image
              src="/baseline-full-logo.svg"
              alt="Baseline Arena Full Logo"
              width={160}
              height={44}
              className="h-9 w-auto hover:opacity-95 transition-opacity"
              priority
            />
          </Link>
        </header>

        {/* Centered Form Area */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-md z-10">
            {children}
          </div>
        </main>

        {/* Minimal Auth Footer */}
        <footer className="py-6 text-center text-[10px] sm:text-xs text-muted/30 font-medium">
          <p>© {new Date().getFullYear()} Baseline Arena. All rights reserved.</p>
        </footer>
      </div>
  );
}
