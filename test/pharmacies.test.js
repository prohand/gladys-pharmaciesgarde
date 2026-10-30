import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { mapUrl, momentInstant, PharmacyService, SOURCES } from '../src/pharmacies.js';
import { DEFAULT_OVERPASS_URL } from '../src/sources/osm.js';
import { createStore } from '../src/store.js';
import { fakeFetch, HOME, OVERPASS_ANSWER, SUNDAY_11H } from './helpers/fixtures.js';

const LOCATION = { ...HOME, name: 'Maison', origin: 'house' };

async function serviceWith(config, { routes = {}, location = LOCATION, now = SUNDAY_11H } = {}) {
  const fetchImpl = fakeFetch({ [DEFAULT_OVERPASS_URL]: OVERPASS_ANSWER, ...routes });
  const store = createStore(null);
  const service = new PharmacyService({ fetchImpl, store, now: () => now });
  service.configure(normalizeConfig(config), location);
  await service.refresh();
  return { service, fetchImpl, store };
}

test('moments: tonight, tomorrow and next Sunday in local time', () => {
  const tz = 'Europe/Paris';
  assert.equal(momentInstant('now', SUNDAY_11H, tz).getTime(), SUNDAY_11H);
  assert.equal(momentInstant('tonight', SUNDAY_11H, tz).toISOString(), '2026-11-01T20:00:00.000Z');
  assert.equal(momentInstant('tomorrow', SUNDAY_11H, tz).toISOString(), '2026-11-02T09:00:00.000Z');
  // Sunday 11:00 is past Sunday 10:00: the next Sunday is a week later.
  assert.equal(
    momentInstant('next_sunday', SUNDAY_11H, tz).toISOString(),
    '2026-11-08T09:00:00.000Z',
  );
  const late = Date.parse('2026-11-01T21:30:00Z');
  assert.equal(momentInstant('tonight', late, tz).getTime(), late);
});

test('the typed rota gives the pharmacy on duty, completed by OpenStreetMap', async () => {
  const { service } = await serviceWith({ planning: '2026-11-01 ; PHARMACIE DU CENTRE' });
  const { duty, recommended } = service.lookup();
  assert.equal(duty.source, SOURCES.PLANNING);
  assert.equal(recommended, duty);
  assert.equal(duty.phone, '+33 4 78 00 00 01', 'phone taken from OpenStreetMap');
  assert.ok(duty.distanceKm < 0.2);
  assert.equal(duty.mapUrl, mapUrl(45.765, 4.836));
  assert.equal(duty.until.toISOString(), '2026-11-01T23:00:00.000Z');
  assert.deepEqual(service.transport(), { transport: 'local' });
});

test('without a rota, the nearest OPEN pharmacy is offered, flagged degraded', async () => {
  // Sunday: the Centre is closed (Mo-Sa), the Halles are open (Mo-Su).
  const { service } = await serviceWith({});
  const result = service.lookup();
  assert.equal(result.duty, null);
  assert.equal(result.recommended.source, SOURCES.OSM);
  assert.equal(result.recommended.name, 'Pharmacie des Halles');
  assert.equal(result.open.length, 1);
  assert.equal(result.recommended.until.toISOString(), '2026-11-01T19:00:00.000Z');
  const transport = service.transport(result);
  assert.equal(transport.transport, 'cloud');
  assert.equal(transport.degraded, true);
  assert.ok(transport.message.fr);
});

test('"Prefer the local connection" picks between the typed and the published rota', async () => {
  const routes = { 'https://rota.example/': '2026-11-01 ; Pharmacie en ligne' };
  const config = {
    planning: '2026-11-01 ; Pharmacie saisie',
    planning_url: 'https://rota.example/',
  };
  const local = await serviceWith(config, { routes });
  assert.equal(local.service.lookup().duty.name, 'Pharmacie saisie');
  const cloud = await serviceWith({ ...config, GLADYS_PREFER_LOCAL: false }, { routes });
  assert.equal(cloud.service.lookup().duty.name, 'Pharmacie en ligne');
  assert.deepEqual(cloud.service.transport(), { transport: 'cloud' });
});

test('refresh: cached for refresh_hours, a failure keeps the last copy', async () => {
  let now = SUNDAY_11H;
  let fail = false;
  const fetchImpl = fakeFetch({
    [DEFAULT_OVERPASS_URL]: () => (fail ? new Error('network down') : OVERPASS_ANSWER),
  });
  const service = new PharmacyService({ fetchImpl, store: createStore(null), now: () => now });
  service.configure(normalizeConfig({ refresh_hours: 24 }), LOCATION);
  await service.refresh();
  await service.refresh();
  assert.equal(fetchImpl.calls.length, 1, 'second refresh served from memory');
  now += 25 * 3600 * 1000;
  fail = true;
  await service.refresh();
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(service.osm.error, 'network down');
  assert.equal(service.osm.pharmacies.length, 3, 'last list kept');
});

test('no location: no OpenStreetMap call, nothing to offer, local badge', async () => {
  const { service, fetchImpl } = await serviceWith({}, { location: null });
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(service.lookup().recommended, null);
  assert.deepEqual(service.transport(), { transport: 'local' });
});

test('an unreachable source without any answer shows unreachable', async () => {
  const { service } = await serviceWith({}, {});
  service.osm.pharmacies = [];
  service.osm.error = 'down';
  assert.deepEqual(service.transport(), { transport: 'unreachable' });
});

test('days left in the rota', async () => {
  const { service } = await serviceWith({ planning: '2026-11-01 > 2026-11-04 ; A' });
  assert.equal(service.planningDaysLeft(), 3);
  const none = await serviceWith({});
  assert.equal(none.service.planningDaysLeft(), null);
  const over = await serviceWith({ planning: '2026-10-01 ; A' });
  assert.equal(over.service.planningDaysLeft(), 0);
});

test('the caches survive a restart through the store', async () => {
  const { store } = await serviceWith({});
  const fetchImpl = fakeFetch({});
  const service = new PharmacyService({ fetchImpl, store, now: () => SUNDAY_11H + 3600 * 1000 });
  service.restore();
  service.configure(normalizeConfig({}), LOCATION);
  await service.refresh();
  assert.equal(fetchImpl.calls.length, 0, 'nothing fetched again');
  assert.equal(service.lookup().recommended.name, 'Pharmacie des Halles');
});
