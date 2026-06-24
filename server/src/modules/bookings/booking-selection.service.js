import {
  addMinutesToTime,
  isDateWithinAdvanceWindow,
  localDateTimeToUtc,
} from './booking-time.js';
import { BadRequestError, ConflictError } from '../../utils/api-error.js';

const normalizeUniqueSorted = (values) => [...new Set(values)].sort();

export const createBookingSelectionService = ({ clock = () => new Date() } = {}) => ({
  validateSelection({
    venue,
    courts = [],
    availability,
    input,
  }) {
    const courtIds = normalizeUniqueSorted(input.court_ids || []);
    const slotStartTimes = normalizeUniqueSorted(input.slot_start_times || []);

    if (courtIds.length === 0) {
      throw new BadRequestError('At least one court is required', { code: 'COURTS_REQUIRED' });
    }

    if (slotStartTimes.length === 0) {
      throw new BadRequestError('At least one slot is required', { code: 'SLOTS_REQUIRED' });
    }

    if (!isDateWithinAdvanceWindow({ slotDate: input.slot_date, venue, now: clock() })) {
      throw new BadRequestError('Date is outside the booking window', { code: 'DATE_OUTSIDE_BOOKING_WINDOW' });
    }

    const now = clock();
    const timezone = venue.timezone || 'Asia/Kolkata';
    for (const slotStartTime of slotStartTimes) {
      const slotStartUtc = localDateTimeToUtc(input.slot_date, slotStartTime, timezone);
      if (now >= slotStartUtc) {
        throw new BadRequestError(`Slot starting at ${slotStartTime} is in the past`, { code: 'SLOT_IN_PAST' });
      }
    }

    const selectedCourts = courtIds.map((courtId) => {
      const court = courts.find((item) => item.id === courtId);
      if (!court || court.venueId !== venue.id || court.status !== 'active') {
        throw new BadRequestError('One or more courts are invalid', { code: 'INVALID_COURT' });
      }
      return court;
    });

    const slotDurationMins = availability.slot_duration_mins;
    for (let index = 1; index < slotStartTimes.length; index += 1) {
      if (slotStartTimes[index] !== addMinutesToTime(slotStartTimes[index - 1], slotDurationMins)) {
        throw new BadRequestError('Selected slots must be consecutive', { code: 'SLOTS_NOT_CONSECUTIVE' });
      }
    }

    for (const courtId of courtIds) {
      const courtAvailability = availability.courts.find((court) => court.court_id === courtId);
      if (!courtAvailability) {
        throw new BadRequestError('Court availability was not found', { code: 'INVALID_COURT' });
      }

      for (const slotStartTime of slotStartTimes) {
        const slot = courtAvailability.slots.find((item) => item.start_time === slotStartTime);
        if (!slot || slot.status !== 'available') {
          throw new ConflictError(`Slot ${slotStartTime} is not available`, { code: 'SLOT_NOT_AVAILABLE' });
        }
      }
    }

    return {
      courts: selectedCourts,
      slotStartTimes,
      slotDurationMins,
    };
  },
});
