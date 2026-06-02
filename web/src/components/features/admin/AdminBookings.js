import { AdminTable } from "./AdminTable";

export function AdminBookings({ initialRows }) {
  return (
    <div className="min-w-0">
      <AdminTable title="Bookings" rows={initialRows} />
    </div>
  );
}
