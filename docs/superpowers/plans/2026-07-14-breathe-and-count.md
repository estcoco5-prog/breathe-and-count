# Breathe & Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, offline iPhone Home-Screen web app (PWA) with two features — activity counters (good habits + "cutting down" habits with stats) and a guided breathwork timer.

**Architecture:** Plain HTML/CSS/vanilla-JS static site. All domain logic lives in small **pure ES modules** (`js/logic.js`, `js/breathing.js`) that take state in and return values/new-state out — no DOM, no storage — so they are unit-tested with Node's built-in `node:test` runner. A thin `js/storage.js` persists state to `localStorage`. `js/app.js` wires the DOM to those modules. A `manifest.webmanifest` + `service-worker.js` make it installable and offline. Visual source of truth is the approved mockup at `docs/mockup-reference.html`.

**Tech Stack:** HTML5, CSS (custom properties, light/dark tokens), vanilla JavaScript (ES modules), `node:test` for unit tests (no external deps), Python `http.server` for local serving, PowerShell `System.Drawing` for icon PNGs. Git for version control.

## Global Constraints

- **No runtime dependencies / no frameworks.** App ships as static files only.
- **No network at runtime.** All data in `localStorage`; nothing is uploaded. Works fully offline after first load.
- **No test dependencies.** Use only `node:test` + `node:assert` (built into Node 26).
- **Target:** iPhone / iOS Safari, installed via Add to Home Screen; must also open on desktop for dev.
- **No sound, no vibration, no accounts, no cloud, no notifications** (explicit non-goals).
- **localStorage key:** `bc_state`. **Date key format:** `YYYY-MM-DD` (local time).
- **Two accent worlds:** honey (good habits / Count), spruce+eucalyptus (Breathe), rose ("cutting down"). Follows system light/dark.
- **Visual fidelity:** match `docs/mockup-reference.html` element-for-element (including text inside the breathing circle and charts).
- Commit after every task with a `feat:`/`test:`/`chore:` message.

---

### Task 0: Project scaffold + git

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create dirs: `js/`, `css/`, `icons/`, `tests/`

**Interfaces:**
- Produces: `npm test` runs `node --test`; git repo initialized with clean baseline.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "breathe-and-count",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Private offline iPhone PWA: activity counters + breathwork timer",
  "scripts": {
    "test": "node --test",
    "serve": "python -m http.server 8080"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.DS_Store
Thumbs.db
*.log
```

- [ ] **Step 3: Create `README.md`**

```markdown
# Breathe & Count

A private, offline iPhone Home-Screen app: count your activities and do guided breathwork.

## Develop
- Run tests: `npm test`
- Serve locally: `npm run serve` then open http://localhost:8080

## Install on iPhone
1. Host the folder's files on a free static host (GitHub Pages or Netlify).
2. Open the URL in **Safari** on iPhone.
3. Share -> **Add to Home Screen**.
4. Launch from the icon: full-screen, offline, data saved on the phone.

Design spec: `docs/spec/2026-07-14-breathe-and-count-design.md`
Visual mockup: `docs/mockup-reference.html`
```

- [ ] **Step 4: Initialize git and commit**

```bash
cd "C:/Users/ASUS/OneDrive/Desktop/breathe-and-count"
git init
git add .
git commit -m "chore: scaffold project (package.json, gitignore, readme, docs)"
```
Expected: commit succeeds including the existing `docs/` files.

---

### Task 1: Date/day utilities

**Files:**
- Create: `js/logic.js`
- Test: `tests/logic.date.test.js`

**Interfaces:**
- Produces:
  - `todayKey(date = new Date()) -> "YYYY-MM-DD"` (local time)
  - `isNewDay(lastKey, date = new Date()) -> boolean`

- [ ] **Step 1: Write the failing test** — create `tests/logic.date.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayKey, isNewDay } from '../js/logic.js';

test('todayKey formats a date as YYYY-MM-DD in local time', () => {
  assert.equal(todayKey(new Date(2026, 6, 14)), '2026-07-14'); // month is 0-based: 6 = July
  assert.equal(todayKey(new Date(2026, 0, 3)), '2026-01-03');
});

