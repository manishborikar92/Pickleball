import { Suspense } from "react";
import { AdminOverview, AdminSkeleton } from "@/components/features/admin";
import { getAdminOverview } from "@/lib/dal/admin";
import { requireRouteAccess } from "@/lib/dal/session";

export const metadata = {
  title: "Admin",
};

async function OverviewContent() {
  const overview = await getAdminOverview();
  return <AdminOverview overview={overview} />;
}

export default async function AdminOverviewPage() {
  await requireRouteAccess("/admin/overview");
  return (
    <Suspense fallback={<AdminSkeleton />}>
      <OverviewContent />
    </Suspense>
  );
}
