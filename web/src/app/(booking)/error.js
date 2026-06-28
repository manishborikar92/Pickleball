"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/shared";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { VENUE } from "@/config/venue.config";

export default function BookingError({ error, reset }) {
  useEffect(() => {
    console.error("Booking error:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-danger shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-black">Booking Error</h1>
        <p className="mb-6 text-sm text-muted">
          Something went wrong with the booking process. Please try again or return to court selection.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} variant="primary" className="justify-center">
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>Try Again</span>
          </Button>
          <Button href={`/venues/${VENUE.slug}/book`} variant="secondary">
            <span>Back to Courts</span>
          </Button>
        </div>
      </Card>
    </main>
  );
}
