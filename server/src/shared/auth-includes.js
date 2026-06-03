export const includeUserAuthContext = {
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
