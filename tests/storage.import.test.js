import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportState, importState } from '../js/storage.js';

const GOOD = {
  version: 2,
  counters: [{ id: 'c1', name: 'X', kind: 'good', goal: null, limit: null }],
  history: { c1: { '2026-09-26': 2 } },
};

test('export then import round-trips', () => {
  const r = importState(exportState(GOOD));
  assert.equal(r.ok, true);
  assert.deepEqual(r.state, GOOD);
});

test('import accepts an un-versioned v1 export and migrates it', () => {
  const r = importState(JSON.stringify({ counters: GOOD.counters, history: GOOD.history }));
  assert.equal(r.ok, true);
  assert.equal(r.state.version, 2);
  assert.deepEqual(r.state.history, GOOD.history);
});

test('import tolerates surrounding whitespace from a paste', () => {
  const r = importState('\n  ' + exportState(GOOD) + '  \n');
  assert.equal(r.ok, true);
});

test('import refuses text that is not JSON', () => {
  const r = importState('hello');
  assert.equal(r.ok, false);
  assert.equal(r.state, undefined);
  assert.ok(r.reason.length > 0);
});

test('import refuses JSON that is not this app data', () => {
  for (const bad of ['[]', '{"a":1}', 'null', '{"counters":{}}', '{"counters":[{"id":"c1"}],"history":"nope"}']) {
    const r = importState(bad);
    assert.equal(r.ok, false, bad);
    assert.equal(r.state, undefined, bad);
    assert.ok(r.reason.length > 0, bad);
  }
});

test('import refuses an empty backup rather than wiping everything', () => {
  const r = importState('{"counters":[],"history":{}}');
  assert.equal(r.ok, false);
  assert.match(r.reason, /no counters/i);
});
