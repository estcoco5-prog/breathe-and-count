import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, createCounter, markDay, unmarkDay, toggleDay, isMarked,
  buildStreak, cleanStreak,
} from '../js/logic.js';

function withCounter(kind) {
  return createCounter(emptyState(), { name: 'T', kind });
}

test('markDay writes exactly 1, never the count', () => {
  const s = withCounter('build');
  const id = s.counters[0].id;
  const after = markDay(markDay(s, id, '2026-09-26'), id, '2026-09-26');
  assert.equal(after.history[id]['2026-09-26'], 1);
  assert.equal(isMarked(after, id, '2026-09-26'), true);
});

test('unmarkDay writes 0 and toggleDay flips between them', () => {
  const s = withCounter('build');
  const id = s.counters[0].id;
  const on = toggleDay(s, id, '2026-09-26');
  assert.equal(isMarked(on, id, '2026-09-26'), true);
  const off = toggleDay(on, id, '2026-09-26');
  assert.equal(off.history[id]['2026-09-26'], 0);
  assert.equal(isMarked(unmarkDay(on, id, '2026-09-26'), id, '2026-09-26'), false);
});

test('a pre-existing count of 3 reads as marked (this is how conversion works)', () => {
  const s = withCounter('build');
  const id = s.counters[0].id;
  s.history[id] = { '2026-09-25': 3 };
  assert.equal(isMarked(s, id, '2026-09-25'), true);
});

test('marking a day leaves the rest of the state untouched', () => {
  const s = withCounter('build');
  const id = s.counters[0].id;
  s.history[id] = { '2026-09-20': 7 };
  const after = markDay(s, id, '2026-09-26');
  assert.equal(after.history[id]['2026-09-20'], 7);
  assert.equal(after.version, 2);
});

test('buildStreak counts consecutive done days ending today', () => {
  const days = { '2026-09-24': 1, '2026-09-25': 1, '2026-09-26': 1 };
  assert.equal(buildStreak(days, '2026-09-26', '2026-09-01'), 3);
});

test('buildStreak: not done yet today does not break yesterday', () => {
  const days = { '2026-09-24': 1, '2026-09-25': 1 };
  assert.equal(buildStreak(days, '2026-09-26', '2026-09-01'), 2);
});

test('buildStreak stops at the creation date', () => {
  const days = { '2026-09-24': 1, '2026-09-25': 1, '2026-09-26': 1 };
  assert.equal(buildStreak(days, '2026-09-26', '2026-09-25'), 2);
});

test('cleanStreak counts unmarked days ending today', () => {
  const days = { '2026-09-20': 1 };
  assert.equal(cleanStreak(days, '2026-09-26', '2026-09-01'), 6);
});

test('cleanStreak is 0 when today is a slip - no grace', () => {
  const days = { '2026-09-20': 1, '2026-09-26': 1 };
  assert.equal(cleanStreak(days, '2026-09-26', '2026-09-01'), 0);
});

test('cleanStreak never walks past the creation date', () => {
  assert.equal(cleanStreak({}, '2026-09-26', '2026-09-24'), 3);
});

test('a history key before createdAt is ignored by both streaks', () => {
  const days = { '2026-08-01': 1, '2026-09-26': 1 };
  assert.equal(buildStreak(days, '2026-09-26', '2026-09-25'), 1);
  assert.equal(cleanStreak(days, '2026-09-26', '2026-09-25'), 0);
});
