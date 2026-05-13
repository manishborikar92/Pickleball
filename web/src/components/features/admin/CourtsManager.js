"use client";

import { useState } from "react";
import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";

export function CourtsManager({ courts }) {
  const [items, setItems] = useState(courts);

  function toggleCourtStatus(courtId) {
    setItems((prev) =>
      prev.map((court) =>
        court.id === courtId
          ? {
              ...court,
              status: court.status === "active" ? "maintenance" : "active",
            }
          : court,
      ),
    );
  }

  const rows = items.map((court) => ({
    id: court.id,
    name: court.name,
    scope: court.surfaceType,
    value: court.environment,
    status: court.status,
    action: () => toggleCourtStatus(court.id),
    actionLabel: court.status === "active" ? "Set Maintenance" : "Set Active"
  }));

  return (
    <ManagerSurface
      title="Courts"
      description="Court metadata and status changes remain isolated to the venue domain."
    >
      <SimpleRows rows={rows} />
    </ManagerSurface>
  );
}