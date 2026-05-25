"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { Header, Footer } from "@/components/layout";
import { Info, HelpCircle, FileText, Shield } from "lucide-react";

const NAV_ITEMS = [
  { href: "/about", label: "About Us", Icon: Info },
  { href: "/support", label: "Help & Support", Icon: HelpCircle },
  { href: "/terms", label: "Terms & Conditions", Icon: FileText },
  { href: "/privacy", label: "Privacy Policy", Icon: Shield },
];

export function InfoPageLayout({ eyebrow, title, description, children }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative border-b border-line bg-surface/30 px-4 py-10 text-center sm:px-6 sm:py-16 lg:px-8 lg:py-20 xl:py-24">
          {/* Subtle glowing background pattern */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-accent/5 blur-[80px]" />
          </div>

          <div className="mx-auto max-w-3xl flex flex-col items-center">
            {/* Full logo for branding */}
            <div className="mb-5 opacity-90 transition-transform hover:scale-102">
              <Image
                src="/baseline-full-logo.svg"
                alt="Baseline Arena Full Logo"
                width={180}
                height={50}
                className="h-auto w-36 sm:w-44"
                priority
              />
            </div>

            {eyebrow && (
              <span className="text-xs font-bold uppercase tracking-widest text-accent">
                {eyebrow}
              </span>
            )}
            <h1 className="mt-2.5 text-balance text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl">
              {title}
            </h1>
            {description && (
              <p className="mx-auto mt-3 max-w-xl text-balance text-xs leading-relaxed text-muted sm:text-sm lg:text-base">
                {description}
              </p>
            )}
          </div>
        </section>

        {/* Content & Navigation */}
        <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-4">

            {/* Sidebar Navigation */}
            <aside className="md:col-span-1">
              <nav className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar md:flex-col md:gap-2 md:overflow-visible md:pb-0">
                {NAV_ITEMS.map(({ href, label, Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent
                        ${
                          isActive
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-line bg-surface-panel/40 text-muted hover:border-line/85 hover:bg-surface-panel hover:text-foreground"
                        } md:w-full md:shrink md:normal-case md:tracking-normal md:py-3 md:text-sm md:font-semibold`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-accent" : "text-muted"}`} />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content Area */}
            <article className="glass-panel md:col-span-2 lg:col-span-3 rounded-2xl p-5 sm:p-6 md:p-8 lg:p-10 leading-relaxed text-muted">
              {children}
            </article>

          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}