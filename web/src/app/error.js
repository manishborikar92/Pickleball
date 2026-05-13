"use client";

import { Button } from "@/components/shared";

export default function Error({ reset }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-4xl font-black">Something went wrong</h1>
        <p className="mt-4 text-muted">The route hit an unexpected state. Try again or return to booking.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button type="button" onClick={reset}>Try Again</Button>
          <Button href="/venues/besa-nagpur/book" variant="secondary">Book Court</Button>
        </div>
      </div>
    </main>
  );
}
