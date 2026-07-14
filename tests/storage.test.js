import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, save } from '../js/storage.js';

function fakeStore(initial = {}) {
  const map = { ...initial };
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    _map: map,
  };
}

test('load returns emptyState when nothing stored', () => {
  const s = load(fakeStore());
  assert.deepEqual(s, { counters: [], history: {} });
});

test('save then load round-trips state', () => {
  const store = fakeStore();
  const state = { counters: [{ id: 'c1', name: 'X', kind: 'good', goal: null, limit: null }], history: { c1: { '2026-07-14': 2 } } };
  save(state, store);
  assert.deepEqual(load(store), state);
});

test('load returns emptyState on corrupt JSON', () => {
  const s = load(fakeStore({ bc_state: '{not valid json' }));
  assert.deepEqual(s, { counters: [], history: {} });
});
