"use client";

import { useMemo, useState } from "react";
import { Card, EmptyState, FormField, Input } from "@/components/shared";
import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";

export function UsersManager() {
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => [],
    [],
  );

  const rows = results.map((user) => ({
    id: user.id,
    name: user.name,
    scope: user.phone,
    value: `${user.bookings ?? 0} bookings`,
    status: user.status ?? "active",
  }));

  return (
    <ManagerSurface
      title="Users"
      description="Search by phone and inspect booking history, wallet, and credit activity."
    >
      <div className="space-y-4 md:space-y-0 md:h-full md:min-h-0 md:overflow-hidden flex flex-col md:gap-4">
        <Card className="p-5 sm:p-6 shrink-0">
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
          <SimpleRows rows={rows} className="md:flex-1 md:min-h-0" />
        ) : query.trim() ? (
          <Card className="p-5 sm:p-6 shrink-0">
            <EmptyState
              title="No users found"
              description="No matching user records are available from the current backend APIs."
            />
          </Card>
        ) : null}
      </div>
    </ManagerSurface>
  );
}
