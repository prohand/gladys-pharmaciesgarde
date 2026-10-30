import { test } from 'node:test';
import assert from 'node:assert/strict';
import { entriesAt, parsePlanning, parseRotaDate, planningEnd } from '../src/sources/planning.js';

const TZ = 'Europe/Paris';
const iso = (date) => date.toISOString();

test('a date alone is the whole local day', () => {
  const { entries, errors } = parsePlanning(
    '2026-11-01 ; Pharmacie du Centre ; 12 rue de la Paix ; 04 78 00 00 01',
    TZ,
  );
  assert.deepEqual(errors, []);
  assert.equal(entries.length, 1);
  assert.equal(iso(entries[0].start), '2026-10-31T23:00:00.000Z');
  assert.equal(iso(entries[0].end), '2026-11-01T23:00:00.000Z');
  assert.equal(entries[0].address, '12 rue de la Paix');
  assert.equal(entries[0].phone, '04 78 00 00 01');
});

test('ranges, French dates, a start time alone, | separators and comments', () => {
  const text = [
    '# rota of the sector',
    '2026-11-07 19:00 > 2026-11-14 09:00 ; Pharmacie des Halles',
    '15/11/2026 9h00 ; Pharmacie du Pont',
    '2026-11-20 > 2026-11-21 ; Pharmacie du Marché',
  ].join('\n');
  const { entries, errors } = parsePlanning(`${text} | 2026-11-22 ; Pharmacie Bis`, TZ);
  assert.deepEqual(errors, []);
  assert.deepEqual(
    entries.map((entry) => [entry.name, iso(entry.start), iso(entry.end)]),
    [
      ['Pharmacie des Halles', '2026-11-07T18:00:00.000Z', '2026-11-14T08:00:00.000Z'],
      ['Pharmacie du Pont', '2026-11-15T08:00:00.000Z', '2026-11-16T08:00:00.000Z'],
      ['Pharmacie du Marché', '2026-11-19T23:00:00.000Z', '2026-11-21T23:00:00.000Z'],
      ['Pharmacie Bis', '2026-11-21T23:00:00.000Z', '2026-11-22T23:00:00.000Z'],
    ],
  );
});

test('unreadable lines are reported with their number, the rest is kept', () => {
  const { entries, errors } = parsePlanning(
    '2026-11-01 ; A\nyesterday ; B\n2026-11-03\n2026-11-05 > 2026-11-04 ; C',
    TZ,
  );
  assert.equal(entries.length, 1);
  assert.deepEqual(errors, [
    { line: 2, message: 'unreadable date "yesterday"' },
    { line: 3, message: 'missing pharmacy name' },
    { line: 4, message: 'the end is before the start' },
  ]);
});

test('JSON, with French keys, wrappers and explicit offsets', () => {
  const json = JSON.stringify({
    records: [
      {
        fields: { debut: '2026-11-01T09:00:00+01:00', fin: '2026-11-02T09:00:00+01:00', nom: 'A' },
      },
      { fields: { date: '2026-11-03', pharmacie: 'B', telephone: '0102', lat: '45.7', lon: 4.8 } },
    ],
  });
  const { entries, errors } = parsePlanning(json, TZ);
  assert.deepEqual(errors, []);
  assert.equal(iso(entries[0].start), '2026-11-01T08:00:00.000Z');
  assert.equal(entries[1].phone, '0102');
  assert.equal(entries[1].latitude, 45.7);
  assert.equal(entries[1].longitude, 4.8);
  assert.deepEqual(parsePlanning('[oops', TZ).errors, [{ line: 0, message: 'invalid JSON' }]);
  assert.equal(parsePlanning('{"a":1}', TZ).errors[0].message, 'no list of turns in the JSON');
});

test('the turn running at an instant: the latest started wins', () => {
  const { entries } = parsePlanning(
    '2026-11-01 > 2026-11-07 ; Weekly\n2026-11-01 09:00 > 2026-11-01 20:00 ; Sunday replacement',
    TZ,
  );
  const sunday = Date.parse('2026-11-01T10:00:00Z');
  assert.deepEqual(
    entriesAt(entries, sunday).map((entry) => entry.name),
    ['Sunday replacement', 'Weekly'],
  );
  assert.equal(entriesAt(entries, Date.parse('2026-11-03T10:00:00Z'))[0].name, 'Weekly');
  assert.equal(iso(planningEnd(entries)), '2026-11-07T23:00:00.000Z');
  assert.equal(planningEnd([]), null);
});

test('dates', () => {
  assert.equal(parseRotaDate('2026-13-01', TZ), null);
  assert.equal(parseRotaDate('', TZ), null);
  assert.equal(parseRotaDate('2026-11-01', TZ).hasTime, false);
  assert.equal(iso(parseRotaDate('2026-11-01T09:30Z', TZ).date), '2026-11-01T09:30:00.000Z');
});
