import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { canAccessRoute, getRolePermissions, roles } from "@/lib/rbac";
import { apiRequest } from "@/services/apiClient";

export const SESSION_COOKIE = "pb_auth_role";
const ACCESS_COOKIE = "pb_access_token";

/**
 * getSession — Resolves the active authenticated session.
 * 
 * Supports an optional preferredType ('customer' | 'staff') to target a specific scope,
 * and falls back to dynamic resolution based on available session cookies.
 * 
 * Session values are resolved from backend-issued HTTP-only cookies and
 * hydrated through the Express API.
 */
export async function getSession(preferredType = null) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value || "";
  if (!accessToken) return null;

  try {
    const { payload } = await apiRequest("/api/v1/users/me", { accessToken });
    const role = cookieStore.get(SESSION_COOKIE)?.value || "customer";
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
}

/**
 * requireRouteAccess — Asserts authentication and authorization access constraints
 * for layouts and page routes on the server side.
 */
export async function requireRouteAccess(pathname) {
  const isStaffRoute = pathname.startsWith("/admin");
  const session = await getSession(isStaffRoute ? "staff" : "customer");

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
    // Already fully onboarded
    redirect("/dashboard");
  }

  // Check RBAC permissions for the route
  if (!canAccessRoute(pathname, session.role)) {
    redirect(isStaffRoute ? "/admin" : "/dashboard");
  }

  return session;
}
