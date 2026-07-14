import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, createCounter, getToday, increment, decrement, allTimeTotal } from '../js/logic.js';

test('createCounter adds a counter with an id and defaults', () => {
  const s = createCounter(emptyState(), { name: 'Pushups', kind: 'good', goal: 20 });
  assert.equal(s.counters.length, 1);
  assert.equal(s.counters[0].name, 'Pushups');
  assert.equal(s.counters[0].kind, 'good');
  assert.equal(s.counters[0].goal, 20);
  assert.equal(s.counters[0].limit, null);
  assert.ok(s.counters[0].id);
});

test('increment/decrement update the day count and never go below zero', () => {
  let s = createCounter(emptyState(), { name: 'Water', kind: 'good' });
  const id = s.counters[0].id;
  s = increment(s, id, '2026-07-14');
  s = increment(s, id, '2026-07-14');
  assert.equal(getToday(s, id, '2026-07-14'), 2);
  s = decrement(s, id, '2026-07-14');
  assert.equal(getToday(s, id, '2026-07-14'), 1);
  s = decrement(s, id, '2026-07-14');
  s = decrement(s, id, '2026-07-14');
  assert.equal(getToday(s, id, '2026-07-14'), 0);
});

test('increment does not mutate the input state', () => {
  const s0 = createCounter(emptyState(), { name: 'X', kind: 'good' });
  const id = s0.counters[0].id;
  const s1 = increment(s0, id, '2026-07-14');
  assert.equal(getToday(s0, id, '2026-07-14'), 0);
  assert.equal(getToday(s1, id, '2026-07-14'), 1);
});

test('allTimeTotal sums all recorded days', () => {
  let s = createCounter(emptyState(), { name: 'Reading', kind: 'good' });
  const id = s.counters[0].id;
  s = increment(s, id, '2026-07-12');
  s = increment(s, id, '2026-07-13');
  s = increment(s, id, '2026-07-13');
  assert.equal(allTimeTotal(s, id), 3);
});
