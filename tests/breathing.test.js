import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, roundSeconds, sessionSeconds, scaleForPhase, cueForPhase } from '../js/breathing.js';

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

test('cueForPhase: rising tone + 1 pulse in, falling + 2 out, flat + 3 on hold', () => {
  const i = cueForPhase('Breathe in'), o = cueForPhase('Breathe out'), h = cueForPhase('Hold');
  assert.ok(i.tone[1] > i.tone[0]);
  assert.ok(o.tone[1] < o.tone[0]);
  assert.equal(h.tone[0], h.tone[1]);
  assert.deepEqual([i.pulses, o.pulses, h.pulses], [1, 2, 3]);
  // vibrate patterns alternate buzz/gap, so buzz count = pulses
  for (const c of [i, o, h]) assert.equal(Math.ceil(c.pattern.length / 2), c.pulses);
});
