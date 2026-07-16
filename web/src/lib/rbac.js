export const roles = {
  super_admin: {
    label: "Super Admin",
    inherits: ["manager"],
    permissions: ["manage_venues"],
  },
  manager: {
    label: "Manager",
    inherits: ["staff"],
    permissions: [
      "manage_courts",
      "edit_pricing",
      "edit_schedule",
      "issue_credits",
    ],
  },
  staff: {
    label: "Staff",
    inherits: ["customer"],
    permissions: ["manage_bookings", "walk_in_entry"],
  },
  customer: {
    label: "Customer",
    inherits: [],
    permissions: ["view_own_bookings"],
  },
};

export const routeAccess = {
  // Group roots — carry the baseline permission for the area so the redirect
  // stubs (/dashboard → /dashboard/overview, /admin → /admin/overview) resolve.
  "/dashboard": { auth: true, permission: "view_own_bookings" },
  "/dashboard/overview": { auth: true, permission: "view_own_bookings" },
  "/dashboard/bookings": { auth: true, permission: "view_own_bookings" },
  "/dashboard/wallet": { auth: true, permission: "view_own_bookings" },
  "/dashboard/rewards": { auth: true, permission: "view_own_bookings" },
  "/admin": { auth: true, permission: "manage_bookings" },
  "/admin/overview": { auth: true, permission: "manage_bookings" },
  "/admin/bookings": { auth: true, permission: "manage_bookings" },
  "/admin/schedule": { auth: true, permission: "edit_schedule" },
  "/admin/pricing": { auth: true, permission: "edit_pricing" },
  // Staff run the redemption desk (manage_bookings); the mechanisms panel
  // inside the page is additionally gated on edit_pricing.
  "/admin/rewards": { auth: true, permission: "manage_bookings" },
  "/admin/courts": { auth: true, permission: "manage_courts" },
  "/admin/users": { auth: true, permission: "manage_bookings" },
  "/admin/settings": { auth: true, permission: "manage_venues" },
};

/**
 * Route prefixes that require authorization. Any path under one of these that
 * is NOT explicitly mapped in `routeAccess` is denied (fail-closed), so a
 * missing table entry can never silently grant access.
 */
export const PROTECTED_PREFIXES = ["/admin", "/dashboard"];

function isProtectedPath(pathname) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

const collectPermissions = (roleName, visited = new Set()) => {
  const role = roles[roleName];
  if (!role || visited.has(roleName)) return [];
  visited.add(roleName);

  const inherited = role.inherits.flatMap((parent) =>
    collectPermissions(parent, visited),
  );

  return [...new Set([...inherited, ...role.permissions])];
};

export function getRolePermissions(roleName = "customer") {
  return collectPermissions(roleName);
}

export function hasPermission(roleName, permission) {
  return getRolePermissions(roleName).includes(permission);
}

export function getRouteAccess(pathname) {
  return routeAccess[pathname] || null;
}

export function canAccessRoute(pathname, roleName) {
  const access = getRouteAccess(pathname);
  if (!access) {
    // Fail-closed: an unmapped route under a protected prefix is denied (CR-1).
    // Public routes (no protected prefix) remain open.
    return !isProtectedPath(pathname);
  }
  if (!access.auth) return true;
  if (!roleName) return false;
  return hasPermission(roleName, access.permission);
}
