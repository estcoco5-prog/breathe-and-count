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
