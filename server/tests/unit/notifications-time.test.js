import assert from 'node:assert/strict';
import test from 'node:test';

import { getBookingEndUtc, getBookingStartUtc } from '../../src/modules/bookings/booking-time.js';

// Session 09:00–11:00 on 2026-08-10, Asia/Kolkata (UTC+5:30). Local 09:00 IST
// == 03:30 UTC; local 11:00 IST == 05:30 UTC.
const BOOKING = {
  slotDate: new Date('2026-08-10T00:00:00.000Z'),
  sessionStartTime: new Date('1970-01-01T09:00:00.000Z'),
  sessionEndTime: new Date('1970-01-01T11:00:00.000Z'),
};
const TZ = 'Asia/Kolkata';

test('getBookingStartUtc resolves the session start in UTC from the venue timezone', () => {
  const start = getBookingStartUtc(BOOKING, TZ);
  assert.equal(start.toISOString(), '2026-08-10T03:30:00.000Z');
});

test('getBookingEndUtc resolves the session end in UTC from the venue timezone', () => {
  const end = getBookingEndUtc(BOOKING, TZ);
  assert.equal(end.toISOString(), '2026-08-10T05:30:00.000Z');
});

test('T-24h and T-2h reminder offsets land on the correct instants', () => {
  const start = getBookingStartUtc(BOOKING, TZ);
  assert.equal(new Date(start.getTime() - 24 * 3600e3).toISOString(), '2026-08-09T03:30:00.000Z');
  assert.equal(new Date(start.getTime() - 2 * 3600e3).toISOString(), '2026-08-10T01:30:00.000Z');
});

test('overnight session end rolls forward a day', () => {
  const overnight = {
    slotDate: new Date('2026-08-10T00:00:00.000Z'),
    sessionStartTime: new Date('1970-01-01T22:00:00.000Z'),
    sessionEndTime: new Date('1970-01-01T01:00:00.000Z'), // 01:00 on 2026-08-11
  };
  const end = getBookingEndUtc(overnight, TZ);
  // Local 01:00 IST on 2026-08-11 == 19:30 UTC on 2026-08-10.
  assert.equal(end.toISOString(), '2026-08-10T19:30:00.000Z');
  assert.ok(end.getTime() > getBookingStartUtc(overnight, TZ).getTime());
});

test('timezone offset is respected (same wall time, different zone → different UTC)', () => {
  const kolkata = getBookingStartUtc(BOOKING, 'Asia/Kolkata');
  const utc = getBookingStartUtc(BOOKING, 'UTC');
  assert.equal(utc.toISOString(), '2026-08-10T09:00:00.000Z');
  assert.notEqual(kolkata.getTime(), utc.getTime());
  assert.equal(utc.getTime() - kolkata.getTime(), 5.5 * 3600e3);
});
