import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklySeries, monthlySeries, allTimeTotal } from '../js/logic.js';

test('weeklySeries returns 7 days ending today, oldest first', () => {
  const days = { '2026-07-14': 3, '2026-07-13': 5 };
  const s = weeklySeries(days, '2026-07-14');
  assert.equal(s.length, 7);
  assert.equal(s[6].key, '2026-07-14');
  assert.equal(s[6].value, 3);
  assert.equal(s[5].key, '2026-07-13');
  assert.equal(s[5].value, 5);
  assert.equal(s[0].key, '2026-07-08');
  assert.equal(s[0].value, 0); // missing day -> 0
});

test('weeklySeries labels are weekday initials', () => {
  const s = weeklySeries({}, '2026-07-14'); // 2026-07-14 is a Tuesday
  assert.equal(s[6].label, 'T'); // Tuesday
  assert.equal(s[5].label, 'M'); // Monday
});

test('monthlySeries returns 30 days ending today', () => {
  const s = monthlySeries({ '2026-07-14': 9 }, '2026-07-14');
  assert.equal(s.length, 30);
  assert.equal(s[29].key, '2026-07-14');
  assert.equal(s[29].value, 9);
  assert.equal(s[0].key, '2026-06-15');
});

test('a non-numeric stored value counts as 0 everywhere', () => {
  const state = { version: 2, counters: [{ id: 'c1', name: 'X', kind: 'good' }], history: { c1: { '2026-09-25': 'five', '2026-09-26': 2 } } };
  assert.equal(allTimeTotal(state, 'c1'), 2);
  const week = weeklySeries(state.history.c1, '2026-09-26');
  assert.ok(week.every((d) => Number.isFinite(d.value)));
  assert.equal(week[week.length - 1].value, 2);
  assert.equal(week[week.length - 2].value, 0);
});
