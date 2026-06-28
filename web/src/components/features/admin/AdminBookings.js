import { AdminTable } from "./AdminTable";

export function AdminBookings({ initialRows }) {
  return (
    <div className="min-w-0 md:h-full md:min-h-0 md:overflow-hidden flex flex-col">
      <AdminTable title="Bookings" rows={initialRows} className="md:flex-1 md:min-h-0" />
    </div>
  );
}
