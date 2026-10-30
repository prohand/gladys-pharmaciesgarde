// -----------------------------------------------------------------------------
// OpenStreetMap `opening_hours`, the common subset.
//
// The full grammar (months, week numbers, Easter, public holidays…) is a
// language of its own. Pharmacies mostly write the plain weekly form:
//
//   Mo-Fr 08:30-12:30,14:00-19:30; Sa 09:00-12:00; Su off
//   24/7
//   Mo-Su 20:00-02:00              (open past midnight)
//
// That form is read exactly. Anything else makes the whole value UNKNOWN
// (`null`) rather than half-read: a pharmacy shown open when it is closed is
// the one mistake this integration must not make. Rules about public or school
// holidays alone (`PH off`, `SH 10:00-12:00`) are skipped, since nothing here
// knows the holidays: on a holiday the weekly rule is a guess, said as such in
// the documentation.
// -----------------------------------------------------------------------------

const DAY_NAMES = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MINUTES_PER_DAY = 24 * 60;

function parseTime(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 48 || minutes > 59) return null;
  return hours * 60 + minutes;
}

// "08:30-12:30,14:00-19:30" -> [[510, 750], [840, 1170]]. An end before its
// start runs past midnight; an end above 24:00 says so explicitly.
function parseRanges(text) {
  const ranges = [];
  for (const part of text.split(',')) {
    const [from, to, extra] = part.trim().split('-');
    if (extra !== undefined || to === undefined) return null;
    const start = parseTime(from.trim());
    let end = parseTime(to.trim());
    if (start === null || end === null || start >= MINUTES_PER_DAY) return null;
    if (end <= start) end += MINUTES_PER_DAY;
    if (end - start > MINUTES_PER_DAY) return null;
    ranges.push([start, end]);
  }
  return ranges;
}

// "Mo-Fr,Su" -> [0, 1, 2, 3, 4, 6]; "PH" alone -> 'holidays'; unknown -> null.
function parseDays(text) {
  const days = new Set();
  let holidaysOnly = true;
  for (const item of text.split(',')) {
    const token = item.trim();
    if (token === 'PH' || token === 'SH') continue;
    holidaysOnly = false;
    const [from, to, extra] = token.split('-');
    const start = DAY_NAMES.indexOf(from);
    if (start === -1 || extra !== undefined) return null;
    if (to === undefined) {
      days.add(start);
      continue;
    }
    const end = DAY_NAMES.indexOf(to);
    if (end === -1) return null;
    // Fr-Mo wraps over the weekend.
    for (let day = start; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === end) break;
    }
  }
  return holidaysOnly ? 'holidays' : [...days];
}

/**
 * Read an `opening_hours` value.
 * @param {string} value the raw OSM tag
 * @returns {{ always: boolean, week: number[][][] } | null} the opening ranges
 *   of each weekday (minutes from local midnight, Monday first), or `null`
 *   when the value is outside the supported subset
 */
export function parseOpeningHours(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const text = value.trim();
  if (text === '24/7') return { always: true, week: DAY_NAMES.map(() => [[0, MINUTES_PER_DAY]]) };

  const week = DAY_NAMES.map(() => []);
  let ruleCount = 0;
  for (const raw of text.split(/;|\|\|/)) {
    const rule = raw.trim();
    if (rule === '') continue;
    const match = /^(?:([A-Za-z]{2}(?:\s*[-,]\s*[A-Za-z]{2})*)\s+)?(.+)$/.exec(rule);
    if (!match) return null;
    const [, dayText, timeText] = match;
    let days = DAY_NAMES.map((_, index) => index);
    if (dayText !== undefined) {
      const parsed = parseDays(dayText.replace(/\s+/g, ''));
      if (parsed === null) return null;
      if (parsed === 'holidays') continue;
      days = parsed;
    } else if (/^(?:PH|SH)$/.test(timeText.trim())) {
      return null;
    }
    const spec = timeText.trim();
    let ranges;
    if (spec === 'off' || spec === 'closed') {
      ranges = [];
    } else if (spec === '24/7' || spec === '00:00-24:00') {
      ranges = [[0, MINUTES_PER_DAY]];
    } else {
      ranges = parseRanges(spec);
      if (ranges === null) return null;
    }
    // A later rule replaces the earlier ones for the days it names, as OSM
    // reads it ("Mo-Sa 09:00-19:00; Sa 09:00-12:00").
    for (const day of days) week[day] = ranges;
    ruleCount += 1;
  }
  if (ruleCount === 0) return null;
  return { always: false, week };
}

/**
 * Whether a pharmacy is open at a local time, and until when.
 * @param {{ always: boolean, week: number[][][] } | null} hours from parseOpeningHours
 * @param {{ weekday: number, hour: number, minute: number }} local wall-clock parts
 * @returns {{ open: boolean | null, minutesLeft: number | null }} `open` is null
 *   when the hours are unknown; `minutesLeft` until closing when open (null for 24/7)
 */
export function openingStatus(hours, { weekday, hour, minute }) {
  if (!hours) return { open: null, minutesLeft: null };
  if (hours.always) return { open: true, minutesLeft: null };
  const now = hour * 60 + minute;
  const today = hours.week[weekday] ?? [];
  const yesterday = hours.week[(weekday + 6) % 7] ?? [];
  const candidates = [
    ...today.map(([start, end]) => [start, end]),
    // Yesterday's ranges that run past midnight, moved onto today.
    ...yesterday
      .filter(([, end]) => end > MINUTES_PER_DAY)
      .map(([start, end]) => [start - MINUTES_PER_DAY, end - MINUTES_PER_DAY]),
  ];
  const range = candidates.find(([start, end]) => start <= now && now < end);
  if (!range) return { open: false, minutesLeft: null };
  return { open: true, minutesLeft: range[1] - now };
}
