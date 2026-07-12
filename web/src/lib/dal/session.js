/**
 * dal/session.js — The authorization boundary (ADR-W002).
 *
 * Server-only. This is where authentication + authorization are enforced, "as
 * close as possible to the data source" (Next.js 16 guidance). Pages, owned-
 * resource reads, and every mutation action call these helpers with the REAL
 * path/permission/resource — never a hard-coded group root (the CR-1 bug).
 *
 * `verifySession()` returns a minimal DTO whose role/permissions are derived
 * from the authoritative `/users/me` response, NOT the client-presentable role
 * cookie (HI-10). The role cookie is treated as an optimistic hint only.
 */

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { apiRequest } from "@/lib/dal/httpClient";
import { canAccessRoute, hasPermission } from "@/lib/rbac";
import { resolveRole } from "@/lib/auth";
import { COOKIE_NAMES } from "@/config/auth.config";

/**
 * @typedef {Object} SessionUser
 * @property {string} id
 * @property {string} name
 * @property {string} phone
 * @property {boolean} onboarded
 *
 * @typedef {Object} Session
 * @property {SessionUser} user
 * @property {string} role                 - Effective role derived from /users/me.
 * @property {string[]} permissions        - Permission keys from /users/me.
 * @property {Array<{venueId: string, venueName: string, role: string}>} venueRoles
 */

/**
 * Reads the session from the request cookies and verifies it against the backend.
 * Returns a minimal DTO, or `null` when unauthenticated / token invalid.
 *
 * Cached per-request via React `cache()` so the layout + page + actions in one
 * render share a single `/users/me` round-trip (ME-8). Includes refresh-on-401
 * so an access token that expired since the proxy ran is transparently renewed.
 *
 * @returns {Promise<Session | null>}
 */
export const verifySession = cache(async function verifySession() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.ACCESS_TOKEN)?.value || "";
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value || "";

  if (!accessToken && !refreshToken) return null;

  try {
    const { payload } = await apiRequest("/api/v1/users/me", {
      accessToken,
      refreshToken,
      retryOnUnauthorized: true,
    });

    const data = payload.data;
    // Authoritative role/permissions from the API response (HI-10).
    const venueRoles = (data.roles || []).map((entry) => ({
      venueId: entry.venue_id,
      venueName: entry.venue_name,
      role: entry.role,
    }));
    const role = resolveRole({ roles: venueRoles.map((r) => r.role) });
    const permissions = Array.isArray(data.permissions) ? data.permissions : [];

    return {
      user: {
        id: data.id,
        name: data.name || "",
        phone: data.phone || "",
        onboarded: Boolean(data.onboarding_complete),
      },
      role,
      permissions,
      venueRoles,
    };
  } catch {
    return null;
  }
});

/**
 * Returns the session or redirects to the appropriate login. Use in protected
 * pages/layouts. `pathname` is the REAL request path so the redirect can carry
 * an accurate `next`.
 *
 * @param {string} pathname
 * @returns {Promise<Session>}
 */
export async function requireUser(pathname) {
  const isAdminRoute = pathname.startsWith("/admin");
  const session = await verifySession();

  if (!session) {
    const loginBase = isAdminRoute ? "/admin/login" : "/login";
    redirect(`${loginBase}?next=${encodeURIComponent(pathname)}`);
  }

  // Onboarding gate for customers who have not set a name yet.
  if (session.role === "customer" && !session.user.name) {
    if (pathname !== "/onboarding") {
      redirect(`/onboarding?next=${encodeURIComponent(pathname)}`);
    }
  } else if (session.role === "customer" && session.user.name && pathname === "/onboarding") {
    redirect("/dashboard/overview");
  }

  return session;
}

/**
 * Asserts authentication AND route/permission authorization for `pathname`.
 * `canAccessRoute` is fail-closed for unmapped protected paths (CR-1), so this
 * cannot silently grant access. Redirects on denial.
 *
 * @param {string} pathname
 * @returns {Promise<Session>}
 */
export async function requireRouteAccess(pathname) {
  const session = await requireUser(pathname);
  const isAdminRoute = pathname.startsWith("/admin");

  if (!canAccessRoute(pathname, session.role)) {
    redirect(isAdminRoute ? "/admin/overview" : "/dashboard/overview");
  }
  return session;
}

/**
 * Asserts the caller holds a specific permission. For use inside mutation
 * actions / route handlers where there is no pathname. Returns the session on
 * success; throws a NEXT_REDIRECT via `redirect` is inappropriate here (actions
 * return typed results), so callers should check the boolean form when they want
 * to return an error result instead of redirecting.
 *
 * @param {string} permission
 * @returns {Promise<Session>}
 * @throws {Error} when unauthenticated or unauthorized (caught by actions).
 */
export async function requirePermission(permission) {
  const session = await verifySession();
  if (!session) {
    const err = new Error("Authentication required");
    err.code = "unauthorized";
    throw err;
  }
  if (permission && !hasPermission(session.role, permission)) {
    const err = new Error("You do not have permission to perform this action");
    err.code = "forbidden";
    throw err;
  }
  return session;
}

/**
 * Resource-level ownership check (IDOR guard — CR-2). Returns true when the
 * resource belongs to the session user or the caller holds an override
 * permission (e.g. staff `manage_bookings`).
 *
 * @param {Session} session
 * @param {string} resourceOwnerId
 * @param {string} [overridePermission]
 * @returns {boolean}
 */
export function ownsResource(session, resourceOwnerId, overridePermission) {
  if (!session?.user) return false;
  if (resourceOwnerId && session.user.id === resourceOwnerId) return true;
  if (overridePermission && hasPermission(session.role, overridePermission)) return true;
  return false;
}
