import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestRun, runList, markedDays, missedDays, hasLimit } from '../js/logic.js';

// 20 marked, 21 not, 22-24 marked, 25 not, 26 marked (today)
const DAYS = {
  '2026-09-20': 1, '2026-09-22': 1, '2026-09-23': 1, '2026-09-24': 1, '2026-09-26': 1,
};

test('bestRun finds the longest marked run', () => {
  assert.equal(bestRun(DAYS, '2026-09-20', '2026-09-26', true), 3);
});

test('bestRun finds the longest unmarked run', () => {
  assert.equal(bestRun({ '2026-09-20': 1, '2026-09-26': 1 }, '2026-09-20', '2026-09-26', false), 5);
});

test('bestRun is 0 when nothing qualifies', () => {
  assert.equal(bestRun({}, '2026-09-20', '2026-09-26', true), 0);
});

test('runList returns runs longest first and flags the one ending today', () => {
  const runs = runList(DAYS, '2026-09-20', '2026-09-26', true);
  assert.equal(runs[0].length, 3);
  assert.equal(runs[0].endKey, '2026-09-24');
  const current = runs.find((r) => r.current);
  assert.equal(current.length, 1);
  assert.equal(current.endKey, '2026-09-26');
});

test('runList marks no run as current when today does not qualify', () => {
  const runs = runList({ '2026-09-24': 1 }, '2026-09-20', '2026-09-26', true);
  assert.equal(runs.some((r) => r.current), false);
});

test('markedDays and missedDays split the span, today never counted as missed', () => {
  assert.equal(markedDays(DAYS, '2026-09-20', '2026-09-26'), 5);
  assert.equal(missedDays(DAYS, '2026-09-20', '2026-09-26'), 2);
});

test('an unmarked today is not a missed day', () => {
  assert.equal(missedDays({ '2026-09-25': 1 }, '2026-09-25', '2026-09-26'), 0);
});

test('hasLimit is false for a bad counter with no limit set', () => {
  assert.equal(hasLimit({ kind: 'bad', limit: null }), false);
  assert.equal(hasLimit({ kind: 'bad', limit: 0 }), true);
  assert.equal(hasLimit({ kind: 'bad', limit: 10 }), true);
  assert.equal(hasLimit({ kind: 'good', goal: 5 }), false);
});
