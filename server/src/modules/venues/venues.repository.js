import { getPrisma } from '../../lib/prisma.js';

const serializeVenue = (venue) => ({
  id: venue.id,
  name: venue.name,
  slug: venue.slug,
  address: venue.address,
  city: venue.city,
  timezone: venue.timezone,
  currency: venue.currency,
  advance_booking_days: venue.advanceBookingDays,
  rollover_time: venue.rolloverTime,
  phone: venue.phone,
  secondary_phone: venue.secondaryPhone,
  email: venue.email,
  courts: (venue.courts || []).map((court) => ({
    id: court.id,
    name: court.name,
    environment: court.environment,
    surface_type: court.surfaceType,
    description: court.description,
    cover_image_url: court.coverImageUrl,
    status: court.status,
    display_order: court.displayOrder,
  })),
});

const venueInclude = {
  courts: {
    where: { deletedAt: null },
    orderBy: { displayOrder: 'asc' },
  },
};

export const createVenuesRepository = ({ prisma } = {}) => {
  const db = () => prisma || getPrisma();

  return {
    async findById(venueId) {
      const venue = await db().venue.findFirst({
        where: {
          id: venueId,
          deletedAt: null,
          isActive: true,
        },
        include: venueInclude,
      });

      return venue ? serializeVenue(venue) : null;
    },

    async findBySlug(slug) {
      const venue = await db().venue.findFirst({
        where: {
          slug,
          deletedAt: null,
          isActive: true,
        },
        include: venueInclude,
      });

      return venue ? serializeVenue(venue) : null;
    },

    async getAvailabilityContext({ venueId, date }) {
      const slotDate = new Date(`${date}T00:00:00.000Z`);

      const venue = await db().venue.findFirst({
        where: {
          id: venueId,
          deletedAt: null,
          isActive: true,
        },
      });

      if (!venue) {
        return { venue: null };
      }

      const [courts, schedules, scheduleExceptions, bookingSlots, pricingRules] = await Promise.all([
        db().court.findMany({
          where: {
            venueId,
            deletedAt: null,
          },
          include: {
            basePrice: true,
          },
          orderBy: { displayOrder: 'asc' },
        }),
        db().schedule.findMany({
          where: {
            venueId,
            isActive: true,
          },
        }),
        db().scheduleException.findMany({
          where: {
            venueId,
            exceptionDate: slotDate,
          },
        }),
        db().bookingSlot.findMany({
          where: {
            slotDate,
            booking: {
              venueId,
            },
            status: {
              in: ['pending_payment', 'confirmed', 'walk_in', 'admin_block'],
            },
          },
          include: {
            booking: {
              select: {
                status: true,
                expiresAt: true,
              },
            },
          },
        }),
        db().pricingRule.findMany({
          where: {
            venueId,
            isActive: true,
          },
          orderBy: [
            { priority: 'asc' },
            { createdAt: 'asc' },
          ],
        }),
      ]);

      return {
        venue,
        courts,
        schedules,
        scheduleExceptions,
        bookingSlots,
        pricingRules,
      };
    },
  };
};
