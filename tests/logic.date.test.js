import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayKey, isNewDay } from '../js/logic.js';

test('todayKey formats a date as YYYY-MM-DD in local time', () => {
  assert.equal(todayKey(new Date(2026, 6, 14)), '2026-07-14'); // month is 0-based: 6 = July
  assert.equal(todayKey(new Date(2026, 0, 3)), '2026-01-03');
});

test('isNewDay is true when lastKey differs from today', () => {
  const d = new Date(2026, 6, 14);
  assert.equal(isNewDay('2026-07-13', d), true);
  assert.equal(isNewDay('2026-07-14', d), false);
  assert.equal(isNewDay(null, d), true);
});