test('isNewDay is true when lastKey differs from today', () => {
  const d = new Date(2026, 6, 14);
  assert.equal(isNewDay('2026-07-13', d), true);
  assert.equal(isNewDay('2026-07-14', d), false);
  assert.equal(isNewDay(null, d), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/logic.date.test.js`
Expected: FAIL (cannot find module `../js/logic.js` / export missing).

- [ ] **Step 3: Write minimal implementation** — create `js/logic.js`

```javascript
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isNewDay(lastKey, date = new Date()) {
  return lastKey !== todayKey(date);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/logic.date.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.date.test.js
git commit -m "feat: add date/day key utilities"
```

---

### Task 2: Counter operations + history

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.counters.test.js`

**Interfaces:**
- Consumes: `todayKey` from Task 1.
- Produces (all pure — return a NEW state, never mutate the input):
  - `emptyState() -> { counters: [], history: {} }`
  - `createCounter(state, { name, kind, goal=null, limit=null }) -> state` (adds `{id, name, kind, goal, limit, createdAt}`; `id` = `"c" + Date.now()` or crypto-random)
  - `getToday(state, id, key = todayKey()) -> number` (0 if none)
  - `increment(state, id, key = todayKey()) -> state`
  - `decrement(state, id, key = todayKey()) -> state` (never below 0)
  - `allTimeTotal(state, id) -> number` (sum of all history values for that counter)
  - State shape: `history[id][dateKey] = number`.

- [ ] **Step 1: Write the failing test** — create `tests/logic.counters.test.js`

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/logic.counters.test.js`
Expected: FAIL (exports missing).

- [ ] **Step 3: Write minimal implementation** — append to `js/logic.js`

```javascript
export function emptyState() {
  return { counters: [], history: {} };
}

function clone(state) {
  return {
    counters: state.counters.map((c) => ({ ...c })),
    history: Object.fromEntries(
      Object.entries(state.history).map(([id, days]) => [id, { ...days }])
    ),
  };
}

export function createCounter(state, { name, kind, goal = null, limit = null }) {
  const next = clone(state);
  const id = 'c' + Date.now() + Math.floor(Math.random() * 1000);
  next.counters.push({ id, name, kind, goal, limit, createdAt: new Date().toISOString() });
  next.history[id] = {};
  return next;
}

export function getToday(state, id, key = todayKey()) {
  return (state.history[id] && state.history[id][key]) || 0;
}

function setDay(state, id, key, value) {
  const next = clone(state);
  if (!next.history[id]) next.history[id] = {};
  next.history[id][key] = Math.max(0, value);
  return next;
}

export function increment(state, id, key = todayKey()) {
  return setDay(state, id, key, getToday(state, id, key) + 1);
}

export function decrement(state, id, key = todayKey()) {
  return setDay(state, id, key, getToday(state, id, key) - 1);
}

export function allTimeTotal(state, id) {
  const days = state.history[id] || {};
  return Object.values(days).reduce((a, b) => a + b, 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/logic.counters.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.counters.test.js
git commit -m "feat: add counter create/increment/decrement/total logic"
```

---

### Task 3: Streak calculations

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.streak.test.js`

**Interfaces:**
- Consumes: `todayKey` from Task 1; `history[id]` day-map shape from Task 2.
- Produces:
  - `goodStreak(days, todayK = todayKey()) -> number` — consecutive days (ending today or yesterday) with value >= 1.
  - `underLimitStreak(days, limit, todayK = todayKey()) -> number` — consecutive days (ending today or yesterday) with recorded value <= limit. **A day with no record counts as 0**, which is <= limit, so it continues the streak.
  - Both walk backwards day-by-day. The streak may end "today" if today qualifies, otherwise it is measured ending yesterday (so an untouched good counter earlier today doesn't show streak 0 mid-day).

**Streak walk rule (both):** Start at `todayK`. If today qualifies, count it and keep walking back. If today does NOT qualify, skip today (don't count, don't break) and start counting from yesterday. Then walk strictly backwards, stopping at the first non-qualifying day.

- [ ] **Step 1: Write the failing test** — create `tests/logic.streak.test.js`

```javascript
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

test('underLimitStreak counts consecutive days at or under the limit', () => {
  const days = { '2026-07-12': 5, '2026-07-13': 4, '2026-07-14': 3 };
  assert.equal(underLimitStreak(days, 5, '2026-07-14'), 3);
});

test('underLimitStreak: missing day counts as 0 and continues the streak', () => {
  const days = { '2026-07-12': 2 }; // 13 and 14 missing -> both 0 <= limit
  assert.equal(underLimitStreak(days, 5, '2026-07-14'), 3);
});

test('underLimitStreak breaks on an over-limit day', () => {
  const days = { '2026-07-12': 9, '2026-07-13': 4, '2026-07-14': 2 };
  assert.equal(underLimitStreak(days, 5, '2026-07-14'), 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/logic.streak.test.js`
Expected: FAIL (exports missing).

- [ ] **Step 3: Write minimal implementation** — append to `js/logic.js`

```javascript
function prevKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayKey(dt);
}

function walkStreak(days, todayK, qualifies) {
  let key = todayK;
  let count = 0;
  // If today qualifies, start counting from today; else start from yesterday.
  if (!qualifies(days[todayK])) key = prevKey(todayK);
  while (qualifies(days[key])) {
    count += 1;
    key = prevKey(key);
  }
  return count;
}

export function goodStreak(days, todayK = todayKey()) {
  return walkStreak(days, todayK, (v) => (v || 0) >= 1);
}

export function underLimitStreak(days, limit, todayK = todayKey()) {
  return walkStreak(days, todayK, (v) => (v || 0) <= limit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/logic.streak.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.streak.test.js
git commit -m "feat: add good-habit and under-limit streak logic"
```

---

### Task 4: Chart series (weekly + monthly)

**Files:**
- Modify: `js/logic.js`
- Test: `tests/logic.series.test.js`

**Interfaces:**
- Consumes: `todayKey`, `prevKey` (internal), `history[id]` shape.
- Produces:
  - `weeklySeries(days, todayK = todayKey()) -> Array<{ key, label, value }>` length 7, oldest first, ending today. `label` = weekday initial (`M T W T F S S`).
  - `monthlySeries(days, todayK = todayKey()) -> Array<{ key, value }>` length 30, oldest first, ending today.

- [ ] **Step 1: Write the failing test** — create `tests/logic.series.test.js`

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weeklySeries, monthlySeries } from '../js/logic.js';

test('weeklySeries returns 7 days ending today, oldest first', () => {
  const days = { '2026-07-14': 3, '2026-07-13': 5 };
  const s = weeklySeries(days, '2026-07-14');
  assert.equal(s.length, 7);
  assert.equal(s[6].key, '2026-07-14');
  assert.equal(s[6].value, 3);
  assert.equal(s[5].key, '2026-07-13');
  assert.equal(s[5].value, 5);
  assert.equal(s[0].key, '2026-07-08');
  assert.equal(s[0].value, 0); // missing day -> 0
});

test('weeklySeries labels are weekday initials', () => {
  const s = weeklySeries({}, '2026-07-14'); // 2026-07-14 is a Tuesday
  assert.equal(s[6].label, 'T'); // Tuesday
  assert.equal(s[5].label, 'M'); // Monday
});

test('monthlySeries returns 30 days ending today', () => {
  const s = monthlySeries({ '2026-07-14': 9 }, '2026-07-14');
  assert.equal(s.length, 30);
  assert.equal(s[29].key, '2026-07-14');
  assert.equal(s[29].value, 9);
  assert.equal(s[0].key, '2026-06-15');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/logic.series.test.js`
Expected: FAIL (exports missing).

- [ ] **Step 3: Write minimal implementation** — append to `js/logic.js`

```javascript
const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sun..Sat

function seriesEndingToday(days, todayK, n, withLabel) {
  const out = [];
  let key = todayK;
  for (let i = 0; i < n; i++) {
    const [y, m, d] = key.split('-').map(Number);
    const entry = { key, value: (days && days[key]) || 0 };
    if (withLabel) entry.label = WEEKDAY_INITIAL[new Date(y, m - 1, d).getDay()];
    out.push(entry);
    key = prevKey(key);
  }
  return out.reverse();
}

export function weeklySeries(days, todayK = todayKey()) {
  return seriesEndingToday(days, todayK, 7, true);
}

export function monthlySeries(days, todayK = todayKey()) {
  return seriesEndingToday(days, todayK, 30, false);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/logic.series.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js tests/logic.series.test.js
git commit -m "feat: add weekly and monthly chart series logic"
```

---

### Task 5: Breathing pattern math

**Files:**
- Create: `js/breathing.js`
- Test: `tests/breathing.test.js`

**Interfaces:**
- Produces:
  - `PRESETS` — array of `{ id, name, steps }` where `steps` = `[[word, seconds], ...]`, word in `'Breathe in' | 'Hold' | 'Breathe out'`.
    - Box: `[['Breathe in',4],['Hold',4],['Breathe out',4],['Hold',4]]`
    - Relax 4-7-8: `[['Breathe in',4],['Hold',7],['Breathe out',8]]`
    - Calm 5-5: `[['Breathe in',5],['Breathe out',5]]`
  - `roundSeconds(steps) -> number` — sum of all phase seconds (skips 0-length).
  - `sessionSeconds(steps, { minutes, rounds }) -> number` — `minutes*60` if minutes given, else `rounds*roundSeconds(steps)`.
  - `scaleForPhase(word) -> number|null` — `1.9` for 'Breathe in', `1` for 'Breathe out', `null` for 'Hold' (hold = keep current size).

- [ ] **Step 1: Write the failing test** — create `tests/breathing.test.js`

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/breathing.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write minimal implementation** — create `js/breathing.js`

```javascript
export const PRESETS = [
  { id: 'box', name: 'Box breathing', steps: [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]] },
  { id: 'relax', name: 'Relax · 4-7-8', steps: [['Breathe in', 4], ['Hold', 7], ['Breathe out', 8]] },
  { id: 'calm', name: 'Calm · 5-5', steps: [['Breathe in', 5], ['Breathe out', 5]] },
];

export function roundSeconds(steps) {
  return steps.reduce((sum, [, secs]) => sum + secs, 0);
}

export function sessionSeconds(steps, { minutes, rounds }) {
  if (minutes != null) return minutes * 60;
  return rounds * roundSeconds(steps);
}

export function scaleForPhase(word) {
  if (word === 'Breathe in') return 1.9;
  if (word === 'Breathe out') return 1;
  return null; // Hold: keep current scale
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/breathing.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add js/breathing.js tests/breathing.test.js
git commit -m "feat: add breathing pattern math (presets, durations, scale)"
```

---

### Task 6: Storage layer

**Files:**
- Create: `js/storage.js`
- Test: `tests/storage.test.js`

**Interfaces:**
- Consumes: `emptyState` from `js/logic.js`.
- Produces:
  - `load(store) -> state` — reads key `bc_state`; returns parsed state or `emptyState()` if absent/corrupt. `store` defaults to `globalThis.localStorage` (injectable for tests).
  - `save(state, store) -> void` — writes `JSON.stringify(state)` to `bc_state`.
- Tests inject a **fake store** object `{ getItem, setItem }` so no browser is needed.

- [ ] **Step 1: Write the failing test** — create `tests/storage.test.js`

```javascript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/storage.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write minimal implementation** — create `js/storage.js`

```javascript
import { emptyState } from './logic.js';

const KEY = 'bc_state';

export function load(store = globalThis.localStorage) {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.counters) || typeof parsed.history !== 'object') {
      return emptyState();
    }
    return parsed;
  } catch {
    return emptyState();
  }
}

export function save(state, store = globalThis.localStorage) {
  store.setItem(KEY, JSON.stringify(state));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/storage.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the whole suite and commit**

Run: `npm test`
Expected: all suites PASS.

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: add localStorage persistence layer"
```

---

### Task 7: HTML shell + CSS (visual port from mockup)

**Files:**
- Create: `index.html`
- Create: `css/styles.css`
- Reference: `docs/mockup-reference.html` (source of truth for markup + styles)

**Interfaces:**
- Produces: the static shell with two tab views (`#v-count`, `#v-breathe`), a `#v-stats` view, and a `#session` overlay; `<script type="module" src="js/app.js">` at the end. All the `<style>` from the mockup moves into `css/styles.css` unchanged (tokens, phone frame, cards, chips, session ring, tab bar, light/dark). `app.js` is empty stub for now.

- [ ] **Step 1: Create `index.html`**

Copy the full markup structure from `docs/mockup-reference.html` with these changes:
- Move the entire `<style>...</style>` block into `css/styles.css`; replace with `<link rel="stylesheet" href="css/styles.css">`.
- Remove the inline `<script>...</script>` block (logic moves to modules in later tasks).
- Add in the head area (top of the file, before content):
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Breathe & Count">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png">
```
- Keep the page-frame `.phone` wrapper for desktop dev, BUT add a body class hook so the real install can go full-bleed (handled in Task 11 CSS). For now keep as-is.
- At the very end of the body add: `<script type="module" src="js/app.js"></script>`.

- [ ] **Step 2: Create `css/styles.css`**

Paste the exact CSS from `docs/mockup-reference.html`'s `<style>` block (the `:root` tokens, dark/light overrides, phone frame, status bar, cards, `.tag`, `.stat-*`, `.chart-*`, `.bars`, breathe `.prog`/`.circle`/`.phase`, `.session`, `.tabbar`, etc.). Do not alter values — fidelity to the mockup is required.

- [ ] **Step 3: Create empty `js/app.js` stub**

```javascript
// Wiring added in later tasks.
console.log('Breathe & Count booting…');
```

- [ ] **Step 4: Verify in browser**

Run: `npm run serve` then open http://localhost:8080
Expected: The phone frame renders identically to the mockup (both tabs visible, dark/light follows system). Buttons are inert (no JS yet). No console errors except the boot log.

- [ ] **Step 5: Commit**

```bash
git add index.html css/styles.css js/app.js
git commit -m "feat: static HTML shell + CSS ported from approved mockup"
```

---

### Task 8: Count tab wiring (render, +/-, add/edit/delete, persist)

**Files:**
- Modify: `js/app.js`
- Reference: `js/logic.js`, `js/storage.js`

**Interfaces:**
- Consumes: `load`, `save`; `createCounter`, `getToday`, `increment`, `decrement`, `todayKey` from logic.
- Produces: a module-level `state` loaded on boot; `renderCounters()` that paints `#counterList`; event handlers for +1/-1/add/edit/delete that update `state`, call `save(state)`, and re-render. Tab switching between `#v-count` and `#v-breathe`.

- [ ] **Step 1: Implement counter rendering and actions** — replace `js/app.js`

```javascript
import { load, save } from './storage.js';
import { createCounter, getToday, increment, decrement, todayKey } from './logic.js';
import { openStats } from './stats.js';       // added in Task 9
import { initBreathe } from './breathe-ui.js'; // added in Task 10

let state = load();

const listEl = document.getElementById('counterList');

function counterCard(c) {
  const val = getToday(state, c.id);
  const isBad = c.kind === 'bad';
  const goalTxt = isBad
    ? (val <= c.limit ? `of ${c.limit} limit ✓` : `of ${c.limit} limit · over`)
    : (c.goal ? `of ${c.goal} today` : 'today');
  const tag = isBad ? '<span class="tag bad">Cutting down</span>' : '<span class="tag good">Good habit</span>';
  return `<div class="card${isBad ? ' bad' : ''}">
    <div class="top"><div><div class="name">${escapeHtml(c.name)}</div>${tag}</div>
      <button class="stats-link" data-stats="${c.id}">Stats ›</button></div>
    <div class="count-row"><div class="bignum">${val}</div><div class="goaltag">${goalTxt}</div></div>
    <div class="actions"><button class="mini" data-dec="${c.id}">−</button>
      <button class="plus" data-inc="${c.id}">+1</button></div>
    <div class="card-edit"><button class="edit-link" data-edit="${c.id}">Edit</button></div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

export function renderCounters() {
  if (state.counters.length === 0) {
    listEl.innerHTML = '<div class="empty">No counters yet. Tap “New counter” to add one.</div>';
    return;
  }
  listEl.innerHTML = state.counters.map(counterCard).join('');
}

function persist() { save(state); }

listEl.addEventListener('click', (e) => {
  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  const st = e.target.closest('[data-stats]');
  const ed = e.target.closest('[data-edit]');
  if (inc) { state = increment(state, inc.dataset.inc); persist(); renderCounters(); }
  else if (dec) { state = decrement(state, dec.dataset.dec); persist(); renderCounters(); }
  else if (st) { openStats(state, st.dataset.stats); }
  else if (ed) { openCounterForm(state.counters.find((c) => c.id === ed.dataset.edit)); }
});

// ---- add / edit form (simple prompt-based modal) ----
const dialog = document.getElementById('counterDialog');
document.getElementById('addBtn').addEventListener('click', () => openCounterForm(null));

function openCounterForm(existing) {
  const f = dialog.querySelector('form');
  f.name.value = existing ? existing.name : '';
  f.kind.value = existing ? existing.kind : 'good';
  f.target.value = existing ? (existing.kind === 'bad' ? existing.limit : existing.goal) ?? '' : '';
  dialog.dataset.editId = existing ? existing.id : '';
  toggleTargetLabel(f);
  document.getElementById('deleteBtn').style.display = existing ? 'block' : 'none';
  dialog.showModal();
}

function toggleTargetLabel(f) {
  document.getElementById('targetLabel').textContent = f.kind.value === 'bad' ? 'Daily limit (optional)' : 'Daily goal (optional)';
}

dialog.querySelector('[name=kind]').addEventListener('change', (e) => toggleTargetLabel(e.target.form));

dialog.querySelector('form').addEventListener('submit', (e) => {
  const f = e.target;
  if (f.returnValue === 'cancel') return;
  const name = f.name.value.trim();
  if (!name) { e.preventDefault(); return; }
  const kind = f.kind.value;
  const num = f.target.value === '' ? null : Math.max(0, parseInt(f.target.value, 10) || 0);
  const editId = dialog.dataset.editId;
  if (editId) {
    state.counters = state.counters.map((c) => c.id === editId
      ? { ...c, name, kind, goal: kind === 'good' ? num : null, limit: kind === 'bad' ? num : null }
      : c);
  } else {
    state = createCounter(state, { name, kind, goal: kind === 'good' ? num : null, limit: kind === 'bad' ? num : null });
  }
  persist(); renderCounters();
});

document.getElementById('deleteBtn').addEventListener('click', () => {
  const editId = dialog.dataset.editId;
  state.counters = state.counters.filter((c) => c.id !== editId);
  delete state.history[editId];
  persist(); renderCounters(); dialog.close();
});

// ---- tab switching ----
function show(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
    t.classList.add('on');
    show(t.dataset.tab === 'count' ? 'v-count' : 'v-breathe');
  });
});

// greeting by time
const h = new Date().getHours();
const greetEl = document.getElementById('greetLine');
if (greetEl) greetEl.textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
const dateEl = document.getElementById('greetDate');
if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// boot
renderCounters();
initBreathe(() => state);

export { show };
```

- [ ] **Step 2: Add the dialog + a couple of ids to `index.html`**

Inside `#v-count`, ensure the greeting date element has `id="greetDate"` and the greeting line has `id="greetLine"`. Before the closing `</div>` of `.phone` (a modal can live anywhere in body), add:

```html
<dialog id="counterDialog" class="sheet">
  <form method="dialog">
    <h3>Counter</h3>
    <label>Name<input name="name" maxlength="24" required></label>
    <label>Type
      <select name="kind">
        <option value="good">Good habit (build up)</option>
        <option value="bad">Cutting down (limit)</option>
      </select>
    </label>
    <label id="targetLabel">Daily goal (optional)<input name="target" type="number" min="0" inputmode="numeric"></label>
    <menu>
      <button value="cancel" type="submit" class="btn-ghost">Cancel</button>
      <button value="save" type="submit" class="btn-primary">Save</button>
    </menu>
    <button type="button" id="deleteBtn" class="btn-danger">Delete counter</button>
  </form>
</dialog>
```

- [ ] **Step 3: Add dialog + empty-state styles to `css/styles.css`**

```css
.card-edit{margin-top:10px;text-align:right}
.edit-link{background:none;border:none;color:var(--ink-faint);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
.empty{color:var(--ink-soft);text-align:center;padding:40px 10px;font-size:15px}
.sheet{border:none;border-radius:24px;padding:22px;max-width:320px;width:88%;background:var(--surface);color:var(--ink);box-shadow:var(--shadow)}
.sheet::backdrop{background:rgba(0,0,0,.35)}
.sheet h3{font-size:18px;margin-bottom:16px}
.sheet label{display:block;font-size:13px;color:var(--ink-soft);font-weight:600;margin-bottom:14px}
.sheet input,.sheet select{width:100%;margin-top:6px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);font-size:16px;font-family:inherit}
.sheet menu{display:flex;gap:10px;margin:6px 0 0;padding:0}
.sheet menu button{flex:1;padding:13px;border-radius:14px;border:none;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}
.btn-primary{background:var(--spruce);color:#fff}
.btn-ghost{background:var(--surface-2);color:var(--ink-soft)}
.btn-danger{width:100%;margin-top:14px;padding:12px;border:none;border-radius:14px;background:transparent;color:var(--rose);font-weight:600;cursor:pointer;font-family:inherit}
:root[data-theme="dark"] .btn-primary{color:#0c1110}
@media(prefers-color-scheme:dark){.btn-primary{color:#0c1110}}
```

- [ ] **Step 4: Verify in browser**

Run: `npm run serve` → http://localhost:8080
Manual checks:
- Start empty → shows empty state.
- Add a good counter "Pushups" goal 20 → card appears, +1/− work, number persists after refresh.
- Add a bad counter "Cigarettes" limit 5 → rose card, shows "of 5 limit ✓", turns "· over" past 5.
- Edit renames; Delete removes and survives refresh.
Expected: all pass, no console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html css/styles.css js/app.js
git commit -m "feat: count tab — render, +/-, add/edit/delete, persistence"
```

---

### Task 9: Stats view wiring

**Files:**
- Create: `js/stats.js`
- Reference: `js/logic.js`

**Interfaces:**
- Consumes: `goodStreak`, `underLimitStreak`, `allTimeTotal`, `weeklySeries`, `monthlySeries`, `todayKey`.
- Produces: `openStats(state, counterId)` — fills the `#v-stats` view (name, two tiles, weekly/monthly toggle, bars) and shows it; wires Back and the Weekly/Monthly segment; bars coloured by kind. Imported by `app.js` (Task 8 already imports it).

- [ ] **Step 1: Implement `js/stats.js`**

```javascript
import { goodStreak, underLimitStreak, allTimeTotal, weeklySeries, monthlySeries, todayKey } from './logic.js';

let current = null; // { counter, days }

function drawBars(series, kind) {
  const wrap = document.getElementById('chartBars');
  const month = series.length > 7;
  wrap.className = 'bars' + (month ? ' month' : '') + (kind === 'bad' ? ' bad' : '');
  const max = Math.max(1, ...series.map((d) => d.value));
  wrap.innerHTML = '';
  series.forEach((d) => {
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.innerHTML = `<span style="height:0"></span>${d.label ? `<b>${d.label}</b>` : ''}`;
    wrap.appendChild(bar);
    requestAnimationFrame(() => { bar.querySelector('span').style.height = (8 + (d.value / max) * 92) + '%'; });
  });
}

function renderChart(mode) {
  const { counter, days } = current;
  const week = mode === 'week';
  document.getElementById('segWeek').classList.toggle('on', week);
  document.getElementById('segMonth').classList.toggle('on', !week);
  const series = week ? weeklySeries(days) : monthlySeries(days);
  const title = counter.kind === 'bad'
    ? (week ? `This week · limit ${counter.limit ?? '—'}/day` : 'Last 30 days · trending down')
    : (week ? 'This week' : 'Last 30 days');
  document.getElementById('chartTitle').textContent = title;
  drawBars(series, counter.kind);
}

export function openStats(state, counterId) {
  const counter = state.counters.find((c) => c.id === counterId);
  const days = state.history[counterId] || {};
  current = { counter, days };
  document.getElementById('statsName').textContent = counter.name;
  if (counter.kind === 'bad') {
    document.getElementById('stStreakK').textContent = 'Under limit';
    document.getElementById('stStreak').innerHTML = `${underLimitStreak(days, counter.limit ?? Infinity, todayKey())} <small>days</small>`;
    document.getElementById('stTotalK').textContent = 'All-time total';
    document.getElementById('stTotal').textContent = allTimeTotal(state, counterId).toLocaleString();
  } else {
    document.getElementById('stStreakK').textContent = 'Streak';
    document.getElementById('stStreak').innerHTML = `${goodStreak(days, todayKey())} <small>days</small>`;
    document.getElementById('stTotalK').textContent = 'All-time total';
    document.getElementById('stTotal').textContent = allTimeTotal(state, counterId).toLocaleString();
  }
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('v-stats').classList.add('active');
  renderChart('week');
}

document.getElementById('statsBack').addEventListener('click', () => {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('v-count').classList.add('active');
});
document.getElementById('segWeek').addEventListener('click', () => renderChart('week'));
document.getElementById('segMonth').addEventListener('click', () => renderChart('month'));
```

- [ ] **Step 2: Verify in browser**

Run: `npm run serve` → add a good and a bad counter, tap +1 a few times, open **Stats ›** on each.
Expected: good shows Streak + total, honey bars; bad shows Under-limit streak, rose bars; Weekly/Monthly toggle works; Back returns to Count. No console errors.

- [ ] **Step 3: Commit**

```bash
git add js/stats.js
git commit -m "feat: per-counter stats view (streaks, totals, weekly/monthly charts)"
```

---

### Task 10: Breathe tab + session engine

**Files:**
- Create: `js/breathe-ui.js`
- Reference: `js/breathing.js`, `docs/mockup-reference.html` (session engine is the source of truth)

**Interfaces:**
- Consumes: `PRESETS`, `roundSeconds`, `sessionSeconds`, `scaleForPhase` from `js/breathing.js`.
- Produces: `initBreathe(getState)` — renders pattern chips (presets + Custom), length options (2/5/10 min, 6 rounds), Start button; runs the session overlay with the growing/shrinking circle, phase word + countdown, the depleting time ring, and Pause/End. Imported by `app.js` (Task 8 already calls `initBreathe`).

- [ ] **Step 1: Implement `js/breathe-ui.js`**

Port the session engine from `docs/mockup-reference.html` (the `startSession`/`runStep`/`updateTime`/`updateRing`/`endSession` block and the pattern-chip + duration rendering), adapted to import from `js/breathing.js` and read the custom pattern from inputs. Full code:

```javascript
import { PRESETS, roundSeconds, sessionSeconds, scaleForPhase } from './breathing.js';

const CIRC = 2 * Math.PI * 132;

export function initBreathe() {
  const chipWrap = document.getElementById('patternChips');
  const patterns = [...PRESETS, { id: 'custom', name: 'Custom', steps: [['Breathe in', 4], ['Hold', 2], ['Breathe out', 6], ['Hold', 0]] }];
  let selPattern = 0;

  patterns.forEach((p, i) => {
    const c = document.createElement('button');
    c.className = 'chip' + (i === 0 ? ' sel' : '');
    const lbl = p.name === 'Custom' ? 'Set your own seconds' : p.steps.map((s) => s[1]).join('–') + ' sec';
    c.innerHTML = `<div class="cn">${p.name}</div><div class="cp">${lbl}</div>`;
    c.addEventListener('click', () => {
      selPattern = i;
      document.querySelectorAll('.chip').forEach((x) => x.classList.remove('sel'));
      c.classList.add('sel');
      document.getElementById('customRow').style.display = p.id === 'custom' ? 'flex' : 'none';
    });
    chipWrap.appendChild(c);
  });

  document.getElementById('durRow').addEventListener('click', (e) => {
    const d = e.target.closest('.dur'); if (!d) return;
    document.querySelectorAll('.dur').forEach((x) => x.classList.remove('sel'));
    d.classList.add('sel');
  });

  const session = document.getElementById('session');
  const circle = document.getElementById('circle');
  const phaseWord = document.getElementById('phaseWord');
  const phaseCount = document.getElementById('phaseCount');
  const sessTime = document.getElementById('sessTime');
  const progFill = document.getElementById('progFill');
  progFill.style.strokeDasharray = CIRC;

  let timer = null, tick = null, paused = false, remaining = 120, total = 120, curSteps = [], si = 0, secLeft = 0;
  const updateRing = () => { progFill.style.strokeDashoffset = CIRC * (1 - Math.max(remaining, 0) / total); };
  const updateTime = () => {
    const m = Math.floor(Math.max(remaining, 0) / 60), s = Math.max(remaining, 0) % 60;
    sessTime.textContent = `${m}:${s < 10 ? '0' : ''}${s} left`;
    updateRing();
  };

  function customSteps() {
    const v = (id) => Math.max(0, parseInt(document.getElementById(id).value, 10) || 0);
    return [['Breathe in', v('cin')], ['Hold', v('ch1')], ['Breathe out', v('cout')], ['Hold', v('ch2')]];
  }

  function runStep() {
    if (si >= curSteps.length) si = 0;
    const [word, secs] = curSteps[si];
    if (secs <= 0) { si++; return runStep(); }
    phaseWord.textContent = word; secLeft = secs; phaseCount.textContent = secs;
    const target = scaleForPhase(word);
    if (target !== null) { circle.style.transition = `transform ${secs}s cubic-bezier(.4,0,.4,1)`; circle.style.transform = `scale(${target})`; }
    else { circle.style.transition = 'transform .3s ease'; }
    timer = setTimeout(() => { si++; runStep(); }, secs * 1000);
  }

  function startSession() {
    const p = patterns[selPattern];
    curSteps = (p.id === 'custom' ? customSteps() : p.steps).filter((s) => s[1] > 0);
    if (curSteps.length === 0) return;
    si = 0; paused = false;
    document.getElementById('sessName').textContent = p.name === 'Custom' ? 'Custom pattern' : p.name;
    const durBtn = document.querySelector('.dur.sel');
    remaining = durBtn.dataset.rounds
      ? +durBtn.dataset.rounds * roundSeconds(curSteps)
      : sessionSeconds(curSteps, { minutes: +durBtn.dataset.min });
    total = remaining;
    progFill.style.transition = 'none'; updateRing();
    requestAnimationFrame(() => { progFill.style.transition = 'stroke-dashoffset 1s linear'; });
    updateTime(); session.classList.add('on'); runStep();
    tick = setInterval(() => {
      if (paused) return;
      remaining--; secLeft--;
      if (secLeft >= 0) phaseCount.textContent = secLeft;
      if (remaining <= 0) endSession();
      updateTime();
    }, 1000);
  }

  function endSession() {
    clearTimeout(timer); clearInterval(tick);
    circle.style.transition = 'transform .6s ease'; circle.style.transform = 'scale(1)';
    session.classList.remove('on');
    progFill.style.transition = 'none'; progFill.style.strokeDashoffset = 0;
  }

  document.getElementById('startBtn').addEventListener('click', startSession);
  document.getElementById('stopBtn').addEventListener('click', endSession);
  document.getElementById('pauseBtn').addEventListener('click', function () {
    paused = !paused; this.textContent = paused ? 'Resume' : 'Pause';
    if (paused) { clearTimeout(timer); const cs = getComputedStyle(circle).transform; circle.style.transition = 'none'; circle.style.transform = cs; }
    else runStep();
  });
}
```

- [ ] **Step 2: Add the custom-inputs row to `index.html`** (inside `#v-breathe`, right after `patternChips`, before the Length label)

```html
<div class="dur-row" id="customRow" style="display:none">
  <label class="cinp">In<input id="cin" type="number" min="0" value="4"></label>
  <label class="cinp">Hold<input id="ch1" type="number" min="0" value="2"></label>
  <label class="cinp">Out<input id="cout" type="number" min="0" value="6"></label>
  <label class="cinp">Hold<input id="ch2" type="number" min="0" value="0"></label>
</div>
```

Add CSS to `css/styles.css`:
```css
.cinp{flex:1;font-size:11px;color:var(--ink-faint);font-weight:600;text-align:center}
.cinp input{width:100%;margin-top:4px;padding:8px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--ink);font-size:16px;text-align:center;font-family:inherit}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run serve` → Breathe tab.
Manual checks:
- Chips select; picking **Custom** reveals the four second-inputs.
- Pick 2 min → **Begin** → circle grows on "Breathe in", holds, shrinks on "Breathe out"; phase word + countdown update; **outer ring empties** as the 2:00 counts down.
- Pause freezes circle + time + ring; Resume continues; End returns to setup and resets the circle.
Expected: all pass, no console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html css/styles.css js/breathe-ui.js
git commit -m "feat: breathe tab — patterns, custom, session circle + time ring"
```

---

### Task 11: PWA — manifest, icons, service worker, offline

**Files:**
- Create: `manifest.webmanifest`
- Create: `service-worker.js`
- Create: `icons/icon-180.png`, `icons/icon-192.png`, `icons/icon-512.png`
- Modify: `index.html` (register service worker)

**Interfaces:**
- Produces: an installable, offline-capable app. `manifest` gives name/icons/standalone display; `service-worker` caches the app shell (`index.html`, css, all js, manifest, icons) for offline use.

- [ ] **Step 1: Create `manifest.webmanifest`**

```json
{
  "name": "Breathe & Count",
  "short_name": "Breathe",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#F3F1EA",
  "theme_color": "#F3F1EA",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 2: Generate icon PNGs with PowerShell (`System.Drawing`, no installs)**

Run this in PowerShell from the project root (creates a calm spruce rounded square with a light breathing circle):

```powershell
Add-Type -AssemblyName System.Drawing
function New-Icon($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $bg = [System.Drawing.ColorTranslator]::FromHtml('#2F5F58')
  $g.Clear($bg)
  $r = $size * 0.30
  $c = $size / 2
  $mist = [System.Drawing.ColorTranslator]::FromHtml('#9FD0C2')
  $brush = New-Object System.Drawing.SolidBrush($mist)
  $g.FillEllipse($brush, ($c - $r), ($c - $r), (2 * $r), (2 * $r))
  $pen = New-Object System.Drawing.Pen(([System.Drawing.ColorTranslator]::FromHtml('#E4F0EB')), ($size*0.02))
  $r2 = $size * 0.40
  $g.DrawEllipse($pen, ($c - $r2), ($c - $r2), (2 * $r2), (2 * $r2))
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
New-Icon 180 "icons/icon-180.png"
New-Icon 192 "icons/icon-192.png"
New-Icon 512 "icons/icon-512.png"
Write-Host "icons created"
```

Expected: three PNG files exist in `icons/`.

- [ ] **Step 3: Create `service-worker.js`**

```javascript
const CACHE = 'breathe-count-v1';
const ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/logic.js',
  './js/storage.js',
  './js/breathing.js',
  './js/breathe-ui.js',
  './js/stats.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
```

- [ ] **Step 4: Register the service worker in `index.html`** (just before the closing `</body>` / after the app.js module script)

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
  }
</script>
```

- [ ] **Step 5: Verify install + offline in browser**

Run: `npm run serve` → http://localhost:8080
- Open DevTools → Application: manifest shows name + icons; service worker is "activated".
- Load once, then in DevTools Network set **Offline** and reload → app still loads and works (counters + breathing).
Expected: offline reload succeeds; no console errors.

- [ ] **Step 6: Commit**

```bash
git add manifest.webmanifest service-worker.js icons index.html
git commit -m "feat: PWA — manifest, icons, offline service worker"
```

---

### Task 12: Full-bleed on installed app + end-to-end pass + docs

**Files:**
- Modify: `css/styles.css` (installed app fills the screen; phone frame only for desktop dev)
- Modify: `README.md` (final install steps)

**Interfaces:**
- Produces: when launched from the Home Screen (standalone display-mode) the app fills the whole screen; in a normal browser tab it keeps the phone frame for dev. Final README with the exact install walkthrough.

- [ ] **Step 1: Add standalone/full-bleed CSS** to `css/styles.css`

```css
/* When installed to Home Screen (standalone), drop the phone frame and fill the screen */
@media (display-mode: standalone){
  body{padding:0;background:var(--phone)}
  .page-head,.hint{display:none}
  .phone{width:100%;height:100vh;max-height:none;border-radius:0;box-shadow:none}
  .island{display:none}
  .statusbar{display:none}
}
```

- [ ] **Step 2: Update README install section** with the finalized steps (host → Safari → Add to Home Screen → launch), and note data is per-device.

- [ ] **Step 3: Full end-to-end verification**

Run: `npm test` (all suites PASS) and `npm run serve`, then walk the whole app:
- Create good + bad counters, increment, edit, delete — persists across refresh.
- Stats for both kinds; weekly/monthly.
- Breathe: preset + custom, minutes + rounds, ring depletes, pause/resume/end.
- Offline reload still works.
Expected: everything passes; no console errors.

- [ ] **Step 4: Commit**

```bash
git add css/styles.css README.md
git commit -m "feat: full-bleed installed layout + finalized docs"
```

---

## Self-Review notes

- **Spec coverage:** PWA/offline/on-device (Tasks 7,11,12); counters good/bad + add/edit/delete + daily-reset-by-date-key (Tasks 2,8); stats streak/total/weekly/monthly incl. under-limit streak (Tasks 3,4,9); breathe presets+custom, minutes/rounds, circle + phase word + **time ring**, pause/end (Tasks 5,10); look & feel + light/dark fidelity (Task 7 port); hosting/install (Tasks 11,12 + README). Covered.
- **Types consistent:** `state = { counters, history }`; `history[id][YYYY-MM-DD] = number`; streak fns take the `days` map (not whole state); series items `{key,label?,value}`; breathing steps `[[word,secs]]`. Used consistently across tasks.
- **No placeholders:** every code step contains full code; verification steps are manual browser checks because the UI has no headless harness (logic is fully covered by `node:test`).
