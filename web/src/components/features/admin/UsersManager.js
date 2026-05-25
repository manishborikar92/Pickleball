"use client";

import { useMemo, useState } from "react";
import { Card, FormField, Input } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";
import { formatCurrency } from "@/lib/booking-engine";

// Mock API data
const MOCK_RESULTS = [
  { id: "usr-1", name: "Asha Mehta", phone: "+919876543210", bookings: 8, wallet: 500 },
];

export function UsersManager() {
  const [query, setQuery] = useState("");

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
          <FormField label="Search by phone number">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="+91 98765 43210"
              inputMode="tel"
              className="py-2.5"
            />
          </FormField>
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