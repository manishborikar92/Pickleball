import Image from "next/image";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex flex-col items-center">
        {/* Full typography brand logo */}
        <Image
          src="/baseline-full-logo.svg"
          alt="Baseline Arena"
          width={180}
          height={50}
          className="h-auto w-40 sm:w-48 opacity-95"
          priority
        />

        {/* Cohesive, Centered Progress Bar Accent */}
        <div className="relative mt-6 h-[2px] w-24 overflow-hidden rounded bg-line/60">
          <div className="absolute top-0 left-0 h-full w-8 bg-accent animate-loader-slide" />
        </div>
      </div>
    </main>
  );
}
