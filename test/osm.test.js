import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildQuery,
  DEFAULT_OVERPASS_URL,
  distanceKm,
  fetchPharmacies,
  parseOverpass,
} from '../src/sources/osm.js';
import { fakeFetch, HOME, OVERPASS_ANSWER } from './helpers/fixtures.js';

test('distances', () => {
  // Paris - Lyon, about 392 km as the crow flies.
  const km = distanceKm(48.8566, 2.3522, 45.764, 4.8357);
  assert.ok(km > 385 && km < 400, `${km}`);
  assert.equal(distanceKm(1, 1, 1, 1), 0);
});

test('the query asks for both pharmacy tags within the radius, around a rounded point', () => {
  const query = buildQuery({ ...HOME, radiusKm: 2.5 });
  assert.match(query, /nwr\["amenity"="pharmacy"\]\(around:2500,45.764,4.836\)/);
  assert.match(query, /nwr\["healthcare"="pharmacy"\]/);
  assert.match(query, /out center tags;$/);
});

test('an Overpass answer becomes pharmacies, nearest first, each once', () => {
  const pharmacies = parseOverpass(OVERPASS_ANSWER, HOME);
  assert.deepEqual(
    pharmacies.map((pharmacy) => pharmacy.name),
    ['Pharmacie du Centre', 'Pharmacie des Halles', 'Grande Pharmacie'],
  );
  const [centre] = pharmacies;
  assert.equal(centre.id, 'node-1');
  assert.equal(centre.address, '12 Rue de la République, 69002 Lyon');
  assert.equal(centre.phone, '+33 4 78 00 00 01');
  assert.ok(centre.hours);
  assert.equal(pharmacies[2].hours, null, 'unsupported hours are unknown');
  assert.deepEqual(parseOverpass({}, HOME), []);
});

test('fetch: POST to the public server by default, errors are thrown', async () => {
  const fetchImpl = fakeFetch({ [DEFAULT_OVERPASS_URL]: OVERPASS_ANSWER });
  const pharmacies = await fetchPharmacies({ ...HOME, radiusKm: 5 }, fetchImpl);
  assert.equal(pharmacies.length, 3);
  assert.equal(fetchImpl.calls[0].init.method, 'POST');
  assert.match(fetchImpl.calls[0].init.headers['user-agent'], /gladys-pharmaciesgarde/);

  const down = fakeFetch({ 'https://x/': new Response('busy', { status: 429 }) });
  await assert.rejects(
    fetchPharmacies({ ...HOME, radiusKm: 5, overpassUrl: 'https://x/' }, down),
    /Overpass HTTP 429/,
  );
  const garbage = fakeFetch({ 'https://x/': 'not json' });
  await assert.rejects(
    fetchPharmacies({ ...HOME, radiusKm: 5, overpassUrl: 'https://x/' }, garbage),
    /not JSON/,
  );
});
