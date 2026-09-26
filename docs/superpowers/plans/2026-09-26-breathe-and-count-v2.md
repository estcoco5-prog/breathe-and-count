# Breathe &amp; Count v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Target tab (build-momentum and will-not-do activities), put every day's number on the count stats, and let an existing counter become a target without losing history.

**Architecture:** Targets are counters with a new `kind` (`build` / `avoid`) in the existing `counters` array, sharing the existing `history` map, so conversion is a one-field edit and migration is a version stamp. New pure functions go in `js/logic.js`; three new UI modules (`grid.js`, `targets.js`, `backup.js`) keep `stats.js` and `app.js` from growing unwieldy.

**Tech Stack:** Plain HTML/CSS/vanilla-JS ES modules. `node:test` for pure logic. No runtime dependencies, no build step, no installs.

**Spec:** `docs/superpowers/specs/2026-09-26-breathe-and-count-v2-design.md`

## Global Constraints

- Zero runtime dependencies and zero install steps. `npm test` runs `node --test` and nothing else.
- All 23 existing tests keep passing, except the two named in Task 1, which change because the state shape gains `version: 2`. No other existing test may be edited or deleted.
- Storage key stays `bc_state`. Origin, file names and directory layout stay as they are.
- `service-worker.js` is cache-first; `CACHE` must end at `breathe-count-v3` (v2 was consumed by the backup-link release) and `ASSETS` must list every new JS file.
- Existing `good` / `bad` counters keep their current streak rules exactly. No number on an existing screen may change.
- Dates are `YYYY-MM-DD` strings in local time via the existing `todayKey()`. Never construct dates from `Date.parse` of a key.
- Work happens on branch `v2-targets`. Do not push `main` until Co says go.
- Real saved data used for testing stays outside the repository and is never committed.

## Review Focus

1. **A `bad` counter with `limit: null`** — these exist in real saved data. `underLimitStreak` receives `Infinity`, so every day qualifies and the streak equals the whole span. Must not crash or loop; the screen must say no limit is set rather than print a meaningless streak. → Task 3.
2. **A day value that is not a finite number** (hand-edited or restored JSON containing `"3"`, `null`, `NaN`). Chart heights and totals must not become `NaN`. → Task 5.
3. **Restoring JSON that parses but is not app state** (`[]`, `{"a":1}`, a counter array with no `history`). Must refuse and leave existing data untouched, never half-apply. → Task 6.
4. **History keys before `createdAt`** (possible via restore from an older export). Backward walks must stop at `startKey` and grid cells must mark those days as before-start rather than drawing them. → Task 2.
5. **A counter created today** (span of 1 day) and **a 30-day window crossing a month and a year boundary**. Grid must still produce exactly 7-wide rows with correct leading blanks. → Task 4.

---

### Task 1: State version, migration, one-time backup

**Files:**
- Modify: `js/logic.js` (`emptyState`)
- Modify: `js/storage.js` (whole file)
- Test: `tests/storage.test.js` (2 existing tests updated, new tests added)

**Interfaces:**
- Consumes: nothing.
- Produces: `emptyState() -> { version: 2, counters: [], history: {} }`; `migrate(state) -> state` (adds `version`, coerces unknown `kind` to `'good'`); `load(store?) -> state`; `save(state, store?) -> void`. `storage.js` exports `STATE_KEY = 'bc_state'`, `BACKUP_KEY = 'bc_state_backup_v1'`, `SALVAGE_PREFIX = 'bc_state_unreadable_'`.

- [ ] **Step 1: Update the two existing tests that assert the old shape**

In `tests/storage.test.js`, these two tests change because the state shape now carries a version. This is a deliberate behaviour change from the spec, not a weakened assertion — both still assert exact deep equality.

```js
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
```

- [ ] **Step 2: Write the failing migration tests**

Append to `tests/storage.test.js`:

