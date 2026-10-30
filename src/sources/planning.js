// -----------------------------------------------------------------------------
// The duty rota ("tableau des gardes").
//
// There is no national feed of the pharmacies on duty: the rota is drawn up per
// sector by the pharmacists' union and published by the town hall, the local
// paper or the pharmacies themselves. The user copies it here, or points to a
// file published online (open data portals, a town web site) — both read the
// same formats:
//
//   one line per turn, fields separated by `;`
//     2026-11-01 ; Pharmacie du Centre ; 12 rue de la Paix, Lyon ; 04 78 00 00 00
//     2026-11-07 19:00 > 2026-11-14 09:00 ; Pharmacie des Halles ; … ; …
//     01/11/2026 ; Pharmacie du Centre
//   lines separated by a new line or by `|` (a single-line field cannot hold a
//   new line), `#` starts a comment line;
//
//   or JSON: an array of { start, end?, name, address?, phone?, latitude?,
//   longitude? } (or `date` for a whole day; French keys debut/fin/nom/adresse/
//   telephone are read too), possibly wrapped in { entries | records | results }.
//
// A date alone is the whole day; a start time without an end lasts 24 hours;
// an end date alone ends at the end of that day. Every time is read in the time
// zone of the configuration.
// -----------------------------------------------------------------------------

import { startOfDay, zonedTime } from '../time.js';

const HOUR_MS = 60 * 60 * 1000;

/** Above this many turns the rota is refused: it is a rota, not a database. */
export const MAX_ENTRIES = 2000;

