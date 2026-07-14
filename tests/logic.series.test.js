import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklySeries, monthlySeries } from '../js/logic.js';

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
