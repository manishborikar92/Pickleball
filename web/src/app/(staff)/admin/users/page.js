import { UsersManager } from "@/components/features/admin";
import { requireRouteAccess } from "@/lib/session";

export default async function UsersPage() {
  await requireRouteAccess("/admin/users");
  return <UsersManager />;
}
