import { ManagerSurface } from "./ManagerSurface";
import { SimpleRows } from "./SimpleRows";

export function CourtsManager({ courts }) {
  const rows = courts.map((court) => ({
    id: court.id,
    name: court.name,
    scope: court.surfaceType,
    value: court.environment,
    status: court.status,
  }));

  return (
    <ManagerSurface
      title="Courts"
      description="Court metadata and status changes remain isolated to the venue domain."
    >
      <SimpleRows rows={rows} className="md:flex-1 md:min-h-0" />
    </ManagerSurface>
  );
}
