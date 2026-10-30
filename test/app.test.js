import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerIntegration } from '../src/app.js';
import { DEFAULT_OVERPASS_URL } from '../src/sources/osm.js';
import { createStore } from '../src/store.js';
import { fakeFetch, HOME, OVERPASS_ANSWER, SUNDAY_11H } from './helpers/fixtures.js';

const HOUSES = [
  { id: 1, name: 'Maison', selector: 'maison', latitude: HOME.latitude, longitude: HOME.longitude },
];

async function start({ config = {}, houses = HOUSES, routes = {}, clock } = {}) {
  const gladys = createFakeGladys({ config, houses });
  const time = clock ?? { now: SUNDAY_11H };
  const fetchImpl = fakeFetch({ [DEFAULT_OVERPASS_URL]: OVERPASS_ANSWER, ...routes });
  const store = createStore(null);
  const app = registerIntegration(gladys, { store, fetchImpl, now: () => time.now, tickMs: null });
  await gladys.connect();
  return { gladys, app, fetchImpl, store, time };
}

const feature = (gladys, key) => {
  const device = gladys.fake.discoveredDevices[0];
  return gladys.fake.lastState(`${device.external_id}:${key}`);
};

test('connecting publishes the device, its states, its badge and the status', async () => {
  const { gladys } = await start();
  const [device] = gladys.fake.discoveredDevices;
  assert.equal(device.name, 'Pharmacie de garde');
  assert.equal(device.features.length, 7);
  assert.deepEqual(feature(gladys, 'name'), 'Pharmacie des Halles');
  assert.equal(feature(gladys, 'nearest-open-distance') > 0, true);
  assert.equal(gladys.fake.transports.at(-1).transport, 'cloud');
  assert.equal(gladys.fake.transports.at(-1).degraded, true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.ok(gladys.fake.widgetRefreshes.includes('pharmacies'));
});

test('a rota turn starting fires duty_changed, once', async () => {
  const clock = { now: SUNDAY_11H };
  const { gladys, app } = await start({
    config: { planning: '2026-11-01 20:00 > 2026-11-02 09:00 ; Pharmacie de Nuit ; 1 quai ; 0102' },
    clock,
  });
  assert.equal(
    gladys.fake.sceneEvents.filter((event) => event.key === 'duty_changed').length,
    0,
    'the first answer is only recorded',
  );
  clock.now = Date.parse('2026-11-01T19:30:00Z'); // 20:30 in Paris
  await app.tick();
  await app.tick();
  const changes = gladys.fake.sceneEvents.filter((event) => event.key === 'duty_changed');
  assert.equal(changes.length, 1);
  assert.equal(changes[0].data.name, 'Pharmacie de Nuit');
  assert.equal(changes[0].data.source, 'planning');
  assert.equal(changes[0].data.until, '2026-11-02 09:00');
  assert.deepEqual(feature(gladys, 'phone'), '0102');
  assert.equal(gladys.fake.transports.at(-1).transport, 'local');
});

test('nothing on duty and everything closed fires no_pharmacy_available', async () => {
  const clock = { now: SUNDAY_11H };
  const { gladys, app } = await start({ clock });
  clock.now = Date.parse('2026-11-01T22:00:00Z'); // 23:00, the Halles closed at 20:00
  await app.tick();
  assert.deepEqual(
    gladys.fake.sceneEvents.map((event) => event.key),
    ['no_pharmacy_available'],
  );
  assert.deepEqual(feature(gladys, 'name'), '-');
});

test('a rota running out warns once a day', async () => {
  const clock = { now: SUNDAY_11H };
  const { gladys, app } = await start({
    config: { planning: '2026-11-01 > 2026-11-03 ; A', planning_warning_days: 7 },
    clock,
  });
  await app.tick();
  const warnings = gladys.fake.sceneEvents.filter((e) => e.key === 'planning_running_out');
  assert.equal(warnings.length, 1);
  assert.deepEqual(warnings[0].data, { days_left: 2, last_day: '2026-11-03' });
  clock.now += 24 * 3600 * 1000;
  await app.tick();
  assert.equal(gladys.fake.sceneEvents.filter((e) => e.key === 'planning_running_out').length, 2);
});

test('scene actions: get_pharmacy for a moment, refresh_pharmacies', async () => {
  const { gladys, fetchImpl } = await start({
    config: { planning: '2026-11-02 ; Pharmacie du Lundi' },
  });
  const now = await gladys.fake.sceneAction('get_pharmacy', { moment: 'now' });
  assert.equal(now.success, true);
  assert.equal(now.data.outputs.name, 'Pharmacie des Halles');
  assert.equal(now.data.outputs.source, 'osm');
  const tomorrow = await gladys.fake.sceneAction('get_pharmacy', { moment: 'tomorrow' });
  assert.equal(tomorrow.data.outputs.name, 'Pharmacie du Lundi');
  assert.equal(tomorrow.data.outputs.found, true);
  // Sunday 21:00: the Halles closed at 20:00 and no turn is known.
  const night = await gladys.fake.sceneAction('get_pharmacy', { moment: 'tonight' });
  assert.deepEqual(night.data.outputs, { found: false });

  const calls = fetchImpl.calls.length;
  const refreshed = await gladys.fake.sceneAction('refresh_pharmacies', {});
  assert.deepEqual(refreshed.data.outputs, { found: true, open_count: 1 });
  assert.equal(fetchImpl.calls.length, calls + 1, 'forced refresh');
});

test('the widget content renders exactly as sent, and its button refreshes', async () => {
  const { gladys, fetchImpl } = await start({
    config: { planning: '2026-11-01 ; Pharmacie du Centre' },
  });
  for (const count of [undefined, 0, 8]) {
    const ack = await gladys.fake.widgetGet('pharmacies', { settings: { count } });
    assert.equal(ack.success, true);
    assert.deepEqual(validateWidgetContent(ack.data.content), []);
  }
  const { content } = (await gladys.fake.widgetGet('pharmacies', { settings: {} })).data;
  const list = content.components.find((component) => component.type === 'card-list');
  assert.equal(list.items[0].title, 'Pharmacie du Centre');
  assert.equal(list.items[0].badge.text.fr, 'De garde');
  const links = content.components.filter((c) => c.type === 'button' && c.link);
  assert.deepEqual(
    links.map((button) => button.link.url.slice(0, 26)),
    ['https://www.openstreetmap.', 'https://www.3237.fr/'],
  );

  const calls = fetchImpl.calls.length;
  const ack = await gladys.fake.widgetAction('pharmacies', 'refresh', {}, { settings: {} });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /Actualisé/);
  assert.equal(fetchImpl.calls.length, calls + 1);
  const unknown = await gladys.fake.widgetAction('pharmacies', 'nope', {}, { settings: {} });
  assert.equal(unknown.success, false);
});

