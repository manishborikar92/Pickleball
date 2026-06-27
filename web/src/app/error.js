"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/shared";
import { ShieldAlert, RefreshCw } from "lucide-react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("Unhandled runtime boundary error:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-danger shadow-xl">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-danger/10 text-danger">
          <ShieldAlert className="h-10 w-10" />
        </div>

        <h1 className="mb-2 text-2xl font-black">Something Went Wrong</h1>
        <p className="mb-6 text-sm text-muted">
          An unexpected error occurred while loading this page. Please try refreshing or return to the booking dashboard.
        </p>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} variant="primary" className="justify-center">
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span>Try Again</span>
          </Button>
          <Button href="/venues/besa-nagpur/book" variant="secondary">
            <span>Book Court</span>
          </Button>
        </div>
      </Card>
    </main>
  );
}
