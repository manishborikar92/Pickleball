import { Suspense } from "react";

import { AdminSkeleton, SettingsView } from "@/components/features/admin";
import { getNotificationLog, getNotificationSettings } from "@/lib/dal/notifications";
import { requireRouteAccess } from "@/lib/dal/session";
import { hasPermission } from "@/lib/rbac";

async function SettingsContent({ canManageBookings }) {
  // Settings toggles need manage_venues (already enforced by requireRouteAccess);
  // the recent-activity log additionally requires manage_bookings.
  const [settingsResult, logResult] = await Promise.all([
    getNotificationSettings(),
    canManageBookings ? getNotificationLog({ limit: 8 }) : Promise.resolve(null),
  ]);

  return (
    <SettingsView
      venueId={settingsResult.venueId}
      settings={settingsResult.settings}
      activity={logResult?.rows || []}
      summary={logResult?.summary || null}
      canViewLog={canManageBookings}
    />
  );
}

export default async function SettingsPage() {
  const session = await requireRouteAccess("/admin/settings");
  const canManageBookings = hasPermission(session.role, "manage_bookings");

  return (
    <Suspense fallback={<AdminSkeleton metrics={0} />}>
      <SettingsContent canManageBookings={canManageBookings} />
    </Suspense>
  );
}
