import { CourtsManager } from "@/components/features/admin/AdminViews";
import { getAdminOverview } from "@/lib/api";
import { requireRouteAccess } from "@/lib/session";

export default async function CourtsPage() {
  await requireRouteAccess("/admin/courts");
  const overview = await getAdminOverview();
  return <CourtsManager courts={overview.courts} />;
}
