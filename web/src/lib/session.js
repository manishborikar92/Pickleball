import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { canAccessRoute, getRolePermissions } from "@/lib/rbac";
import { apiRequest } from "@/lib/apiClient";
import { COOKIE_NAMES } from "@/lib/cookies";

/**
 * getSession — Resolves the active authenticated session.
 * Cached per request via React cache().
 */
export const getSession = cache(async function getSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";
  if (!accessToken && !refreshToken) return null;

  try {
    const { payload } = await apiRequest("/api/v1/users/me", { accessToken });
    const role = cookieStore.get(COOKIE_NAMES.AUTH_ROLE)?.value || "customer";
    return {
      user: {
        id: payload.data.id,
        name: payload.data.name || "",
        phone: payload.data.phone || "",
      },
      role,
      permissions: payload.data.permissions || getRolePermissions(role),
    };
  } catch {
    return null;
  }
});

/**
 * requireRouteAccess — Asserts authentication and authorization access constraints
 * for layouts and page routes on the server side.
 */
export async function requireRouteAccess(pathname) {
  const isStaffRoute = pathname.startsWith("/admin");
  const session = await getSession();

  if (!session) {
    if (isStaffRoute) {
      redirect(`/staff-login?next=${encodeURIComponent(pathname)}`);
    } else {
      redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  // Customer onboarding check: Must provide a name if authenticated as a customer
  if (session.role === "customer" && !session.user.name) {
    if (pathname !== "/onboarding") {
      redirect(`/onboarding?next=${encodeURIComponent(pathname)}`);
    }
  } else if (session.role === "customer" && session.user.name && pathname === "/onboarding") {
    redirect("/dashboard/overview");
  }

  // Check RBAC permissions for the route
  if (!canAccessRoute(pathname, session.role)) {
    redirect(isStaffRoute ? "/admin/overview" : "/dashboard/overview");
  }

  return session;
}
