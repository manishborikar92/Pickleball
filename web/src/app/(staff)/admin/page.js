import { AdminOverview } from "@/components/features/admin/AdminViews";
import { getAdminOverview } from "@/lib/api";
import { requireRouteAccess } from "@/lib/session";

export const metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  await requireRouteAccess("/admin");
  const overview = await getAdminOverview();
  return <AdminOverview overview={overview} />;
}
