// -----------------------------------------------------------------------------
// The pharmacies around the house, from OpenStreetMap (Overpass API).
//
// OpenStreetMap knows where the pharmacies are and, for most of them, their
// opening hours — not the duty rota, which no map carries. It answers "which
// pharmacy is open right now near me", the fallback when no rota is known and
// the list the widget shows.
//
// The list itself changes rarely: it is fetched every `refresh_hours` (a day by
// default) and kept in /data, and the open/closed status is computed locally
// every minute from the opening hours. The public Overpass servers are a shared
// resource: one small query a day per house is the polite pace.
// -----------------------------------------------------------------------------

import { parseOpeningHours } from './openingHours.js';

export const DEFAULT_OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

const USER_AGENT = 'gladys-pharmaciesgarde (+https://github.com/prohand/gladys-pharmaciesgarde)';

/** The answer is refused above this size: a few km of pharmacies weigh a few KB. */
const MAX_BYTES = 5 * 1024 * 1024;

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two points, in km.
 */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * The Overpass QL query of the pharmacies within `radiusKm` of a point. The
 * point is rounded to about 100 m: the server needs the neighbourhood, not the
 * front door (the distances are computed locally, from the exact position).
 */
export function buildQuery({ latitude, longitude, radiusKm }) {
  const lat = Number(latitude.toFixed(3));
  const lon = Number(longitude.toFixed(3));
  const around = `around:${Math.round(radiusKm * 1000)},${lat},${lon}`;
  return (
    `[out:json][timeout:25];` +
    `(nwr["amenity"="pharmacy"](${around});nwr["healthcare"="pharmacy"](${around}););` +
    `out center tags;`
  );
}

function addressOf(tags) {
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  return [street, city].filter(Boolean).join(', ');
}

/**
 * Turn an Overpass answer into pharmacies, nearest first.
 * @param {object} body the Overpass JSON
 * @param {{ latitude: number, longitude: number }} origin
 */
export function parseOverpass(body, origin) {
  const seen = new Set();
  const pharmacies = [];
  for (const element of body?.elements ?? []) {
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    const id = `${element.type}-${element.id}`;
    // A pharmacy tagged both amenity= and healthcare= comes back once per union branch.
    if (seen.has(id)) continue;
    seen.add(id);
    const openingHours = tags.opening_hours ?? '';
    pharmacies.push({
      id,
      name: tags.name ?? tags.brand ?? tags.operator ?? '',
      address: addressOf(tags),
      phone: tags.phone ?? tags['contact:phone'] ?? '',
      latitude,
      longitude,
      openingHours,
      hours: parseOpeningHours(openingHours),
      distanceKm: distanceKm(origin.latitude, origin.longitude, latitude, longitude),
    });
  }
  return pharmacies.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * Fetch the pharmacies around a point.
 * @param {{ latitude: number, longitude: number, radiusKm: number, overpassUrl?: string }} options
 * @param {typeof fetch} [fetchImpl]
 */
export async function fetchPharmacies(options, fetchImpl = fetch) {
  const url = options.overpassUrl || DEFAULT_OVERPASS_URL;
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': USER_AGENT,
      accept: 'application/json',
    },
    body: new URLSearchParams({ data: buildQuery(options) }).toString(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Overpass HTTP ${response.status}`);
  }
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error('Overpass answer too large');
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('Overpass answer is not JSON');
  }
  return parseOverpass(body, options);
}