```js
import { load, save, migrate, STATE_KEY, BACKUP_KEY } from '../js/storage.js';

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

test('load copies the raw v1 text to the backup key exactly once', () => {
  const store = fakeStore({ [STATE_KEY]: JSON.stringify(V1) });
  load(store);
  assert.equal(store.getItem(BACKUP_KEY), JSON.stringify(V1));
  store.setItem(STATE_KEY, JSON.stringify({ version: 2, counters: [], history: {} }));
  load(store);
  assert.equal(store.getItem(BACKUP_KEY), JSON.stringify(V1), 'backup must not be overwritten on a later load');
});

test('load never destroys stored text it cannot understand', () => {
  const store = fakeStore({ [STATE_KEY]: '{"totally":"wrong"}' });
  const s = load(store);
  assert.deepEqual(s, { version: 2, counters: [], history: {} });
  const salvaged = Object.keys(store._map).filter((k) => k.startsWith('bc_state_unreadable_'));
  assert.equal(salvaged.length, 1);
  assert.equal(store.getItem(salvaged[0]), '{"totally":"wrong"}');
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL — `migrate is not exported`, and the emptyState assertions mismatch.

- [ ] **Step 4: Implement**

In `js/logic.js` change only `emptyState`:

```js
export const STATE_VERSION = 2;
export const KINDS = ['good', 'bad', 'build', 'avoid'];

export function emptyState() {
  return { version: STATE_VERSION, counters: [], history: {} };
}
```

Replace `js/storage.js` with:

```js
// Thin persistence layer over localStorage. Store is injectable for tests.
import { emptyState, migrate as migrateState } from './logic.js';

export const STATE_KEY = 'bc_state';
export const BACKUP_KEY = 'bc_state_backup_v1';
export const SALVAGE_PREFIX = 'bc_state_unreadable_';

export { migrateState as migrate };

function looksLikeState(p) {
  return !!p && Array.isArray(p.counters) && typeof p.history === 'object' && p.history !== null;
}

export function load(store = globalThis.localStorage) {
  let raw = null;
  try { raw = store.getItem(STATE_KEY); } catch { return emptyState(); }
  if (!raw) return emptyState();

  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { parsed = null; }

  if (!looksLikeState(parsed)) {
    // Never write over text we cannot read: set it aside under its own key.
    try { store.setItem(SALVAGE_PREFIX + Date.now(), raw); }
    catch { /* storage full or blocked: keep going with an empty state */ }
    return emptyState();
  }

  try {
    if (parsed.version === undefined && store.getItem(BACKUP_KEY) === null) {
      store.setItem(BACKUP_KEY, raw);
    }
  } catch { /* a failed backup must not stop the app loading */ }

  return migrateState(parsed);
}

