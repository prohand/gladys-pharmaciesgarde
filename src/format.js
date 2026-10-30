// -----------------------------------------------------------------------------
// Short texts shared by the widget, the scenes and the actions, in the four
// languages of the Gladys interface (see i18n.js).
// -----------------------------------------------------------------------------

import { pick } from './i18n.js';
import { SOURCES } from './pharmacies.js';
import { formatClock, formatDay, zonedParts } from './time.js';

/** How a source reads, per language. */
export const SOURCE_LABELS = {
  [SOURCES.PLANNING]: { en: 'Rota', fr: 'Tableau de garde', de: 'Notdienstplan', es: 'Turnos' },
  [SOURCES.REMOTE]: {
    en: 'Published rota',
    fr: 'Tableau en ligne',
    de: 'Online-Plan',
    es: 'Turnos en línea',
  },
  [SOURCES.OSM]: {
    en: 'Open (OpenStreetMap)',
    fr: 'Ouverte (OpenStreetMap)',
    de: 'Geöffnet (OSM)',
    es: 'Abierta (OSM)',
  },
};

const WEEKDAYS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  fr: ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'],
  de: ['Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.', 'So.'],
  es: ['lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.', 'dom.'],
};

/**
 * A local time for a person: "19:30" today, "Sun 09:00" within the week,
 * "2026-11-14 09:00" further.
 * @param {Date | null} date
 * @param {number} now
 * @param {string} timeZone
 * @param {string} language
 */
export function formatWhen(date, now, timeZone, language) {
  if (!date) return '';
  const clock = formatClock(date, timeZone);
  if (formatDay(date, timeZone) === formatDay(now, timeZone)) return clock;
  if (date.getTime() - now < 6 * 24 * 60 * 60 * 1000 && date.getTime() > now) {
    return `${pick(language, WEEKDAYS)[zonedParts(date, timeZone).weekday]} ${clock}`;
  }
  return `${formatDay(date, timeZone)} ${clock}`;
}

/**
 * The machine-friendly local time of the scene variables: "2026-11-14 09:00".
 */
export function formatLocal(date, timeZone) {
  if (!date) return '';
  return `${formatDay(date, timeZone)} ${formatClock(date, timeZone)}`;
}

/** "1.2 km" / "800 m". */
export function formatDistance(km) {
  if (typeof km !== 'number') return '';
  if (km < 1) return `${Math.round(km * 100) * 10} m`;
  return `${km.toFixed(1)} km`;
}

/** Cut a text to a widget limit, with an ellipsis. */
export function fit(text, max) {
  const value = String(text ?? '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
