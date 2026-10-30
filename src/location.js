// -----------------------------------------------------------------------------
// Where the house is.
//
// The coordinates typed in the configuration win (a holiday home, a parent's
// place). Otherwise the house picked in the configuration, or the first house
// of Gladys that has a position: read through `getHouses()`, which the manifest
// unlocks with `"location": true` (shown to the user at install time — a home
// address is personal data). There is no update event for a house: index.js
// reads it again at every (re)connection and configuration save.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'location' });

/**
 * @param {object} gladys the SDK instance
 * @param {object} config normalized configuration
 * @returns {Promise<{ latitude: number, longitude: number, name: string, origin: 'config' | 'house' } | null>}
 */
export async function resolveLocation(gladys, config) {
  if (config.latitude !== null && config.longitude !== null) {
    return { latitude: config.latitude, longitude: config.longitude, name: '', origin: 'config' };
  }
  let houses;
  try {
    houses = await gladys.getHouses();
  } catch (err) {
    logger.warn(`Cannot read the houses of Gladys: ${err.message}`);
    return null;
  }
  const located = (houses ?? []).filter(
    (house) => typeof house.latitude === 'number' && typeof house.longitude === 'number',
  );
  const chosen =
    (config.house && located.find((house) => house.selector === config.house)) || located[0];
  if (!chosen) return null;
  return {
    latitude: chosen.latitude,
    longitude: chosen.longitude,
    name: chosen.name ?? '',
    origin: 'house',
  };
}
