import {
  addMinutesToTime,
  formatTime,
  getUtcDayOfWeek,
  isDateWithinAdvanceWindow,
  timeToMinutes,
  toDateOnly,
  localDateTimeToUtc,
} from '../bookings/booking-time.js';
import { BadRequestError, NotFoundError } from '../../utils/api-error.js';

const isExceptionForCourt = (exception, courtId) => !exception.courtId || exception.courtId === courtId;

const findException = ({ exceptions, courtId, date }) => exceptions.find((exception) => (
  isExceptionForCourt(exception, courtId)
  && toDateOnly(exception.exceptionDate) === date
));

const findSchedule = ({ schedules, courtId, dayOfWeek }) => schedules.find((schedule) => (
  schedule.courtId === courtId
  && schedule.isActive !== false
  && Array.isArray(schedule.dayOfWeek)
  && schedule.dayOfWeek.includes(dayOfWeek)
));

const generateSlots = ({ openTime, closeTime, slotDurationMins }) => {
  const slots = [];
  const open = timeToMinutes(openTime);
  const close = timeToMinutes(closeTime);
  for (let cursor = open; cursor + slotDurationMins <= close; cursor += slotDurationMins) {
    slots.push({
      start_time: formatTime(new Date(`1970-01-01T${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}:00.000Z`)),
      end_time: addMinutesToTime(`${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`, slotDurationMins),
    });
  }
  return slots;
};

const slotState = ({ bookingSlots, courtId, slotStartTime, now, slotDate, venueTimezone }) => {
  const match = bookingSlots.find((slot) => (
    slot.courtId === courtId
    && formatTime(slot.slotStartTime) === slotStartTime
  ));

  let resolvedStatus = 'available';
  if (match) {
    if (match.status === 'admin_block') resolvedStatus = 'blocked';
    else if (match.status === 'pending_payment') {
      resolvedStatus = match.booking?.expiresAt && match.booking.expiresAt > now ? 'pending' : 'available';
    } else {
      resolvedStatus = 'booked';
    }
  }

  if (resolvedStatus === 'available') {
    const slotStartUtc = localDateTimeToUtc(slotDate, slotStartTime, venueTimezone);
    if (now >= slotStartUtc) {
      return 'past';
    }
  }

  return resolvedStatus;
};

export const createVenuesService = ({
  repository,
  pricingService,
  clock = () => new Date(),
} = {}) => {
  if (!repository) throw new Error('repository is required');
  if (!pricingService) throw new Error('pricingService is required');

  return {
    async getVenueById(venueId) {
      const venue = await repository.findById(venueId);
      if (!venue) throw new NotFoundError('Venue not found');
      return venue;
    },

    async getVenueBySlug(slug) {
      const venue = await repository.findBySlug(slug);
      if (!venue) throw new NotFoundError('Venue not found');
      return venue;
    },

    async getAvailability({ venueId, date }) {
      const normalizedDate = toDateOnly(date);
      const context = await repository.getAvailabilityContext({ venueId, date: normalizedDate });
      const now = clock();

      if (!context?.venue) {
        throw new NotFoundError('Venue not found');
      }

      if (!isDateWithinAdvanceWindow({ slotDate: normalizedDate, venue: context.venue, now })) {
        throw new BadRequestError('Date is outside the booking window', { code: 'DATE_OUTSIDE_BOOKING_WINDOW' });
      }

      const activeCourts = (context.courts || [])
        .filter((court) => court.status === 'active')
        .sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0));
      const dayOfWeek = getUtcDayOfWeek(normalizedDate);

      const courtPayloads = activeCourts.map((court) => {
        const exception = findException({
          exceptions: context.scheduleExceptions || [],
          courtId: court.id,
          date: normalizedDate,
        });

        if (exception?.exceptionType === 'closed') {
          return {
            court_id: court.id,
            court_name: court.name,
            environment: court.environment,
            slots: [],
          };
        }

        const schedule = findSchedule({
          schedules: context.schedules || [],
          courtId: court.id,
          dayOfWeek,
        });

        if (!schedule && !exception) {
          return {
            court_id: court.id,
            court_name: court.name,
            environment: court.environment,
            slots: [],
          };
        }

        const openTime = exception?.exceptionType === 'modified_hours' ? exception.openTime : schedule.openTime;
        const closeTime = exception?.exceptionType === 'modified_hours' ? exception.closeTime : schedule.closeTime;
        const slotDurationMins = schedule?.slotDurationMins || 60;
        const slots = generateSlots({ openTime, closeTime, slotDurationMins }).map((slot) => {
          const status = slotState({
            bookingSlots: context.bookingSlots || [],
            courtId: court.id,
            slotStartTime: slot.start_time,
            now,
            slotDate: normalizedDate,
            venueTimezone: context.venue.timezone,
          });

          if (status !== 'available') {
            return { ...slot, status };
          }

          return {
            ...slot,
            status,
            unit_price: pricingService.calculateUnitPrice({
              court,
              slotDate: normalizedDate,
              slotStartTime: slot.start_time,
              pricingRules: context.pricingRules || [],
            }),
          };
        });

        return {
          court_id: court.id,
          court_name: court.name,
          environment: court.environment,
          slots,
        };
      });

      const slotDuration = (context.schedules || []).find((schedule) => schedule.isActive !== false)?.slotDurationMins || 60;

      return {
        date: normalizedDate,
        slot_duration_mins: slotDuration,
        courts: courtPayloads,
      };
    },
  };
};
