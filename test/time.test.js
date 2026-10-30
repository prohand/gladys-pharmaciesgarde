import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClock,
  formatDay,
  isValidTimeZone,
  startOfDay,
  zonedParts,
  zonedTime,
} from '../src/time.js';

test('wall-clock parts in a time zone, Monday = 0', () => {
  const parts = zonedParts(Date.parse('2026-11-01T10:00:00Z'), 'Europe/Paris');
  assert.deepEqual(parts, { year: 2026, month: 11, day: 1, hour: 11, minute: 0, weekday: 6 });
});

test('a local time becomes the right instant, on both sides of DST', () => {
  assert.equal(
    zonedTime({ year: 2026, month: 7, day: 14, hour: 9 }, 'Europe/Paris').toISOString(),
    '2026-07-14T07:00:00.000Z',
  );
  assert.equal(
    zonedTime({ year: 2026, month: 12, day: 25, hour: 9 }, 'Europe/Paris').toISOString(),
    '2026-12-25T08:00:00.000Z',
  );
  // Day 32 rolls over to the next month.
  assert.equal(
    zonedTime({ year: 2026, month: 1, day: 32 }, 'UTC').toISOString(),
    '2026-02-01T00:00:00.000Z',
  );
});

test('a DST day lasts 23 or 25 hours from midnight to midnight', () => {
  const start = zonedTime({ year: 2026, month: 3, day: 29 }, 'Europe/Paris');
  assert.equal(startOfDay(start, 'Europe/Paris', 1) - start, 23 * 3600 * 1000);
  const autumn = zonedTime({ year: 2026, month: 10, day: 25 }, 'Europe/Paris');
  assert.equal(startOfDay(autumn, 'Europe/Paris', 1) - autumn, 25 * 3600 * 1000);
});

test('time zone validation and formatting', () => {
  assert.equal(isValidTimeZone('Europe/Paris'), true);
  assert.equal(isValidTimeZone('Mars/Olympus'), false);
  assert.equal(isValidTimeZone(''), false);
  const at = Date.parse('2026-11-01T22:30:00Z');
  assert.equal(formatClock(at, 'Europe/Paris'), '23:30');
  assert.equal(formatDay(at, 'America/Montreal'), '2026-11-01');
});