export function save(state, store = globalThis.localStorage) {
  store.setItem(STATE_KEY, JSON.stringify(state));
}
```

Add to `js/logic.js`:

```js
export function migrate(state) {
  const next = { ...state, version: STATE_VERSION };
  next.counters = (state.counters || []).map((c) => (
    KINDS.includes(c.kind) ? c : { ...c, kind: 'good' }
  ));
  next.history = state.history || {};
  return next;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, all tests green.

- [ ] **Step 6: Commit**

```bash
git add js/logic.js js/storage.js tests/storage.test.js
git commit -m "feat: version the saved state, migrate v1, and back it up once"
```

---

### Task 2: Marking a day, and the two streaks

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.target.test.js` (create)

**Interfaces:**
- Consumes: `todayKey`, `getToday`, `emptyState` from Task 1's `logic.js`.
- Produces: `isMarked(state, id, key) -> boolean`; `markDay(state, id, key) -> state`; `unmarkDay(state, id, key) -> state`; `toggleDay(state, id, key) -> state`; `buildStreak(days, todayK, startKey) -> number`; `cleanStreak(days, todayK, startKey) -> number`.

- [ ] **Step 1: Write the failing tests**

Create `tests/logic.target.test.js`:

```js
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

test('cleanStreak is 0 when today is a slip — no grace', () => {
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/logic.target.test.js`
Expected: FAIL — `markDay is not exported`.

- [ ] **Step 3: Implement in `js/logic.js`**

```js
export function isMarked(state, id, key = todayKey()) {
  return getToday(state, id, key) >= 1;
}

export function markDay(state, id, key = todayKey()) { return setDay(state, id, key, 1); }
export function unmarkDay(state, id, key = todayKey()) { return setDay(state, id, key, 0); }
export function toggleDay(state, id, key = todayKey()) {
  return isMarked(state, id, key) ? unmarkDay(state, id, key) : markDay(state, id, key);
}

// Consecutive marked days ending today. An unmarked today does not break
// yesterday's streak — the day is not over yet.
export function buildStreak(days, todayK = todayKey(), startKey = todayK) {
  let key = todayK;
  let n = 0;
  if (!((days[todayK] || 0) >= 1)) key = prevKey(todayK);
  while (key >= startKey && (days[key] || 0) >= 1) { n += 1; key = prevKey(key); }
  return n;
}

// Consecutive UNMARKED days ending today. A slip today resets it to zero.
// A missing day counts as clean, so this MUST be bounded by startKey.
export function cleanStreak(days, todayK = todayKey(), startKey = todayK) {
  if ((days[todayK] || 0) >= 1) return 0;
  let key = todayK;
  let n = 0;
  while (key >= startKey && (days[key] || 0) < 1) { n += 1; key = prevKey(key); }
  return n;
}
```

`setDay` is already module-private in `logic.js`; no change needed there.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.target.test.js
git commit -m "feat: mark/unmark a target day, build and clean streaks"
```

---

### Task 3: Runs, totals, and the no-limit case

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.runs.test.js` (create)

**Interfaces:**
- Consumes: `prevKey`, `todayKey` (module-private / exported as in Task 2).
- Produces: `bestRun(days, startKey, todayK, wanted) -> number`; `runList(days, startKey, todayK, wanted) -> [{ length, endKey, current }]` sorted longest first; `markedDays(days, startKey, todayK) -> number`; `missedDays(days, startKey, todayK) -> number`; `hasLimit(counter) -> boolean`.

- [ ] **Step 1: Write the failing tests**

Create `tests/logic.runs.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestRun, runList, markedDays, missedDays, hasLimit } from '../js/logic.js';

const DAYS = { // 20 marked, 21 not, 22-24 marked, 25 not, 26 marked (today)
  '2026-09-20': 1, '2026-09-22': 1, '2026-09-23': 1, '2026-09-24': 1, '2026-09-26': 1,
};

test('bestRun finds the longest marked run', () => {
  assert.equal(bestRun(DAYS, '2026-09-20', '2026-09-26', true), 3);
});

test('bestRun finds the longest unmarked run', () => {
  assert.equal(bestRun({ '2026-09-20': 1, '2026-09-26': 1 }, '2026-09-20', '2026-09-26', false), 5);
});

test('runList returns runs longest first and flags the one ending today', () => {
  const runs = runList(DAYS, '2026-09-20', '2026-09-26', true);
  assert.equal(runs[0].length, 3);
  assert.equal(runs[0].endKey, '2026-09-24');
  const current = runs.find((r) => r.current);
  assert.equal(current.length, 1);
  assert.equal(current.endKey, '2026-09-26');
});

test('markedDays and missedDays split the span, today never counted as missed', () => {
  assert.equal(markedDays(DAYS, '2026-09-20', '2026-09-26'), 5);
  // span 20..26 is 7 days; 5 marked; 21 and 25 missed; today (26) is marked anyway
  assert.equal(missedDays(DAYS, '2026-09-20', '2026-09-26'), 2);
});

test('an unmarked today is not a missed day', () => {
  assert.equal(missedDays({ '2026-09-25': 1 }, '2026-09-25', '2026-09-26'), 0);
});

test('hasLimit is false for a bad counter with no limit set', () => {
  assert.equal(hasLimit({ kind: 'bad', limit: null }), false);
  assert.equal(hasLimit({ kind: 'bad', limit: 0 }), true);
  assert.equal(hasLimit({ kind: 'bad', limit: 10 }), true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/logic.runs.test.js`
Expected: FAIL — `bestRun is not exported`.

- [ ] **Step 3: Implement in `js/logic.js`**

```js
function spanKeys(startKey, todayK) {
  const out = [];
  let key = todayK;
  while (key >= startKey) { out.push(key); key = prevKey(key); }
  return out.reverse();
}

export function runList(days, startKey, todayK = todayKey(), wanted = true) {
  const runs = [];
  let length = 0;
  let endKey = null;
  spanKeys(startKey, todayK).forEach((key) => {
    if (((days[key] || 0) >= 1) === wanted) { length += 1; endKey = key; }
    else if (length) { runs.push({ length, endKey, current: false }); length = 0; endKey = null; }
  });
  if (length) runs.push({ length, endKey, current: endKey === todayK });
  return runs.sort((a, b) => b.length - a.length);
}

export function bestRun(days, startKey, todayK = todayKey(), wanted = true) {
  const runs = runList(days, startKey, todayK, wanted);
  return runs.length ? runs[0].length : 0;
}

export function markedDays(days, startKey, todayK = todayKey()) {
  return spanKeys(startKey, todayK).filter((key) => (days[key] || 0) >= 1).length;
}

export function missedDays(days, startKey, todayK = todayKey()) {
  return spanKeys(startKey, todayK)
    .filter((key) => key !== todayK && (days[key] || 0) < 1).length;
}

export function hasLimit(counter) {
  return counter.kind === 'bad' && typeof counter.limit === 'number' && Number.isFinite(counter.limit);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.runs.test.js
git commit -m "feat: runs, marked/missed day counts, hasLimit guard"
```

---

### Task 4: Calendar grid cells and summary numbers

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.grid.test.js` (create)

**Interfaces:**
- Consumes: `todayKey`, `prevKey`, `spanKeys`.
- Produces: `gridCells(days, startKey, todayK, n) -> [{ key, value, dayOfMonth, blank, beforeStart, today }]` whose length is a multiple of 7; `intensityStep(value, goal) -> 0|1|2|3|4`; `weekTotal(days, todayK) -> number`; `dailyAverage(days, startKey, todayK) -> number`; `daysAtGoal(days, startKey, todayK, goal) -> number`.

- [ ] **Step 1: Write the failing tests**

Create `tests/logic.grid.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridCells, intensityStep, weekTotal, dailyAverage, daysAtGoal } from '../js/logic.js';

test('gridCells returns whole weeks with leading blanks so columns are weekdays', () => {
  const cells = gridCells({}, '2026-08-28', '2026-09-26', 30);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.length, 35);
  assert.equal(cells.filter((c) => c.blank).length, 5); // 28 Aug 2026 is a Friday
  assert.equal(cells[5].key, '2026-08-28');
  assert.equal(cells[34].key, '2026-09-26');
  assert.equal(cells[34].today, true);
});

test('gridCells marks days before the counter existed', () => {
  const cells = gridCells({}, '2026-09-20', '2026-09-26', 30);
  const real = cells.filter((c) => !c.blank);
  assert.equal(real.filter((c) => c.beforeStart).length, 23);
  assert.equal(real.filter((c) => !c.beforeStart).length, 7);
});

test('gridCells crosses a year boundary without gaps', () => {
  const cells = gridCells({ '2025-12-31': 4 }, '2025-12-01', '2026-01-05', 30);
  const keys = cells.filter((c) => !c.blank).map((c) => c.key);
  assert.equal(keys[keys.indexOf('2025-12-31') + 1], '2026-01-01');
  assert.equal(cells.find((c) => c.key === '2025-12-31').value, 4);
});

test('gridCells treats a non-numeric stored value as 0', () => {
  const cells = gridCells({ '2026-09-26': 'three' }, '2026-09-26', '2026-09-26', 30);
  assert.equal(cells.find((c) => c.key === '2026-09-26').value, 0);
});

test('intensityStep spreads 0..goal over five steps', () => {
  assert.equal(intensityStep(0, 30), 0);
  assert.equal(intensityStep(30, 30), 4);
  assert.equal(intensityStep(45, 30), 4);
  assert.equal(intensityStep(5, 30), 1);
  assert.equal(intensityStep(3, null), 4); // no goal: anything counted is full strength
});

test('weekTotal, dailyAverage and daysAtGoal', () => {
  const days = { '2026-09-24': 10, '2026-09-25': 20, '2026-09-26': 30 };
  assert.equal(weekTotal(days, '2026-09-26'), 60);
  assert.equal(dailyAverage(days, '2026-09-24', '2026-09-26'), 20);
  assert.equal(daysAtGoal(days, '2026-09-24', '2026-09-26', 20), 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/logic.grid.test.js`
Expected: FAIL — `gridCells is not exported`.

- [ ] **Step 3: Implement in `js/logic.js`**

```js
function num(v) { return Number.isFinite(Number(v)) ? Number(v) : 0; }

function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = Sunday
}

export function gridCells(days, startKey, todayK = todayKey(), n = 30) {
  const window = [];
  let key = todayK;
  for (let i = 0; i < n; i++) { window.push(key); key = prevKey(key); }
  window.reverse();

  const lead = weekdayOf(window[0]);
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push({ key: null, value: 0, dayOfMonth: null, blank: true, beforeStart: false, today: false });
  window.forEach((k) => cells.push({
    key: k,
    value: num(days[k]),
    dayOfMonth: Number(k.slice(8)),
    blank: false,
    beforeStart: k < startKey,
    today: k === todayK,
  }));
  while (cells.length % 7) cells.push({ key: null, value: 0, dayOfMonth: null, blank: true, beforeStart: false, today: false });
  return cells;
}

export function intensityStep(value, goal) {
  const v = num(value);
  if (v <= 0) return 0;
  if (!goal) return 4;
  const ratio = v / goal;
  if (ratio >= 1) return 4;
  if (ratio >= 0.85) return 3;
  if (ratio >= 0.5) return 2;
  return 1;
}

export function weekTotal(days, todayK = todayKey()) {
  let key = todayK;
  let sum = 0;
  for (let i = 0; i < 7; i++) { sum += num(days[key]); key = prevKey(key); }
  return sum;
}

export function dailyAverage(days, startKey, todayK = todayKey()) {
  const keys = spanKeys(startKey, todayK);
  if (!keys.length) return 0;
  return Math.round(keys.reduce((a, k) => a + num(days[k]), 0) / keys.length);
}

export function daysAtGoal(days, startKey, todayK = todayKey(), goal = null) {
  if (!goal) return 0;
  return spanKeys(startKey, todayK).filter((k) => num(days[k]) >= goal).length;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.grid.test.js
git commit -m "feat: weekday-aligned grid cells and stats summary numbers"
```

---

### Task 5: Non-numeric values cannot poison the charts

**Files:**
- Modify: `js/logic.js` (`allTimeTotal`, `weeklySeries`, `monthlySeries`)
- Test: `tests/logic.series.test.js` (append)

**Interfaces:**
- Consumes: `num()` from Task 4.
- Produces: no new exports; existing ones become NaN-proof.

- [ ] **Step 1: Write the failing tests**

Append to `tests/logic.series.test.js`:

```js
test('a non-numeric stored value counts as 0 everywhere', () => {
  const state = { version: 2, counters: [{ id: 'c1', name: 'X', kind: 'good' }], history: { c1: { '2026-09-25': 'five', '2026-09-26': 2 } } };
  assert.equal(allTimeTotal(state, 'c1'), 2);
  const week = weeklySeries(state.history.c1, '2026-09-26');
  assert.ok(week.every((d) => Number.isFinite(d.value)));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/logic.series.test.js`
Expected: FAIL — total is `NaN`.

- [ ] **Step 3: Implement**

In `js/logic.js`, route every read of a day value through `num()`: `allTimeTotal` uses `Object.values(days).reduce((a, b) => a + num(b), 0)`, and `seriesEndingToday` sets `value: num(days && days[key])`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.series.test.js
git commit -m "fix: treat a non-numeric stored day value as zero"
```

---

### Task 6: Export and import

**Files:**
- Modify: `js/storage.js`
- Test: `tests/storage.import.test.js` (create)

**Interfaces:**
- Consumes: `looksLikeState`, `migrate`, `STATE_KEY` from Task 1.
- Produces: `exportState(state) -> string` (pretty JSON); `importState(text) -> { ok: true, state } | { ok: false, reason }` where `reason` is a plain-English sentence.

- [ ] **Step 1: Write the failing tests**

Create `tests/storage.import.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exportState, importState } from '../js/storage.js';

const GOOD = { version: 2, counters: [{ id: 'c1', name: 'X', kind: 'good', goal: null, limit: null }], history: { c1: { '2026-09-26': 2 } } };

test('export then import round-trips', () => {
  const r = importState(exportState(GOOD));
  assert.equal(r.ok, true);
  assert.deepEqual(r.state, GOOD);
});

test('import accepts an un-versioned v1 export and migrates it', () => {
  const r = importState(JSON.stringify({ counters: GOOD.counters, history: GOOD.history }));
  assert.equal(r.ok, true);
  assert.equal(r.state.version, 2);
});

test('import refuses text that is not JSON', () => {
  const r = importState('hello');
  assert.equal(r.ok, false);
  assert.match(r.reason, /not.*(readable|JSON)/i);
});

test('import refuses JSON that is not this app\'s data', () => {
  for (const bad of ['[]', '{"a":1}', 'null', '{"counters":{}}', '{"counters":[]}']) {
    const r = importState(bad);
    if (bad === '{"counters":[]}') { assert.equal(r.ok, false, bad); continue; }
    assert.equal(r.ok, false, bad);
    assert.ok(r.reason.length > 0);
  }
});

test('import never returns a partial state', () => {
  const r = importState('{"counters":[{"id":"c1"}],"history":"nope"}');
  assert.equal(r.ok, false);
  assert.equal(r.state, undefined);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/storage.import.test.js`
Expected: FAIL — `exportState is not exported`.

- [ ] **Step 3: Implement in `js/storage.js`**

```js
export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function importState(text) {
  let parsed = null;
  try { parsed = JSON.parse(String(text).trim()); }
  catch { return { ok: false, reason: 'That text is not readable as saved data. Paste the whole thing, including the first { and the last }.' }; }
  if (!looksLikeState(parsed)) {
    return { ok: false, reason: 'That is readable text, but it is not a Breathe & Count backup — it has no list of counters and days.' };
  }
  if (parsed.counters.length === 0) {
    return { ok: false, reason: 'That backup has no counters in it. Nothing was changed.' };
  }
  return { ok: true, state: migrateState(parsed) };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/storage.js tests/storage.import.test.js
git commit -m "feat: export and import saved data with plain-English refusals"
```

---

### Task 7: Visual tokens and shared chrome

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Produces: CSS custom properties and classes consumed by Tasks 8-11: `--slate`, `--slate-soft`, `--honey-deep`, `--rose-deep`, `--cell-done`, `--cell-done-old`, `--cell-miss-line`, `--count-1`..`--count-4`; classes `.card` (depth), `.hero`, `.chip-row`, `.chip`, `.cal`, `.cal-cell`, `.cal-head`, `.runs`, `.run-row`, `.seg`, `.tabbar` (3 tabs, active pill).

- [ ] **Step 1: Add the tokens to every theme block**

Add to `:root`, to the `@media (prefers-color-scheme: dark)` block, to `:root[data-theme="dark"]` and to `:root[data-theme="light"]`, matching the mockup at `docs/2026-09-26-v2-mockup.html`:

```css
--slate:#4A5D7E; --slate-soft:#E3E8F1;
--honey-deep:#8A5E17; --rose-deep:#96424A;
--cell-done:#CFE5DA; --cell-done-old:#EDF4F0; --cell-miss-line:#E0DBCF;
--count-1:#F7EBD4; --count-2:#EFD9A8; --count-3:#E0BE7E; --count-4:#C1852B;
```

Dark values: `--slate:#9FB3D1; --slate-soft:#232C38; --honey-deep:#E4B45C; --rose-deep:#E0888E; --cell-done:#26423B; --cell-done-old:#1E2A28; --cell-miss-line:#39413F; --count-1:#2A2418; --count-2:#3D3320; --count-3:#5A4526; --count-4:#8A6420;`

- [ ] **Step 2: Add card depth and the new components**

Give `.card`, `.stat-tile` and `.chart-card` the shared depth: `box-shadow:0 1px 0 rgba(255,255,255,.9) inset, 0 12px 26px -22px rgba(35,40,42,.4);` (dark mode: drop the inset highlight to `rgba(255,255,255,.06)`). Add `.hero`, `.chip-row`/`.chip`, `.cal`/`.cal-cell`/`.cal-head`, `.runs`/`.run-row`, and the three-tab `.tabbar` with `.tab.on` rendering as a soft pill, all copied from the mockup's inline styles.

- [ ] **Step 3: Move the temporary inline style off the backup link**

`index.html` currently carries `style="display:block;text-align:center;..."` on the backup link from the interim release. Replace with a `.panel-link` class in the stylesheet.

- [ ] **Step 4: Check by eye**

Run: `python -m http.server 8080`, open `http://localhost:8080`, confirm the existing Count and Breathe screens still render correctly in both light and dark.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css index.html
git commit -m "feat: v2 design tokens, card depth, calendar and chip components"
```

---

### Task 8: Three tabs and the new icons

**Files:**
- Modify: `index.html` (tab bar, new `#v-target` section, dialog `kind` options)
- Modify: `js/app.js` (tab switching for three tabs, dialog type handling)

**Interfaces:**
- Consumes: Task 7's `.tabbar` classes, Task 1's `KINDS`.
- Produces: `#v-target` section element; `show(viewId)` handling `v-count` / `v-target` / `v-breathe`; the dialog's `kind` select offering all four kinds.

- [ ] **Step 1: Replace the tab bar markup**

Three `<button class="tab">` elements with the icons from `docs/2026-09-26-v2-mockup.html` artboard `Icons.dc.html`: tally marks for Count, summit-with-dot for Target, spreading arcs for Breathe. Keep `data-tab` attributes: `count`, `target`, `breathe`.

- [ ] **Step 2: Add the empty Target section**

```html
<section class="view" id="v-target">
  <div class="greet">
    <div class="hello">Day by day</div>
    <div class="date" id="targetDate">Today</div>
  </div>
  <div class="hero hero-today" id="targetToday"></div>
  <div id="targetList"></div>
  <button class="add-btn" id="addTargetBtn">+  New target</button>
</section>
```

- [ ] **Step 3: Extend the dialog's type list**

```html
<option value="good">Count — good habit</option>
<option value="bad">Count — cutting down</option>
<option value="build">Target — build momentum</option>
<option value="avoid">Target — will not do</option>
```

`toggleTargetLabel()` in `app.js` must hide the goal/limit field entirely for `build` and `avoid`, and show the before/after explainer block from the mockup's `Convert.dc.html`.

- [ ] **Step 4: Update tab switching**

```js
const VIEW = { count: 'v-count', target: 'v-target', breathe: 'v-breathe' };
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
    t.classList.add('on');
    show(VIEW[t.dataset.tab]);
    if (t.dataset.tab === 'target') renderTargets();
  });
});
```

- [ ] **Step 5: Check by eye, then commit**

Confirm all three tabs switch and the dialog lists four types.

```bash
git add index.html js/app.js
git commit -m "feat: three-tab bar with new icons, empty Target view, four counter types"
```

---

### Task 9: Target cards

**Files:**
- Create: `js/targets.js`
- Modify: `js/app.js` (import and wire `renderTargets`)

**Interfaces:**
- Consumes: `toggleDay`, `isMarked`, `buildStreak`, `cleanStreak`, `bestRun`, `markedDays`, `missedDays`, `gridCells`, `todayKey` from `logic.js`; `save` from `storage.js`.
- Produces: `initTargets({ getState, setState, openStats })`; `renderTargets()`.

- [ ] **Step 1: Build the module**

Group `state.counters` by kind into `build` and `avoid` lists under the two section labels from the mockup. Each card renders: name, kind tag, `Stats ›`, the big number (`buildStreak` or `cleanStreak`), the sub-line (`best N · missed M of S` / `best run N · M slips ever`), the 7-cell strip from `gridCells(days, startKey, todayKey(), 7)`, and one action button that calls `toggleDay` for `build` or `markDay` for `avoid`. Escape names with the existing `escapeHtml` pattern.

- [ ] **Step 2: Render the today band**

`#targetToday` shows `N of M done · K still clean`, plus one small square per target: filled for done, outlined for not-yet, `--cell-done` for a clean avoid.

- [ ] **Step 3: Check by eye with real data**

Seed the browser with a realistic multi-counter state via the console, convert one counter to `build` and another to `avoid` in the dialog, and confirm the cards match the mockup.

- [ ] **Step 4: Commit**

```bash
git add js/targets.js js/app.js
git commit -m "feat: target cards for build and avoid activities"
```

---

### Task 10: Stats — numbers on bars, box grids, target screens

**Files:**
- Create: `js/grid.js`
- Modify: `js/stats.js`, `index.html` (stats view gains a target variant and a month-grid container)

**Interfaces:**
- Consumes: everything from Tasks 2-4.
- Produces: `renderGrid(el, cells, opts)` where `opts` is `{ mode: 'count' | 'done' | 'clean', goal, legend }`; `openStats(state, counterId)` routed by kind.

- [ ] **Step 1: Write `js/grid.js`**

One function that turns `gridCells(...)` output into the calendar markup: weekday header row, then a cell per entry. `mode: 'count'` prints the value and shades with `intensityStep`; `'done'` fills done days and outlines missed; `'clean'` fills clean days and marks slips with `--rose`. Blank and `beforeStart` cells render as the dashed placeholder.

- [ ] **Step 2: Weekly bars gain numbers and a goal line**

In `stats.js`, `drawBars` renders the value above each bar, the weekday letter and day-of-month below, outlines today, and draws the dashed goal line when the counter has a `goal` (or a `limit` via `hasLimit`).

- [ ] **Step 3: Route the stats screen by kind**

`good`/`bad` keep their existing tiles and rules exactly — verify a limited `bad` counter still shows the same under-limit streak and total it showed in v1. For a `bad` counter where `hasLimit()` is false, the tile reads `No limit set` instead of a streak. `build`/`avoid` render the hero band, three chips, the month grid and the runs list.

- [ ] **Step 4: Check by eye against the mockup, then commit**

```bash
git add js/grid.js js/stats.js index.html
git commit -m "feat: per-day numbers, goal line, box grids, target stats screens"
```

---

### Task 11: Backup & restore panel

**Files:**
- Create: `js/backup.js`
- Modify: `index.html` (a `<dialog id="backupDialog">`), `backup.html` (point its restore instructions at the in-app panel)

**Interfaces:**
- Consumes: `exportState`, `importState`, `save` from `storage.js`.
- Produces: `initBackup({ getState, setState, onRestored })`.

- [ ] **Step 1: Build the panel**

A dialog with the exported JSON in a read-only textarea, a **Copy** button, a **Save as a file** download link, a paste box, and a **Restore** button. Restore calls `importState`; on `ok: false` it shows `reason` and changes nothing; on `ok: true` it asks for confirmation naming the counter count, then saves and re-renders.

- [ ] **Step 2: Check both paths by eye**

Paste rubbish → refusal message, data unchanged. Paste a real export → confirm → counters replaced.

- [ ] **Step 3: Commit**

```bash
git add js/backup.js index.html backup.html
git commit -m "feat: in-app backup and restore panel"
```

---

### Task 12: Ship it

**Files:**
- Modify: `service-worker.js`

- [ ] **Step 1: Bump the cache and list the new files**

```js
const CACHE = 'breathe-count-v3';
```
Add `'./js/grid.js'`, `'./js/targets.js'`, `'./js/backup.js'` to `ASSETS`.

- [ ] **Step 2: Full test run**

Run: `npm test`
Expected: PASS, every test, none skipped.

- [ ] **Step 3: Drive the whole app in Chrome with a realistic state**

Seed a realistic state, then: counters show the same numbers as v1; convert one counter to `build`; check the Target tab and its stats; convert it back and confirm the original counts return; export, wipe, restore; confirm `caches.keys()` is exactly `['breathe-count-v3']`.

- [ ] **Step 4: Report to Co and wait**

Do not push `main`. Report what was verified, then wait for Co's go.
