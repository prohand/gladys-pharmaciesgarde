import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openingStatus, parseOpeningHours } from '../src/sources/openingHours.js';

const at = (weekday, hour, minute = 0) => ({ weekday, hour, minute });

test('the plain weekly form', () => {
  const hours = parseOpeningHours('Mo-Fr 08:30-12:30,14:00-19:30; Sa 09:00-12:00; Su off');
  assert.deepEqual(openingStatus(hours, at(0, 9)), { open: true, minutesLeft: 210 });
  assert.equal(openingStatus(hours, at(0, 13)).open, false);
  assert.equal(openingStatus(hours, at(5, 11)).open, true);
  assert.equal(openingStatus(hours, at(5, 12)).open, false);
  assert.equal(openingStatus(hours, at(6, 11)).open, false);
});

test('a later rule replaces the earlier ones for its days', () => {
  const hours = parseOpeningHours('Mo-Sa 09:00-19:00; Sa 09:00-12:00');
  assert.equal(openingStatus(hours, at(5, 15)).open, false);
  assert.equal(openingStatus(hours, at(4, 15)).open, true);
});

test('24/7 and ranges past midnight', () => {
  assert.deepEqual(openingStatus(parseOpeningHours('24/7'), at(3, 3)), {
    open: true,
    minutesLeft: null,
  });
  const night = parseOpeningHours('Mo-Su 20:00-02:00');
  assert.deepEqual(openingStatus(night, at(2, 1)), { open: true, minutesLeft: 60 });
  assert.equal(openingStatus(night, at(2, 3)).open, false);
  // Sunday night runs into Monday.
  const sunday = parseOpeningHours('Su 20:00-26:00');
  assert.equal(openingStatus(sunday, at(0, 1)).open, true);
});

test('weekday lists, wrap-around ranges and holiday rules', () => {
  const hours = parseOpeningHours('Fr-Mo 10:00-12:00; PH off');
  assert.equal(openingStatus(hours, at(6, 11)).open, true);
  assert.equal(openingStatus(hours, at(2, 11)).open, false);
  const list = parseOpeningHours('Mo,We 09:00-12:00');
  assert.equal(openingStatus(list, at(2, 10)).open, true);
  assert.equal(openingStatus(list, at(1, 10)).open, false);
});

test('anything outside the subset is unknown, never guessed', () => {
  for (const value of [
    'Jan-Mar Mo-Fr 09:00-12:00',
    'Mo-Fr 09:00+',
    'Mo-Fr 09:00-12:00 "on appointment"',
    'sunrise-sunset',
    '',
    undefined,
  ]) {
    assert.equal(parseOpeningHours(value), null, String(value));
  }
  assert.deepEqual(openingStatus(null, at(0, 10)), { open: null, minutesLeft: null });
});
