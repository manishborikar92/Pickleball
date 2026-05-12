import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { canAccessRoute, getRolePermissions, roles } from "@/lib/rbac";

export const SESSION_COOKIE = "pb_demo_role";

export async function getSession() {
  const cookieStore = await cookies();
  const role = cookieStore.get(SESSION_COOKIE)?.value || "";
  if (!roles[role]) return null;

  return {
    user: {
      id: "user-demo",
      name: role === "customer" ? "Asha Mehta" : "Venue Operator",
      phone: "+919876543210",
    },
    role,
    permissions: getRolePermissions(role),
  };
}

export async function requireRouteAccess(pathname) {
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(pathname)}`);
  }

  if (!canAccessRoute(pathname, session.role)) {
    redirect("/dashboard");
  }

  return session;
}
