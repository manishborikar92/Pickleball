import { SettingsView } from "@/components/features/admin";
import { requireRouteAccess } from "@/lib/dal/session";

export default async function SettingsPage() {
  await requireRouteAccess("/admin/settings");
  return <SettingsView />;
}
