import { Suspense } from "react";

import { AdminSkeleton, RewardsManager } from "@/components/features/admin";
import { getRewardInstancesForModeration, getRewardMechanisms } from "@/lib/dal/rewardsAdmin";
import { requireRouteAccess } from "@/lib/dal/session";
import { hasPermission } from "@/lib/rbac";

async function RewardsContent({ canEditPricing }) {
  // Staff hold manage_bookings but not edit_pricing — the mechanisms read
  // would 403, so it is only issued for managers. The redemption desk and
  // instance list are the staff surface.
  const [moderation, mechanismsResult] = await Promise.all([
    getRewardInstancesForModeration({ limit: 100 }),
    canEditPricing ? getRewardMechanisms() : Promise.resolve(null),
  ]);

  return (
    <RewardsManager
      venueId={moderation.venueId}
      mechanisms={mechanismsResult?.mechanisms || []}
      instances={moderation.instances}
      canEditPricing={canEditPricing}
    />
  );
}

export default async function AdminRewardsPage() {
  const session = await requireRouteAccess("/admin/rewards");
  const canEditPricing = hasPermission(session.role, "edit_pricing");

  return (
    <Suspense fallback={<AdminSkeleton metrics={0} />}>
      <RewardsContent canEditPricing={canEditPricing} />
    </Suspense>
  );
}
