// -----------------------------------------------------------------------------
// Wall-clock time in a given time zone.
//
// A duty rota says "Sunday 9:00" in the time of the town, and opening hours say
// "Mo-Sa 08:30-19:30" in the same local time — while the container may run in
// UTC. Everything that reads or writes a local time goes through these helpers,
// with the time zone of the configuration, so the answer never depends on the
// TZ of the container.
// -----------------------------------------------------------------------------

const MINUTE_MS = 60 * 1000;

const formatters = new Map();

function formatterFor(timeZone) {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

const WEEKDAYS = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/**
 * Whether the runtime knows a time zone name (IANA, e.g. Europe/Paris).
 * @param {string} timeZone
 */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone.trim() === '') return false;
  try {
    formatterFor(timeZone.trim());
    return true;
  } catch {
    return false;
  }
}

/**
 * The wall-clock parts of an instant in a time zone. `weekday` is 0 for Monday
 * through 6 for Sunday, the order of the opening hours.
 * @param {Date | number} date
 * @param {string} timeZone
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, weekday: number }}
 */
export function zonedParts(date, timeZone) {
  const parts = {};
  for (const { type, value } of formatterFor(timeZone).formatToParts(new Date(date))) {
    parts[type] = value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

// Offset of the time zone at an instant, in milliseconds (UTC + offset = local).
function offsetAt(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(ms / MINUTE_MS) * MINUTE_MS;
}

/**
 * The instant of a wall-clock time in a time zone. Days and hours out of range
 * roll over (day 32 is the 1st of the next month), which keeps the date math
 * of the callers simple. A time skipped by a DST change lands an hour later.
 * @param {{ year: number, month: number, day: number, hour?: number, minute?: number }} wall
 * @param {string} timeZone
 * @returns {Date}
 */
export function zonedTime({ year, month, day, hour = 0, minute = 0 }, timeZone) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const first = guess - offsetAt(guess, timeZone);
  const second = guess - offsetAt(first, timeZone);
  return new Date(second);
}

/**
 * Local midnight of the day `days` after the day of `date`.
 * @param {Date | number} date
 * @param {string} timeZone
 * @param {number} [days]
 */
export function startOfDay(date, timeZone, days = 0) {
  const p = zonedParts(date, timeZone);
  return zonedTime({ year: p.year, month: p.month, day: p.day + days }, timeZone);
}

/**
 * `HH:MM` of an instant in a time zone.
 * @param {Date | number} date
 * @param {string} timeZone
 */
export function formatClock(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

/**
 * `YYYY-MM-DD` of an instant in a time zone.
 * @param {Date | number} date
 * @param {string} timeZone
 */
export function formatDay(date, timeZone) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
