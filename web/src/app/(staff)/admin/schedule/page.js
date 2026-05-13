import { ScheduleManager } from "@/components/features/admin";
import { requireRouteAccess } from "@/lib/session";

export default async function SchedulePage() {
  await requireRouteAccess("/admin/schedule");
  return <ScheduleManager />;
}
