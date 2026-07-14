import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goodStreak, underLimitStreak } from '../js/logic.js';

test('goodStreak counts consecutive days with >=1 ending today', () => {
  const days = { '2026-07-12': 5, '2026-07-13': 3, '2026-07-14': 1 };
  assert.equal(goodStreak(days, '2026-07-14'), 3);
});

test('goodStreak ignores an untouched today but keeps yesterday streak', () => {
  const days = { '2026-07-12': 5, '2026-07-13': 3 }; // today (14) not recorded
  assert.equal(goodStreak(days, '2026-07-14'), 2);
});

test('goodStreak breaks on a zero/missing interior day', () => {
  const days = { '2026-07-11': 2, '2026-07-13': 3, '2026-07-14': 1 }; // 12 missing
  assert.equal(goodStreak(days, '2026-07-14'), 2);
});

// 4th arg is startKey = the counter's creation date; the streak never counts
// days before the counter existed (this also bounds the backward walk).
test('underLimitStreak counts consecutive days at or under the limit', () => {
  const days = { '2026-07-12': 5, '2026-07-13': 4, '2026-07-14': 3 };
  assert.equal(underLimitStreak(days, 5, '2026-07-14', '2026-07-12'), 3);
});

test('underLimitStreak: missing day counts as 0 and continues the streak within bounds', () => {
  const days = { '2026-07-12': 2 }; // 13 and 14 missing -> both 0 <= limit
  assert.equal(underLimitStreak(days, 5, '2026-07-14', '2026-07-12'), 3);
});

test('underLimitStreak breaks on an over-limit day', () => {
  const days = { '2026-07-12': 9, '2026-07-13': 4, '2026-07-14': 2 };
  assert.equal(underLimitStreak(days, 5, '2026-07-14', '2026-07-12'), 2);
});

test('underLimitStreak never counts before the start date', () => {
  const days = { '2026-07-14': 1 };
  assert.equal(underLimitStreak(days, 5, '2026-07-14', '2026-07-14'), 1);
});
