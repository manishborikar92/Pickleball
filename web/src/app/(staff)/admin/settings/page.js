import { SettingsView } from "@/components/features/admin/AdminViews";
import { requireRouteAccess } from "@/lib/session";

export default async function SettingsPage() {
  await requireRouteAccess("/admin/settings");
  return <SettingsView />;
}
