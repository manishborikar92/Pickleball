import Image from "next/image";
import { InfoPageSidebar } from "./InfoPageSidebar";

export function InfoPageLayout({ eyebrow, title, description, children }) {
  return (
    <>
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
            <InfoPageSidebar />
          </aside>

          {/* Main Content Area */}
          <article className="glass-panel md:col-span-2 lg:col-span-3 rounded-2xl p-5 sm:p-6 md:p-8 lg:p-10 leading-relaxed text-muted">
            {children}
          </article>

        </div>
      </section>
    </>
  );
}
