import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { canAccessRoute, getRolePermissions } from "@/lib/rbac";
import { apiRequest } from "@/lib/apiClient";
import { COOKIE_NAMES } from "@/config/auth.config";

/**
 * getSession — Resolves the active authenticated session.
 *
 * Read-only: reads cookies and calls the API. Never refreshes tokens
 * and never writes cookies. Token refresh happens in proxy.js BEFORE
 * this code runs, so the access token in cookies is always fresh.
 *
 * If the API returns 401 despite proxy refresh, the token is genuinely
 * invalid — return null and let requireRouteAccess handle the redirect.
 *
 * Cached per request via React cache() so parallel calls in the same
 * render (e.g. layout + page) only hit the API once.
 */
export const getSession = cache(async function getSession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";

  if (!accessToken && !refreshToken) return null;

  try {
    const { payload } = await apiRequest("/api/v1/users/me", {
      accessToken,
      refreshToken,
    });
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
 * requireRouteAccess — Asserts authentication and authorization for
 * server layouts. If session is null (user not authenticated or token
 * invalid), redirects to login. The proxy has already attempted token
 * refresh before this runs, so a null session here means genuinely
 * unauthenticated.
 */
export async function requireRouteAccess(pathname) {
  const isAdminRoute = pathname.startsWith("/admin");
  const session = await getSession();

  if (!session) {
    if (isAdminRoute) {
      redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
    } else {
      redirect(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  if (session.role === "customer" && !session.user.name) {
    if (pathname !== "/onboarding") {
      redirect(`/onboarding?next=${encodeURIComponent(pathname)}`);
    }
  } else if (session.role === "customer" && session.user.name && pathname === "/onboarding") {
    redirect("/dashboard/overview");
  }

  if (!canAccessRoute(pathname, session.role)) {
    redirect(isAdminRoute ? "/admin/overview" : "/dashboard/overview");
  }

  return session;
}
