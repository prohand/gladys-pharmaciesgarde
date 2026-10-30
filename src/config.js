// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user from the `config_schema` of the manifest; the SDK
// fetches it (`gladys.getConfig()`) and notifies every change
// (`gladys.onConfigUpdated()`). This module only applies the defaults and
// normalizes the types, so the rest of the code never handles `undefined` or a
// number typed as a string.
// -----------------------------------------------------------------------------

import { isValidTimeZone } from './time.js';

/** Countries whose official duty-pharmacy finder the widget links to. */
export const COUNTRIES = ['fr', 'de', 'es', 'other'];

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  house: '',
  latitude: null,
  longitude: null,
  radius_km: 5,
  use_openstreetmap: true,
  planning: '',
  planning_url: '',
  country: 'fr',
  timezone: 'Europe/Paris',
  refresh_hours: 24,
  planning_warning_days: 7,
  overpass_url: '',
  // Reserved key (NOT in config_schema): the manifest declares both 'local'
  // and 'cloud' in `transports`, so Gladys shows a standard "Prefer the local
  // connection" toggle and sends the choice here. Read-only, defaults to true.
  GLADYS_PREFER_LOCAL: true,
};

function clampNumber(value, fallback, min, max) {
  const number = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

function optionalCoordinate(value, limit) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : null;
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Merge the user config with the defaults.
 * @param {Record<string, unknown>} raw config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const timezone = text(raw.timezone);
  const country = text(raw.country).toLowerCase();
  return {
    ...DEFAULT_CONFIG,
    house: text(raw.house),
    latitude: optionalCoordinate(raw.latitude, 90),
    longitude: optionalCoordinate(raw.longitude, 180),
    radius_km: clampNumber(raw.radius_km, DEFAULT_CONFIG.radius_km, 1, 30),
    use_openstreetmap: raw.use_openstreetmap !== false,
    // The rota keeps its line breaks: they separate the turns.
    planning: typeof raw.planning === 'string' ? raw.planning : '',
    planning_url: text(raw.planning_url),
    country: COUNTRIES.includes(country) ? country : DEFAULT_CONFIG.country,
    timezone: isValidTimeZone(timezone) ? timezone : DEFAULT_CONFIG.timezone,
    refresh_hours: clampNumber(raw.refresh_hours, DEFAULT_CONFIG.refresh_hours, 1, 168),
    planning_warning_days: clampNumber(
      raw.planning_warning_days,
      DEFAULT_CONFIG.planning_warning_days,
      0,
      60,
    ),
    overpass_url: text(raw.overpass_url),
    GLADYS_PREFER_LOCAL: raw.GLADYS_PREFER_LOCAL !== false,
  };
}
