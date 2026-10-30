// -----------------------------------------------------------------------------
// The answer to "which pharmacy, right now?".
//
// Three sources, each with its transport:
//   - the rota typed in the configuration (`planning`)        -> local
//   - a rota published online (`planning_url`)                 -> cloud
//   - the pharmacies open around the house (OpenStreetMap)     -> cloud
//
// The pharmacy on DUTY comes from a rota. When both rotas name one, the
// "Prefer the local connection" toggle of Gladys picks the typed one (default)
// or the published one. Without any rota for that moment, the nearest pharmacy
// OPEN according to OpenStreetMap is offered instead — flagged as such
// (`source: 'osm'`, degraded badge): it is open, not on duty, and at night the
// official finder (3237 in France) remains the reference.
//
// Network calls only happen in `refresh()`; every other method computes from
// what is in memory, so the minute tick, the widget and the scene actions cost
// nothing.
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { distanceKm, fetchPharmacies } from './sources/osm.js';
import { openingStatus, parseOpeningHours } from './sources/openingHours.js';
import { entriesAt, parsePlanning, planningEnd } from './sources/planning.js';
import { fetchPlanningText } from './sources/remote.js';
import { startOfDay, zonedParts, zonedTime } from './time.js';

const logger = createLogger({ name: 'pharmacies' });

const HOUR_MS = 60 * 60 * 1000;

/** Where an answer comes from. Stored in scenes as a variable: never renamed. */
export const SOURCES = { PLANNING: 'planning', REMOTE: 'remote', OSM: 'osm' };

/** The moments a scene can ask about. Stored in scenes: never renamed. */
export const MOMENTS = ['now', 'tonight', 'tomorrow', 'next_sunday'];

/**
 * The instant a moment stands for: tonight is 21:00 (now when later), tomorrow
 * and next Sunday are at 10:00, when every rota and every Sunday opening runs.
 * @param {string} moment one of MOMENTS
 * @param {number} now
 * @param {string} timeZone
 */
export function momentInstant(moment, now, timeZone) {
  const today = zonedParts(now, timeZone);
  const at = (days, hour) =>
    zonedTime({ year: today.year, month: today.month, day: today.day + days, hour }, timeZone);
  switch (moment) {
    case 'tonight': {
      const tonight = at(0, 21);
      return tonight.getTime() > now ? tonight : new Date(now);
    }
    case 'tomorrow':
      return at(1, 10);
    case 'next_sunday': {
      const days = (6 - today.weekday + 7) % 7;
      const sunday = at(days, 10);
      return sunday.getTime() > now ? sunday : at(days + 7, 10);
    }
    default:
      return new Date(now);
  }
}

/**
 * A link to a point on the OpenStreetMap web site (https: the widget accepts
 * no other scheme).
 */
export function mapUrl(latitude, longitude) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return '';
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
}

// "Pharmacie du Centre" and "PHARMACIE DU CENTRE " are the same pharmacy.
function normalizeName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(pharmacie|pharmacy|apotheke|farmacia|de|du|des|la|le|les|der|die|das)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function osmKey(config, location) {
  if (!location) return null;
  return [
    location.latitude.toFixed(4),
    location.longitude.toFixed(4),
    config.radius_km,
    config.overpass_url,
  ].join('|');
}

export class PharmacyService {
  /**
   * @param {object} [options]
   * @param {typeof fetch} [options.fetchImpl]
   * @param {ReturnType<import('./store.js').createStore>} [options.store]
   * @param {() => number} [options.now]
   */
  constructor({ fetchImpl = fetch, store = null, now = () => Date.now() } = {}) {
    this.fetchImpl = fetchImpl;
    this.store = store;
    this.now = now;
    this.config = null;
    this.location = null;
    this.local = { entries: [], errors: [] };
    this.remote = { url: '', entries: [], errors: [], fetchedAt: null, error: null };
    this.osm = { key: null, pharmacies: [], fetchedAt: null, error: null };
  }

  /** Read back the caches of the store (after a restart). */
  restore() {
    const remote = this.store?.get('remote');
    if (remote?.url && typeof remote.text === 'string') {
      this.remote = {
        ...this.remote,
        url: remote.url,
        text: remote.text,
        fetchedAt: remote.fetchedAt,
      };
    }
    const osm = this.store?.get('osm');
    if (osm?.key && Array.isArray(osm.pharmacies)) {
      this.osm = {
        key: osm.key,
        fetchedAt: osm.fetchedAt,
        error: null,
        pharmacies: osm.pharmacies.map((pharmacy) => ({
          ...pharmacy,
          hours: parseOpeningHours(pharmacy.openingHours),
        })),
      };
    }
  }

