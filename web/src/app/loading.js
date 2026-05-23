import Image from "next/image";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="flex flex-col items-center">
        {/* Animated branding container */}
        <div className="relative flex h-24 w-24 items-center justify-center">
          {/* Outer glowing pulse ring */}
          <div className="absolute inset-0 animate-ping rounded-full bg-accent/5 duration-[2000ms]" />
          
          {/* Dual spinning active loader rings */}
          <div className="absolute -inset-2 animate-spin rounded-full border border-transparent border-t-accent/40 border-b-accent/40 duration-[1500ms]" />
          <div className="absolute -inset-3.5 animate-spin rounded-full border border-transparent border-l-accent/20 border-r-accent/20 duration-[2500ms] reverse" />

          {/* Logo center element */}
          <Image
            src="/baseline-logo.svg"
            alt="Baseline Arena Logo"
            width={80}
            height={80}
            className="relative z-10 h-14 w-14 animate-pulse opacity-95"
            priority
          />
        </div>

        {/* Brand progress text */}
        <h3 className="mt-8 text-[11px] font-bold uppercase tracking-[0.3em] text-accent/80 animate-pulse">
          Loading Baseline Arena
        </h3>
        <p className="mt-1.5 text-[9px] font-medium uppercase tracking-[0.2em] text-muted/50">
          Nagpur's Premium Indoor Courts
        </p>
      </div>
    </main>
  );
}
