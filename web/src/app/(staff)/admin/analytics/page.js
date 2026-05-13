import { AnalyticsView } from "@/components/features/admin";
import { requireRouteAccess } from "@/lib/session";

export default async function AnalyticsPage() {
  await requireRouteAccess("/admin/analytics");
  return <AnalyticsView />;
}
