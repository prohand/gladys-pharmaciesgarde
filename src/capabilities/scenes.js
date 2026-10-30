// -----------------------------------------------------------------------------
// Scene triggers and scene actions (Gladys 5.1+).
//
// Triggers — what HAPPENED, fired by the minute tick of index.js:
//   - duty_changed           the recommended pharmacy changed (a new turn of the
//                            rota, or the nearest open one closing)
//   - no_pharmacy_available  nothing on duty and nothing open around the house
//   - planning_running_out   the rota ends within `planning_warning_days`: time
//                            to paste the next one (once a day)
//
// Actions — operations a scene runs:
//   - get_pharmacy           which pharmacy now / tonight / tomorrow / next
//                            Sunday, as outputs for a message or a condition
//   - refresh_pharmacies     fetch the published rota and OpenStreetMap again
//
// Keys, fields, variables and outputs are stored in the users' scenes: never
// renamed (see the manifest).
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { formatLocal } from '../format.js';
import { MOMENTS, momentInstant } from '../pharmacies.js';
import { formatDay } from '../time.js';

const logger = createLogger({ name: 'scenes' });

/** Trigger keys, as declared in the manifest `scene_triggers`. */
export const SCENE_TRIGGERS = {
  DUTY_CHANGED: 'duty_changed',
  NO_PHARMACY_AVAILABLE: 'no_pharmacy_available',
  PLANNING_RUNNING_OUT: 'planning_running_out',
};

/** Action keys, as declared in the manifest `scene_actions`. */
export const SCENE_ACTIONS = {
  GET_PHARMACY: 'get_pharmacy',
  REFRESH_PHARMACIES: 'refresh_pharmacies',
};

function round(value) {
  return Math.round(value * 10) / 10;
}

/**
 * The flat event data / outputs describing one pharmacy. A distance nobody
 * knows is left out (the core reads a declared key absent from the data as null).
 */
export function describePharmacy(pharmacy, timeZone) {
  const data = {
    source: pharmacy.source,
    name: pharmacy.name,
    address: pharmacy.address,
    phone: pharmacy.phone,
    until: formatLocal(pharmacy.until, timeZone),
    map_url: pharmacy.mapUrl,
  };
  if (typeof pharmacy.distanceKm === 'number') data.distance_km = round(pharmacy.distanceKm);
  return data;
}

// What makes two answers "the same pharmacy": its source and its name. Two
// consecutive turns of the same pharmacy are not a change.
function answerKey(recommended) {
  return recommended ? `${recommended.source}|${recommended.name}` : '';
}

/**
 * The scene triggers: compare each lookup with the previous one and fire what
 * changed. The last answer is kept in the store, so a restart does not fire
 * the same change again; the very first lookup only records it.
 *
 * @param {object} options
 * @param {object} options.gladys the SDK instance
 * @param {ReturnType<import('../store.js').createStore>} options.store
 */
export function createTriggerWatcher({ gladys, store }) {
  return async function check(service, result, now) {
    const memory = store.get('triggers') ?? {};
    const timeZone = service.config.timezone;
    const key = answerKey(result.recommended);
    const fired = [];

    if (memory.answer !== undefined && memory.answer !== key) {
      if (result.recommended) {
        await gladys.publishSceneEvent(
          SCENE_TRIGGERS.DUTY_CHANGED,
          describePharmacy(result.recommended, timeZone),
        );
        fired.push(SCENE_TRIGGERS.DUTY_CHANGED);
      } else {
        await gladys.publishSceneEvent(SCENE_TRIGGERS.NO_PHARMACY_AVAILABLE, {});
        fired.push(SCENE_TRIGGERS.NO_PHARMACY_AVAILABLE);
      }
    }

    const today = formatDay(now, timeZone);
    const daysLeft = service.planningDaysLeft(now);
    let warned = memory.warned;
    if (
      daysLeft !== null &&
      service.config.planning_warning_days > 0 &&
      daysLeft <= service.config.planning_warning_days &&
      memory.warned !== today
    ) {
      const end = service.planningEnd();
      await gladys.publishSceneEvent(SCENE_TRIGGERS.PLANNING_RUNNING_OUT, {
        days_left: daysLeft,
        last_day: end ? formatDay(new Date(end.getTime() - 1), timeZone) : '',
      });
      fired.push(SCENE_TRIGGERS.PLANNING_RUNNING_OUT);
      warned = today;
    }

    if (memory.answer !== key || memory.warned !== warned) {
      await store.set('triggers', { answer: key, warned });
    }
    if (fired.length > 0) logger.info(`Scene triggers fired: ${fired.join(', ')}`);
    return fired;
  };
}

/**
 * The scene action handlers, keyed by manifest key.
 * @param {import('../pharmacies.js').PharmacyService} service
 */
export function buildSceneActions(service) {
  return {
    async [SCENE_ACTIONS.GET_PHARMACY](fields) {
      const moment = MOMENTS.includes(fields.moment) ? fields.moment : 'now';
      const at = momentInstant(moment, service.now(), service.config.timezone);
      const { recommended } = service.lookup(at);
      logger.info(`Scene action get_pharmacy (${moment}) -> ${recommended?.name ?? 'none'}`);
      if (!recommended) return { found: false };
      return { found: true, ...describePharmacy(recommended, service.config.timezone) };
    },

    async [SCENE_ACTIONS.REFRESH_PHARMACIES]() {
      await service.refresh({ force: true });
      const result = service.lookup();
      return { found: Boolean(result.recommended), open_count: result.open.length };
    },
  };
}
