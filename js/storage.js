// Thin persistence layer over localStorage. Store is injectable for tests.
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