  /**
   * Take a new configuration and house location. Cheap: no network.
   * @param {object} config normalized configuration
   * @param {{ latitude: number, longitude: number, name?: string, origin: string } | null} location
   */
  configure(config, location) {
    this.config = config;
    this.location = location;
    this.local = parsePlanning(config.planning, config.timezone);
    if (this.remote.url !== config.planning_url) {
      this.remote = {
        url: config.planning_url,
        entries: [],
        errors: [],
        fetchedAt: null,
        error: null,
      };
    } else if (typeof this.remote.text === 'string') {
      // The time zone may have changed: read the kept copy again.
      const parsed = parsePlanning(this.remote.text, config.timezone);
      this.remote = { ...this.remote, ...parsed };
    }
    const key = osmKey(config, location);
    if (key !== this.osm.key) {
      this.osm = { key, pharmacies: [], fetchedAt: null, error: null };
    } else if (location) {
      // Same place: only the distances could have moved with the coordinates' rounding.
      for (const pharmacy of this.osm.pharmacies) {
        pharmacy.distanceKm = distanceKm(
          location.latitude,
          location.longitude,
          pharmacy.latitude,
          pharmacy.longitude,
        );
      }
    }
  }

  /** Whether the OpenStreetMap source is wanted and can be asked. */
  osmEnabled() {
    return Boolean(this.config?.use_openstreetmap && this.location);
  }

  /**
   * Fetch what is stale (or everything with `force`). Never throws: a failure is
   * kept in `error` next to the last good copy.
   * @param {{ force?: boolean }} [options]
   */
  async refresh({ force = false } = {}) {
    if (!this.config) return;
    const maxAge = this.config.refresh_hours * HOUR_MS;
    const now = this.now();
    const stale = (fetchedAt) => force || !fetchedAt || now - fetchedAt >= maxAge;

    if (this.remote.url && stale(this.remote.fetchedAt)) {
      try {
        const text = await fetchPlanningText(this.remote.url, this.fetchImpl);
        const parsed = parsePlanning(text, this.config.timezone);
        this.remote = { ...this.remote, ...parsed, text, fetchedAt: now, error: null };
        logger.info(`Published rota read: ${parsed.entries.length} turns`);
        await this.store?.set('remote', { url: this.remote.url, text, fetchedAt: now });
      } catch (err) {
        this.remote = { ...this.remote, error: err.message, fetchedAt: this.remote.fetchedAt };
        logger.warn(`Published rota unreachable: ${err.message}`);
      }
    }

    if (this.osmEnabled() && stale(this.osm.fetchedAt)) {
      try {
        const pharmacies = await fetchPharmacies(
          {
            latitude: this.location.latitude,
            longitude: this.location.longitude,
            radiusKm: this.config.radius_km,
            overpassUrl: this.config.overpass_url,
          },
          this.fetchImpl,
        );
        this.osm = { key: this.osm.key, pharmacies, fetchedAt: now, error: null };
        logger.info(
          `OpenStreetMap: ${pharmacies.length} pharmacies within ${this.config.radius_km} km`,
        );
        await this.store?.set('osm', {
          key: this.osm.key,
          fetchedAt: now,
          pharmacies: pharmacies.map(({ hours: _hours, ...rest }) => rest),
        });
      } catch (err) {
        this.osm = { ...this.osm, error: err.message };
        logger.warn(`OpenStreetMap unreachable: ${err.message}`);
      }
    }
  }

  // The OSM pharmacy a rota turn names, for its position and phone.
  matchOsm(entry) {
    const name = normalizeName(entry.name);
    if (!name) return null;
    return (
      this.osm.pharmacies.find((pharmacy) => normalizeName(pharmacy.name) === name) ??
      this.osm.pharmacies.find((pharmacy) => {
        const other = normalizeName(pharmacy.name);
        return other.length >= 4 && (other.includes(name) || name.includes(other));
      }) ??
      null
    );
  }

  // A rota turn, completed with what OpenStreetMap knows of the same pharmacy.
  decorate(entry, source) {
    const match = this.matchOsm(entry);
    const latitude = entry.latitude ?? match?.latitude ?? null;
    const longitude = entry.longitude ?? match?.longitude ?? null;
    const distance =
      this.location && latitude !== null && longitude !== null
        ? distanceKm(this.location.latitude, this.location.longitude, latitude, longitude)
        : null;
    return {
      source,
      name: entry.name,
      address: entry.address || match?.address || '',
      phone: entry.phone || match?.phone || '',
      latitude,
      longitude,
      distanceKm: distance,
      until: entry.end,
      mapUrl: mapUrl(latitude, longitude),
    };
  }

