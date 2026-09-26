// Thin persistence layer over localStorage. Store is injectable for tests.
import { emptyState, migrate } from './logic.js';

export const STATE_KEY = 'bc_state';
export const BACKUP_KEY = 'bc_state_backup_v1';
export const SALVAGE_PREFIX = 'bc_state_unreadable_';

export { migrate };

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
    // Never write over text we cannot read: set it aside under its own key so
    // it can still be recovered by hand.
    try { store.setItem(SALVAGE_PREFIX + Date.now(), raw); } catch { /* storage blocked */ }
    return emptyState();
  }

  // One-time safety copy of the pre-v2 data, before anything can overwrite it.
  try {
    if (parsed.version === undefined && store.getItem(BACKUP_KEY) === null) {
      store.setItem(BACKUP_KEY, raw);
    }
  } catch { /* a failed backup must never stop the app loading */ }

  return migrate(parsed);
}

export function save(state, store = globalThis.localStorage) {
  store.setItem(STATE_KEY, JSON.stringify(state));
}

// ---- taking a copy out, and putting one back ----------------------------

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

// Returns either { ok: true, state } or { ok: false, reason } — never a
// half-applied state. The caller decides whether to save it.
export function importState(text) {
  let parsed = null;
  try {
    parsed = JSON.parse(String(text).trim());
  } catch {
    return { ok: false, reason: 'That text is not readable as saved data. Paste the whole thing, including the first { and the last }.' };
  }
  if (!looksLikeState(parsed)) {
    return { ok: false, reason: 'That is readable text, but it is not a Breathe & Count backup - it has no list of counters and days.' };
  }
  if (parsed.counters.length === 0) {
    return { ok: false, reason: 'That backup has no counters in it, so restoring it would leave you with nothing. Nothing was changed.' };
  }
  return { ok: true, state: migrate(parsed) };
}
