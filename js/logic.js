// Pure domain logic — no DOM, no storage. Fully unit-tested with node:test.

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isNewDay(lastKey, date = new Date()) {
  return lastKey !== todayKey(date);
}

export const STATE_VERSION = 2;

// 'good'/'bad' live in the Count tab and store how many times, per day.
// 'build'/'avoid' live in the Target tab and store 1 or 0 for a day.
export const KINDS = ['good', 'bad', 'build', 'avoid'];

export function emptyState() {
  return { version: STATE_VERSION, counters: [], history: {} };
}

// A v1 state has no `version`. Stamping it is the ONLY change made: counters,
// kinds, goals, limits and every day's number are left exactly as they were.
export function migrate(state) {
  return {
    ...state,
    version: STATE_VERSION,
    counters: (state.counters || []).map((c) => (KINDS.includes(c.kind) ? c : { ...c, kind: 'good' })),
    history: state.history || {},
  };
}

function clone(state) {
  return {
    ...state,
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

// ---- targets: a day is marked (1) or not (0) ----------------------------
// A pre-existing count of 3 reads as "marked", which is what lets a counter
// become a target without its history being rewritten.

export function isMarked(state, id, key = todayKey()) {
  return getToday(state, id, key) >= 1;
}

export function markDay(state, id, key = todayKey()) { return setDay(state, id, key, 1); }
export function unmarkDay(state, id, key = todayKey()) { return setDay(state, id, key, 0); }

export function toggleDay(state, id, key = todayKey()) {
  return isMarked(state, id, key) ? unmarkDay(state, id, key) : markDay(state, id, key);
}

export function allTimeTotal(state, id) {
  const days = state.history[id] || {};
  return Object.values(days).reduce((a, b) => a + num(b), 0);
}

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
  // Missing day -> 0, which is not >=1, so the walk terminates naturally.
  return walkStreak(days, todayK, (v) => (v || 0) >= 1);
}

// A "cutting down" day qualifies when its count is <= limit. Because a missing
// day counts as 0 (always <= limit), the walk MUST be bounded by startKey (the
// counter's creation date) or it would run backwards forever.
export function underLimitStreak(days, limit, todayK = todayKey(), startKey = todayK) {
  const q = (v) => (v || 0) <= limit;
  let key = todayK;
  let count = 0;
  if (!q(days[todayK])) key = prevKey(todayK); // grace: an unlogged/over today doesn't break yesterday's streak
  while (key >= startKey && q(days[key])) {
    count += 1;
    key = prevKey(key);
  }
  return count;
}

// Consecutive marked days ending today. An unmarked today does NOT break
// yesterday's streak — the day is not over yet.
export function buildStreak(days, todayK = todayKey(), startKey = todayK) {
  let key = todayK;
  let count = 0;
  if (!((days[todayK] || 0) >= 1)) key = prevKey(todayK);
  while (key >= startKey && (days[key] || 0) >= 1) {
    count += 1;
    key = prevKey(key);
  }
  return count;
}

// Consecutive UNMARKED days ending today. A slip today resets it to zero —
// no grace, unlike underLimitStreak. A missing day counts as clean, so this
// MUST be bounded by startKey or it would run backwards forever.
export function cleanStreak(days, todayK = todayKey(), startKey = todayK) {
  if ((days[todayK] || 0) >= 1) return 0;
  let key = todayK;
  let count = 0;
  while (key >= startKey && (days[key] || 0) < 1) {
    count += 1;
    key = prevKey(key);
  }
  return count;
}

// n days before the given key, as a key.
export function daysBack(key, n) {
  let out = key;
  for (let i = 0; i < n; i++) out = prevKey(out);
  return out;
}

// Every day key from startKey to todayK inclusive, oldest first.
function spanKeys(startKey, todayK) {
  const out = [];
  let key = todayK;
  while (key >= startKey) {
    out.push(key);
    key = prevKey(key);
  }
  return out.reverse();
}

// Every unbroken run of marked (or unmarked) days, longest first.
export function runList(days, startKey, todayK = todayKey(), wanted = true) {
  const runs = [];
  let length = 0;
  let endKey = null;
  spanKeys(startKey, todayK).forEach((key) => {
    if (((days[key] || 0) >= 1) === wanted) {
      length += 1;
      endKey = key;
    } else if (length) {
      runs.push({ length, endKey, current: false });
      length = 0;
      endKey = null;
    }
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

// Today is never a missed day: it is not over yet.
export function missedDays(days, startKey, todayK = todayKey()) {
  return spanKeys(startKey, todayK).filter((key) => key !== todayK && (days[key] || 0) < 1).length;
}

// A 'cutting down' counter with no limit has nothing to be under, so its
// under-limit streak is meaningless and the screen must say so instead.
export function hasLimit(counter) {
  return counter.kind === 'bad' && typeof counter.limit === 'number' && Number.isFinite(counter.limit);
}

// A stored day value should always be a number, but restored or hand-edited
// data may not be. Anything that is not a finite number counts as 0 rather
// than poisoning a total or a bar height with NaN.
function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function weekdayOf(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = Sunday
}

// The trailing n days as calendar cells, padded with blanks so that every row
// is 7 wide and each column is one weekday.
export function gridCells(days, startKey, todayK = todayKey(), n = 30) {
  const blank = () => ({ key: null, value: 0, dayOfMonth: null, blank: true, beforeStart: false, today: false });
  const window = [];
  let key = todayK;
  for (let i = 0; i < n; i++) {
    window.push(key);
    key = prevKey(key);
  }
  window.reverse();

  const cells = [];
  for (let i = 0; i < weekdayOf(window[0]); i++) cells.push(blank());
  window.forEach((k) => cells.push({
    key: k,
    value: num(days && days[k]),
    dayOfMonth: Number(k.slice(8)),
    blank: false,
    beforeStart: k < startKey,
    today: k === todayK,
  }));
  while (cells.length % 7) cells.push(blank());
  return cells;
}

// 0 = nothing counted, 4 = at or over the goal. With no goal set, any count
// is full strength: there is nothing to shade against.
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
  for (let i = 0; i < 7; i++) {
    sum += num(days && days[key]);
    key = prevKey(key);
  }
  return sum;
}

export function dailyAverage(days, startKey, todayK = todayKey()) {
  const keys = spanKeys(startKey, todayK);
  if (!keys.length) return 0;
  return Math.round(keys.reduce((a, k) => a + num(days && days[k]), 0) / keys.length);
}

export function daysAtGoal(days, startKey, todayK = todayKey(), goal = null) {
  if (!goal) return 0;
  return spanKeys(startKey, todayK).filter((k) => num(days && days[k]) >= goal).length;
}

const WEEKDAY_INITIAL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // Sun..Sat

function seriesEndingToday(days, todayK, n, withLabel) {
  const out = [];
  let key = todayK;
  for (let i = 0; i < n; i++) {
    const [y, m, d] = key.split('-').map(Number);
    const entry = { key, value: num(days && days[key]) };
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