test('the widget says what to set up when nothing is configured', async () => {
  const { gladys } = await start({ houses: [] });
  const { content } = (await gladys.fake.widgetGet('pharmacies', { settings: {} })).data;
  assert.deepEqual(validateWidgetContent(content), []);
  assert.equal(content.components[0].type, 'text');
  assert.equal(gladys.fake.connectionStatus.connected, false);
});

test('configuration actions: test the sources, show the next turns', async () => {
  const { gladys } = await start({
    config: {
      planning: '2026-11-01 ; Pharmacie du Centre\nbad line',
      planning_url: 'https://rota.example/',
    },
    routes: { 'https://rota.example/': new Error('ECONNREFUSED') },
  });
  const test = await gladys.fake.action('test_sources', {});
  assert.equal(test.success, true);
  const report = test.data.message.fr;
  assert.match(report, /Position : 45\.7640, 4\.8357 \(Maison\)/);
  assert.match(report, /Tableau saisi : 1 garde\(s\) lue\(s\), 1 ligne\(s\) illisible\(s\)/);
  assert.match(report, /ligne 2 : missing pharmacy name/);
  assert.match(report, /Tableau en ligne : injoignable \(ECONNREFUSED\)/);
  assert.match(report, /OpenStreetMap : 3 pharmacies dans un rayon de 5 km, 1 ouvertes/);
  assert.match(report, /En ce moment : Pharmacie du Centre/);
  for (const language of ['en', 'de', 'es']) assert.ok(test.data.message[language]);

  const planning = await gladys.fake.action('show_planning', { days: 7 });
  assert.match(
    planning.data.message.fr,
    /2026-11-01 00:00 → 2026-11-02 00:00 : Pharmacie du Centre/,
  );
  const empty = await gladys.fake.action('show_planning', { days: 1 });
  assert.ok(empty.data.message.en);
});

test('saving the configuration applies at once; typed coordinates win', async () => {
  const { gladys, fetchImpl } = await start({ houses: [] });
  assert.equal(fetchImpl.calls.length, 0);
  await gladys.fake.configUpdated({ latitude: '45.764', longitude: '4,8357' });
  assert.equal(fetchImpl.calls.length, 1);
  assert.deepEqual(feature(gladys, 'name'), 'Pharmacie des Halles');
  assert.equal(gladys.fake.connectionStatus.connected, true);
});

test('a device created later gets its states at once', async () => {
  const { gladys } = await start();
  const count = gladys.fake.states.length;
  await gladys.fake.deviceCreated(gladys.fake.discoveredDevices[0]);
  assert.ok(gladys.fake.states.length > count);
});
