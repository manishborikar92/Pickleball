"use client";

import { useMemo, useState, useId } from "react";
import { Card } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";
import { formatCurrency } from "@/lib/booking-engine";

// Mock API data
const MOCK_RESULTS = [
  { id: "usr-1", name: "Asha Mehta", phone: "+919876543210", bookings: 8, wallet: 500 },
];

export function UsersManager() {
  const [query, setQuery] = useState("");
  const searchId = useId();

  const results = useMemo(
    () => (query.trim() ? MOCK_RESULTS : []),
    [query],
  );

  const rows = results.map((user) => ({
    id: user.id,
    name: user.name,
    scope: user.phone,
    value: `${user.bookings} bookings`,
    status: formatCurrency(user.wallet),
  }));

  return (
    <ManagerSurface
      title="Users"
      description="Search by phone and inspect booking history, wallet, and credit activity."
    >
      <div className="space-y-4">
        <Card className="p-5 sm:p-6">
          <label htmlFor={searchId} className="block text-sm font-bold text-muted mb-2">
            Search by phone number
          </label>
          <div className="relative">
            <input
              id={searchId}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="+91 98765 43210"
              inputMode="tel"
              className="w-full rounded-lg border border-line bg-background px-4 py-3 text-base text-foreground transition-colors placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent md:text-sm"
            />
          </div>
        </Card>
        
        {rows.length > 0 ? (
          <SimpleRows rows={rows} />
        ) : query.trim() ? (
          <p className="px-2 text-sm font-medium text-muted text-center sm:text-left py-4">
            No users found for that number.
          </p>
        ) : null}
      </div>
    </ManagerSurface>
  );
}