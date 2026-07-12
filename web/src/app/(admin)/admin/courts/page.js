import { Suspense } from "react";
import { CourtsManager, AdminSkeleton } from "@/components/features/admin";
import { getAdminOverview } from "@/lib/dal/admin";
import { requireRouteAccess } from "@/lib/dal/session";

async function CourtsContent() {
  const overview = await getAdminOverview();
  return <CourtsManager courts={overview.courts} />;
}

export default async function CourtsPage() {
  await requireRouteAccess("/admin/courts");
  return (
    <Suspense fallback={<AdminSkeleton metrics={0} />}>
      <CourtsContent />
    </Suspense>
  );
}
