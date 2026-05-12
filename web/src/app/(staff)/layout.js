import { AdminShell } from "@/components/layout/AdminShell";
import { requireRouteAccess } from "@/lib/session";

export default async function StaffLayout({ children }) {
  const session = await requireRouteAccess("/admin");
  return <AdminShell session={session}>{children}</AdminShell>;
}
