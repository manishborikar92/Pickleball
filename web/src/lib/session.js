import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { canAccessRoute, getRolePermissions, roles } from "@/lib/rbac";
import { apiRequest } from "@/services/apiClient";
import { COOKIES } from "@/constants/cookies";
import { ROUTES } from "@/constants/routes";

export const SESSION_COOKIE = COOKIES.AUTH_ROLE;
const ACCESS_COOKIE = COOKIES.ACCESS_TOKEN;

/**
 * getSession — Resolves the active authenticated session.
 * 
 * Supports an optional preferredType ('customer' | 'staff') to target a specific scope,
 * and falls back to dynamic resolution based on available session cookies.
 * 
 * Session values are resolved from backend-issued HTTP-only cookies and
 * hydrated through the Express API.
 */
export const getSession = cache(async function getSession(preferredType = null) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value || "";
  const refreshToken = cookieStore.get(COOKIES.REFRESH_TOKEN)?.value || "";
  if (!accessToken && !refreshToken) return null;

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
});

/**
 * requireRouteAccess — Asserts authentication and authorization access constraints
 * for layouts and page routes on the server side.
 */
export async function requireRouteAccess(pathname) {
  const isStaffRoute = pathname.startsWith(ROUTES.ADMIN);
  const session = await getSession(isStaffRoute ? "staff" : "customer");

  if (!session) {
    if (isStaffRoute) {
      redirect(`${ROUTES.STAFF_LOGIN}?next=${encodeURIComponent(pathname)}`);
    } else {
      redirect(`${ROUTES.LOGIN}?next=${encodeURIComponent(pathname)}`);
    }
  }

  // Customer onboarding check: Must provide a name if authenticated as a customer
  if (session.role === "customer" && !session.user.name) {
    if (pathname !== ROUTES.ONBOARDING) {
      redirect(`${ROUTES.ONBOARDING}?next=${encodeURIComponent(pathname)}`);
    }
  } else if (session.role === "customer" && session.user.name && pathname === ROUTES.ONBOARDING) {
    // Already fully onboarded
    redirect(ROUTES.DASHBOARD);
  }

  // Check RBAC permissions for the route
  if (!canAccessRoute(pathname, session.role)) {
    redirect(isStaffRoute ? ROUTES.ADMIN : ROUTES.DASHBOARD);
  }

  return session;
}