  /**
   * The pharmacies of OpenStreetMap with their status at an instant, nearest first.
   * @param {Date | number} at
   */
  pharmaciesAt(at) {
    const parts = zonedParts(at, this.config.timezone);
    const time = new Date(at).getTime();
    return this.osm.pharmacies.map((pharmacy) => {
      const { open, minutesLeft } = openingStatus(pharmacy.hours, parts);
      return {
        ...pharmacy,
        open,
        until: minutesLeft === null ? null : new Date(time + minutesLeft * 60 * 1000),
        mapUrl: mapUrl(pharmacy.latitude, pharmacy.longitude),
      };
    });
  }

  /**
   * Everything known for an instant.
   * @param {Date | number} [at]
   * @returns {{ at: Date, duty: object | null, recommended: object | null, pharmacies: object[], open: object[] }}
   */
  lookup(at = this.now()) {
    const instant = new Date(at);
    const rotas = [
      { source: SOURCES.PLANNING, entries: this.local.entries },
      { source: SOURCES.REMOTE, entries: this.remote.entries },
    ];
    if (this.config && !this.config.GLADYS_PREFER_LOCAL) rotas.reverse();
    let duty = null;
    for (const { source, entries } of rotas) {
      const [entry] = entriesAt(entries, instant);
      if (entry) {
        duty = this.decorate(entry, source);
        break;
      }
    }
    const pharmacies = this.config ? this.pharmaciesAt(instant) : [];
    const open = pharmacies.filter((pharmacy) => pharmacy.open === true);
    let recommended = duty;
    if (!recommended && open.length > 0) {
      const [nearest] = open;
      recommended = {
        source: SOURCES.OSM,
        name: nearest.name,
        address: nearest.address,
        phone: nearest.phone,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        distanceKm: nearest.distanceKm,
        until: nearest.until,
        mapUrl: nearest.mapUrl,
      };
    }
    return { at: instant, duty, recommended, pharmacies, open };
  }

  /** Whether a rota is configured at all (typed or published). */
  hasPlanning() {
    return Boolean(this.config?.planning.trim() || this.config?.planning_url);
  }

  /** When the rotas in use run out (the later of the two), or null. */
  planningEnd() {
    const ends = [planningEnd(this.local.entries), planningEnd(this.remote.entries)].filter(
      Boolean,
    );
    if (ends.length === 0) return null;
    return new Date(Math.max(...ends.map((end) => end.getTime())));
  }

  /**
   * Whole days left before the rota runs out, counted from the start of today.
   * Null without a rota; 0 when it already ran out.
   */
  planningDaysLeft(now = this.now()) {
    if (!this.hasPlanning()) return null;
    const end = this.planningEnd();
    if (!end) return 0;
    const today = startOfDay(now, this.config.timezone).getTime();
    return Math.max(0, Math.floor((end.getTime() - today) / (24 * HOUR_MS)) - 1);
  }

  /**
   * The transport badge of the device: where the current answer comes from.
   * @param {ReturnType<PharmacyService['lookup']>} [result]
   */
  transport(result = this.lookup()) {
    const source = result.recommended?.source;
    if (source === SOURCES.PLANNING) return { transport: DEVICE_TRANSPORTS.LOCAL };
    if (source === SOURCES.REMOTE) return { transport: DEVICE_TRANSPORTS.CLOUD };
    if (source === SOURCES.OSM) {
      return {
        transport: DEVICE_TRANSPORTS.CLOUD,
        degraded: true,
        message: {
          en: 'No duty rota for now: nearest open pharmacy (OpenStreetMap).',
          fr: 'Aucune garde connue : pharmacie ouverte la plus proche (OpenStreetMap).',
          de: 'Kein Notdienstplan für jetzt: nächste geöffnete Apotheke (OpenStreetMap).',
          es: 'Sin turno de guardia conocido: farmacia abierta más cercana (OpenStreetMap).',
        },
      };
    }
    const failed = (this.osmEnabled() && this.osm.error) || (this.remote.url && this.remote.error);
    if (failed) return { transport: DEVICE_TRANSPORTS.UNREACHABLE };
    return {
      transport:
        this.osmEnabled() || this.remote.url ? DEVICE_TRANSPORTS.CLOUD : DEVICE_TRANSPORTS.LOCAL,
    };
  }
}
