"use client";

import { useEffect } from "react";
import { Button, Card } from "@/components/shared";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function MarketingError({ error, reset }) {
  useEffect(() => {
    console.error("Marketing page error:", error);
  }, [error]);

  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <Card className="w-full max-w-lg p-8 text-center border-t-4 border-t-danger shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h1 className="mb-2 text-2xl font-black">Page Unavailable</h1>
        <p className="mb-6 text-sm text-muted">
          This page could not be loaded. Please try again.
        </p>
        <Button onClick={() => reset()} variant="primary" className="justify-center">
          <RefreshCw className="h-4 w-4 shrink-0" />
          <span>Try Again</span>
        </Button>
      </Card>
    </div>
  );
}
