export const includeUserAuthContext = {
  adminCredential: {
    select: {
      email: true,
    },
  },
  venueRoles: {
    include: {
      venue: true,
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
};
