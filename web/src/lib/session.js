import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { canAccessRoute, getRolePermissions, roles } from "@/lib/rbac";

export const SESSION_COOKIE = "pb_demo_role";

/**
 * getSession — Resolves the active authenticated session.
 * 
 * Supports an optional preferredType ('customer' | 'staff') to target a specific scope,
 * and falls back to dynamic resolution based on available session cookies.
 * 
 * Staff session values are derived strictly from pb_staff_role / pb_staff_name / pb_staff_phone.
 * Customer session values are derived strictly from pb_demo_role / pb_user_name / pb_user_phone.
 */
export async function getSession(preferredType = null) {
  const cookieStore = await cookies();
  
  const staffRole = cookieStore.get("pb_staff_role")?.value || "";
  const customerRole = cookieStore.get(SESSION_COOKIE)?.value || "";

  // 1. Preferred Staff Session
  if (preferredType === "staff" && roles[staffRole] && staffRole !== "customer") {
    const name = cookieStore.get("pb_staff_name")?.value || "Venue Operator";
    const phone = cookieStore.get("pb_staff_phone")?.value || "+919876543210";
    return {
      user: {
        id: "staff-demo",
        name,
        phone,
      },
      role: staffRole,
      permissions: getRolePermissions(staffRole),
    };
  }

  // 2. Preferred Customer Session
  if (preferredType === "customer" && customerRole === "customer") {
    const name = cookieStore.get("pb_user_name")?.value || "";
    const phone = cookieStore.get("pb_user_phone")?.value || "";
    return {
      user: {
        id: "customer-demo",
        name,
        phone,
      },
      role: "customer",
      permissions: getRolePermissions("customer"),
    };
  }

  // 3. Fallback Dynamic Resolution (Prefer staff if present, otherwise customer)
  if (roles[staffRole] && staffRole !== "customer") {
    const name = cookieStore.get("pb_staff_name")?.value || "Venue Operator";
    const phone = cookieStore.get("pb_staff_phone")?.value || "+919876543210";
    return {
      user: {
        id: "staff-demo",
        name,
        phone,
      },
      role: staffRole,
      permissions: getRolePermissions(staffRole),
    };
  }

  if (customerRole === "customer") {
    const name = cookieStore.get("pb_user_name")?.value || "";
    const phone = cookieStore.get("pb_user_phone")?.value || "";
    return {
      user: {
        id: "customer-demo",
        name,
        phone,
      },
      role: "customer",
      permissions: getRolePermissions("customer"),
    };
  }

  return null;
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
