import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, roundSeconds, sessionSeconds, scaleForPhase } from '../js/breathing.js';

test('PRESETS include Box, Relax 4-7-8, Calm 5-5', () => {
  const names = PRESETS.map((p) => p.name);
  assert.ok(names.some((n) => /Box/i.test(n)));
  assert.ok(names.some((n) => /4-7-8/.test(n)));
  assert.ok(names.some((n) => /5-5/.test(n)));
});

test('roundSeconds sums phase seconds', () => {
  assert.equal(roundSeconds([['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]]), 16);
  assert.equal(roundSeconds([['Breathe in', 4], ['Hold', 0], ['Breathe out', 6]]), 10);
});

test('sessionSeconds uses minutes when given, else rounds*roundSeconds', () => {
  const box = [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]];
  assert.equal(sessionSeconds(box, { minutes: 2 }), 120);
  assert.equal(sessionSeconds(box, { rounds: 6 }), 96);
});

test('scaleForPhase grows on in, shrinks on out, holds on hold', () => {
  assert.equal(scaleForPhase('Breathe in'), 1.9);
  assert.equal(scaleForPhase('Breathe out'), 1);
  assert.equal(scaleForPhase('Hold'), null);
});
