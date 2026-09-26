import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load, save, migrate, STATE_KEY, BACKUP_KEY, SALVAGE_PREFIX } from '../js/storage.js';

function fakeStore(initial = {}) {
  const map = { ...initial };
  return {
    getItem: (k) => (k in map ? map[k] : null),
    setItem: (k, v) => { map[k] = String(v); },
    _map: map,
  };
}

// The saved state now carries a version stamp, so these round-trip assertions
// include it. They still assert exact deep equality.
test('load returns emptyState when nothing stored', () => {
  const s = load(fakeStore());
  assert.deepEqual(s, { version: 2, counters: [], history: {} });
});

test('save then load round-trips state', () => {
  const store = fakeStore();
  const state = { version: 2, counters: [{ id: 'c1', name: 'X', kind: 'good', goal: null, limit: null }], history: { c1: { '2026-07-14': 2 } } };
  save(state, store);
  assert.deepEqual(load(store), state);
});

test('load returns emptyState on corrupt JSON', () => {
  const s = load(fakeStore({ bc_state: '{not valid json' }));
  assert.deepEqual(s, { version: 2, counters: [], history: {} });
});

const V1 = {
  counters: [{ id: 'c1', name: 'Coffee', kind: 'bad', goal: null, limit: 3, createdAt: '2026-01-02T00:00:00.000Z' }],
  history: { c1: { '2026-07-15': 10, '2026-07-16': 11 } },
};

test('migrate stamps version 2 and changes nothing else', () => {
  const out = migrate(JSON.parse(JSON.stringify(V1)));
  assert.equal(out.version, 2);
  assert.deepEqual(out.counters, V1.counters);
  assert.deepEqual(out.history, V1.history);
});

test('migrate leaves an already-migrated state alone', () => {
  const v2 = { version: 2, ...JSON.parse(JSON.stringify(V1)) };
  assert.deepEqual(migrate(v2), v2);
});

test('migrate coerces an unknown kind to good', () => {
  const odd = { counters: [{ id: 'c1', name: 'X', kind: 'weird', goal: null, limit: null }], history: {} };
  assert.equal(migrate(odd).counters[0].kind, 'good');
});

test('migrate keeps the four known kinds', () => {
  const all = { counters: ['good', 'bad', 'build', 'avoid'].map((kind, i) => ({ id: 'c' + i, name: kind, kind })), history: {} };
  assert.deepEqual(migrate(all).counters.map((c) => c.kind), ['good', 'bad', 'build', 'avoid']);
});

test('load copies the raw v1 text to the backup key exactly once', () => {
  const store = fakeStore({ [STATE_KEY]: JSON.stringify(V1) });
  load(store);
  assert.equal(store.getItem(BACKUP_KEY), JSON.stringify(V1));
  store.setItem(STATE_KEY, JSON.stringify({ version: 2, counters: [], history: {} }));
  load(store);
  assert.equal(store.getItem(BACKUP_KEY), JSON.stringify(V1), 'backup must not be overwritten on a later load');
});

test('load does not write a backup for an already-versioned state', () => {
  const store = fakeStore({ [STATE_KEY]: JSON.stringify({ version: 2, ...V1 }) });
  load(store);
  assert.equal(store.getItem(BACKUP_KEY), null);
});

test('load never destroys stored text it cannot understand', () => {
  const store = fakeStore({ [STATE_KEY]: '{"totally":"wrong"}' });
  const s = load(store);
  assert.deepEqual(s, { version: 2, counters: [], history: {} });
  const salvaged = Object.keys(store._map).filter((k) => k.startsWith(SALVAGE_PREFIX));
  assert.equal(salvaged.length, 1);
  assert.equal(store.getItem(salvaged[0]), '{"totally":"wrong"}');
});

test('load survives a store that throws', () => {
  const angry = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
  assert.deepEqual(load(angry), { version: 2, counters: [], history: {} });
});