// "2026-11-01", "2026-11-01 09:00", "2026-11-01T09:00", "01/11/2026 9h00"
const DATE_PATTERN =
  /^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})\/(\d{1,2})\/(\d{4}))(?:[ T]+(\d{1,2})(?:[:hH](\d{2})?)?)?(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Read one date of the rota.
 * @param {string} text
 * @param {string} timeZone
 * @returns {{ date: Date, hasTime: boolean } | null}
 */
export function parseRotaDate(text, timeZone) {
  const match = DATE_PATTERN.exec(String(text ?? '').trim());
  if (!match) return null;
  const year = Number(match[1] ?? match[6]);
  const month = Number(match[2] ?? match[5]);
  const day = Number(match[3] ?? match[4]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const hasTime = match[7] !== undefined;
  const hour = hasTime ? Number(match[7]) : 0;
  const minute = match[8] !== undefined ? Number(match[8]) : 0;
  if (hour > 24 || minute > 59) return null;
  if (match[9]) {
    // An explicit offset (ISO date from a JSON feed) wins over the time zone.
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${match[9].length === 5 ? `${match[9].slice(0, 3)}:${match[9].slice(3)}` : match[9]}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : { date, hasTime: true };
  }
  return { date: zonedTime({ year, month, day, hour, minute }, timeZone), hasTime };
}

function clean(value) {
  if (value === undefined || value === null) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

// Build one turn from its raw fields, or explain why it cannot be read.
function buildEntry(raw, timeZone) {
  const startText = clean(raw.start ?? raw.date);
  const endText = clean(raw.end);
  const name = clean(raw.name);
  if (!startText) return { error: 'missing start date' };
  if (!name) return { error: 'missing pharmacy name' };
  const start = parseRotaDate(startText, timeZone);
  if (!start) return { error: `unreadable date "${startText}"` };
  let end;
  if (endText) {
    const parsed = parseRotaDate(endText, timeZone);
    if (!parsed) return { error: `unreadable date "${endText}"` };
    // An end date alone ends at the end of that day.
    end = parsed.hasTime ? parsed.date : startOfDay(parsed.date, timeZone, 1);
  } else if (start.hasTime) {
    end = new Date(start.date.getTime() + 24 * HOUR_MS);
  } else {
    // The whole day, midnight to midnight, DST days included.
    end = startOfDay(start.date, timeZone, 1);
  }
  if (end.getTime() <= start.date.getTime()) return { error: 'the end is before the start' };
  return {
    entry: {
      start: start.date,
      end,
      name,
      address: clean(raw.address),
      phone: clean(raw.phone),
      latitude: toNumber(raw.latitude),
      longitude: toNumber(raw.longitude),
    },
  };
}

// One JSON item, whatever its spelling.
function fromJsonItem(item) {
  const pick = (...keys) => keys.map((key) => item?.[key]).find((value) => value != null);
  return {
    start: pick('start', 'debut', 'début', 'date_debut', 'from', 'date'),
    end: pick('end', 'fin', 'date_fin', 'to'),
    name: pick('name', 'nom', 'pharmacie', 'pharmacy', 'title'),
    address: pick('address', 'adresse', 'addr'),
    phone: pick('phone', 'telephone', 'téléphone', 'tel'),
    latitude: pick('latitude', 'lat'),
    longitude: pick('longitude', 'lon', 'lng'),
  };
}

function itemsOfJson(data) {
  if (Array.isArray(data)) return data;
  for (const key of ['entries', 'records', 'results', 'gardes', 'data']) {
    if (Array.isArray(data?.[key])) {
      // Opendatasoft wraps each record's values in `fields`.
      return data[key].map((item) => item?.fields ?? item);
    }
  }
  return null;
}

/**
 * Read a rota.
 * @param {string} text the rota, in one of the formats above
 * @param {string} timeZone
 * @returns {{ entries: object[], errors: { line: number, message: string }[] }}
 *   the turns sorted by start, and what could not be read (line numbers start at 1)
 */
export function parsePlanning(text, timeZone) {
  const entries = [];
  const errors = [];
  const source = String(text ?? '').trim();
  if (source === '') return { entries, errors };

  let raws;
  if (source.startsWith('[') || source.startsWith('{')) {
    let data;
    try {
      data = JSON.parse(source);
    } catch {
      return { entries, errors: [{ line: 0, message: 'invalid JSON' }] };
    }
    const items = itemsOfJson(data);
    if (!items) return { entries, errors: [{ line: 0, message: 'no list of turns in the JSON' }] };
    raws = items.map((item, index) => ({ line: index + 1, raw: fromJsonItem(item) }));
  } else {
    raws = source
      .split(/\r?\n|\|/)
      .map((line, index) => ({ line: index + 1, text: line.trim() }))
      .filter(({ text: line }) => line !== '' && !line.startsWith('#'))
      .map(({ line, text: lineText }) => {
        const [when = '', name, address, phone] = lineText.split(';').map((part) => part.trim());
        const [start, end] = when.split(/\s*(?:>|→)\s*/);
        return { line, raw: { start, end, name, address, phone } };
      });
  }

  for (const { line, raw } of raws) {
    if (entries.length >= MAX_ENTRIES) {
      errors.push({ line, message: `more than ${MAX_ENTRIES} turns, the rest is ignored` });
      break;
    }
    const { entry, error } = buildEntry(raw, timeZone);
    if (error) errors.push({ line, message: error });
    else entries.push(entry);
  }
  entries.sort((a, b) => a.start - b.start);
  return { entries, errors };
}

/**
 * The turns running at an instant, the most recently started first: when two
 * turns overlap (a weekly turn and a Sunday replacement), the shorter, later
 * one is the more specific.
 * @param {object[]} entries from parsePlanning
 * @param {Date | number} at
 */
export function entriesAt(entries, at) {
  const time = new Date(at).getTime();
  return entries
    .filter((entry) => entry.start.getTime() <= time && time < entry.end.getTime())
    .sort((a, b) => b.start - a.start);
}

/**
 * When the rota runs out: the end of its last turn, or null without any.
 * @param {object[]} entries
 */
export function planningEnd(entries) {
  if (entries.length === 0) return null;
  return new Date(Math.max(...entries.map((entry) => entry.end.getTime())));
}
