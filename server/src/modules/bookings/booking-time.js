const pad = (value) => String(value).padStart(2, '0');

export const toDateOnly = (value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value || '').slice(0, 10);
};

export const timeToMinutes = (value) => {
  if (value instanceof Date) {
    return value.getUTCHours() * 60 + value.getUTCMinutes();
  }

  const match = String(value || '').match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return Number.NaN;
  }

  return Number(match[1]) * 60 + Number(match[2]);
};

export const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const minutesToTimeDate = (minutes) => {
  const date = new Date('1970-01-01T00:00:00.000Z');
  date.setUTCHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
};

export const formatTime = (value) => minutesToTime(timeToMinutes(value));

export const addMinutesToTime = (value, durationMins) => minutesToTime(timeToMinutes(value) + durationMins);

export const getUtcDayOfWeek = (date) => {
  const parsed = new Date(`${toDateOnly(date)}T00:00:00.000Z`);
  return parsed.getUTCDay();
};

export const getDayName = (date) => (
  ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][getUtcDayOfWeek(date)]
);

export const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const isDateWithinAdvanceWindow = ({
  slotDate,
  venue,
  now,
}) => {
  const target = new Date(`${slotDate}T00:00:00.000Z`);
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  const rolloverMinutes = timeToMinutes(venue.rolloverTime || '00:00');
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const visibleDays = Number(venue.advanceBookingDays || 1) - (nowMinutes < rolloverMinutes ? 1 : 0);
  const last = new Date(today);
  last.setUTCDate(today.getUTCDate() + Math.max(0, visibleDays));

  return target >= today && target <= last;
};

export const localDateTimeToUtc = (date, time, venueTimezone) => {
  const dateStr = toDateOnly(date);
  const timeStr = formatTime(time);
  const localISO = `${dateStr}T${timeStr}:00`;
  const localUtc = new Date(`${localISO}Z`);
  const tzString = localUtc.toLocaleString('en-US', { timeZone: venueTimezone, timeZoneName: 'longOffset' });
  const match = tzString.match(/GMT([+-])(\d+):?(\d+)?/);
  if (!match) {
    return localUtc;
  }
  const sign = match[1] === '+' ? 1 : -1;
  const hours = parseInt(match[2], 10);
  const minutes = parseInt(match[3] || '0', 10);
  const offsetMs = sign * (hours * 60 + minutes) * 60 * 1000;

  return new Date(localUtc.getTime() - offsetMs);
};
