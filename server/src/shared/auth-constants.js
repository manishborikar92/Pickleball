export const Roles = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  MANAGER: 'manager',
  STAFF: 'staff',
  CUSTOMER: 'customer',
});

export const DEFAULT_CUSTOMER_ROLE = Roles.CUSTOMER;
export const DEFAULT_CUSTOMER_PERMISSIONS = ['view_own_bookings'];

// Used only to choose a deterministic top-level role for an identity that has
// assignments at more than one venue. Authorization remains venue-scoped and
// is always resolved from the database at the requested venue.
export const ROLE_PRIORITY = [
  Roles.SUPER_ADMIN,
  Roles.MANAGER,
  Roles.STAFF,
  Roles.CUSTOMER,
];

export const isAdminRole = (role) => Boolean(role) && role !== Roles.CUSTOMER;

export const resolveEffectiveRole = (roleNames = []) => {
  const uniqueRoles = [...new Set(roleNames.filter((role) => typeof role === 'string' && role.length > 0))];
  if (uniqueRoles.length === 0) {
    return DEFAULT_CUSTOMER_ROLE;
  }

  return ROLE_PRIORITY.find((role) => uniqueRoles.includes(role))
    || uniqueRoles.find((role) => role !== Roles.CUSTOMER)
    || DEFAULT_CUSTOMER_ROLE;
};

export const Permissions = {
  MANAGE_COURTS: 'manage_courts',
  EDIT_PRICING: 'edit_pricing',
  EDIT_SCHEDULE: 'edit_schedule',
  MANAGE_BOOKINGS: 'manage_bookings',
  ISSUE_CREDITS: 'issue_credits',
  WALK_IN_ENTRY: 'walk_in_entry',
  VIEW_OWN_BOOKINGS: 'view_own_bookings',
  MANAGE_VENUES: 'manage_venues',
};
