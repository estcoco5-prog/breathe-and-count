import { load, save } from './storage.js';
import { createCounter, getToday, increment, decrement, todayKey, gridCells, hasLimit } from './logic.js';
import { openStats } from './stats.js';
import { initBreathe } from './breathe-ui.js';
import { initTargets, renderTargets } from './targets.js';
import { initBackup } from './backup.js';
import { renderCal } from './grid.js';

let state = load();
const listEl = document.getElementById('counterList');
const el = (id) => document.getElementById(id);

const isTargetKind = (k) => k === 'build' || k === 'avoid';
const getState = () => state;
const setState = (next) => { state = next; save(state); };

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function startOf(counter, days) {
  if (counter.createdAt) return todayKey(new Date(counter.createdAt));
  const keys = Object.keys(days || {}).sort();
  return keys.length ? keys[0] : todayKey();
}

// ---- count cards --------------------------------------------------------

function counterCard(c) {
  const val = getToday(state, c.id);
  const isBad = c.kind === 'bad';
  const goalTxt = isBad
    ? (hasLimit(c) ? (val <= c.limit ? `of ${c.limit} limit ✓` : `of ${c.limit} limit · over`) : 'today')
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

function renderCounters() {
  const counts = state.counters.filter((c) => !isTargetKind(c.kind));
  if (counts.length === 0) {
    listEl.innerHTML = '<div class="empty">No counters yet.<br>Tap “New counter” to add one.</div>';
    return;
  }
  listEl.innerHTML = counts.map(counterCard).join('');
}

function renderAll() {
  renderCounters();
  renderTargets();
}

listEl.addEventListener('click', (e) => {
  const inc = e.target.closest('[data-inc]');
  const dec = e.target.closest('[data-dec]');
  const st = e.target.closest('[data-stats]');
  const ed = e.target.closest('[data-edit]');
  if (inc) { setState(increment(state, inc.dataset.inc)); renderCounters(); }
  else if (dec) { setState(decrement(state, dec.dataset.dec)); renderCounters(); }
  else if (st) { openStats(state, st.dataset.stats, 'v-count'); }
  else if (ed) { openCounterForm(state.counters.find((c) => c.id === ed.dataset.edit)); }
});

// ---- add / edit dialog --------------------------------------------------

const dialog = el('counterDialog');
const form = dialog.querySelector('form');
el('addBtn').addEventListener('click', () => openCounterForm(null, 'good'));
el('addTargetBtn').addEventListener('click', () => openCounterForm(null, 'build'));

function openCounterForm(existing, defaultKind = 'good') {
  form.elements.name.value = existing ? existing.name : '';
  form.elements.kind.value = existing ? existing.kind : defaultKind;
  const t = existing ? (existing.kind === 'bad' ? existing.limit : existing.goal) : null;
  form.elements.target.value = t == null ? '' : t;
  dialog.dataset.editId = existing ? existing.id : '';
  dialog.dataset.wasKind = existing ? existing.kind : '';
  el('dialogTitle').textContent = existing ? 'Edit' : (isTargetKind(defaultKind) ? 'New target' : 'New counter');
  el('deleteBtn').style.display = existing ? 'block' : 'none';
  el('deleteBtn').textContent = existing && isTargetKind(existing.kind) ? 'Delete target' : 'Delete counter';
  refreshKindFields();
  dialog.showModal();
}

// The goal/limit box only makes sense for a count. A target has neither.
function refreshKindFields() {
  const kind = form.elements.kind.value;
  const targetLabel = el('targetLabel');
  targetLabel.hidden = isTargetKind(kind);
  if (!isTargetKind(kind)) {
    targetLabel.childNodes[0].nodeValue = kind === 'bad' ? 'Daily limit (optional)' : 'Daily goal (optional)';
  }
  refreshConvertNote();
}

// When an existing counter is about to change family, show exactly what its
// day-by-day history will look like afterwards.
function refreshConvertNote() {
  const note = el('convertNote');
  const id = dialog.dataset.editId;
  const was = dialog.dataset.wasKind;
  const now = form.elements.kind.value;
  if (!id || !was || isTargetKind(was) === isTargetKind(now)) { note.hidden = true; return; }

  const counter = state.counters.find((c) => c.id === id);
  const days = state.history[id] || {};
  const cells = gridCells(days, startOf(counter, days), todayKey(), 7).filter((c) => !c.blank);
  const goal = counter.kind === 'bad' ? counter.limit : counter.goal;

  const before = isTargetKind(was)
    ? renderCal(cells, { mode: was === 'build' ? 'done' : 'clean', dates: true })
    : renderCal(cells, { mode: 'count', goal });
  const after = isTargetKind(now)
    ? renderCal(cells, { mode: now === 'build' ? 'done' : 'clean' })
    : renderCal(cells, { mode: 'count', goal: null });

  el('convBeforeLbl').textContent = `Before · as a ${isTargetKind(was) ? 'target' : 'count'}`;
  el('convAfterLbl').textContent = `After · as ${now === 'build' ? 'build momentum' : now === 'avoid' ? 'will not do' : 'a count'}`;
  el('convBefore').innerHTML = before;
  el('convAfter').innerHTML = after;
  el('convText').textContent = now === 'avoid'
    ? 'Any day you counted 1 or more becomes a slip. Days at 0 become clean days. Your original numbers are kept, so switching the type back restores them exactly.'
    : now === 'build'
      ? 'Any day you counted 1 or more becomes a day you did it. Days at 0 become missed days. Your original numbers are kept, so switching the type back restores them exactly.'
      : 'Each marked day becomes a count of 1. Any numbers you had before this was a target are still there.';
  note.hidden = false;
}

form.elements.kind.addEventListener('change', refreshKindFields);

form.addEventListener('submit', (e) => {
  const action = e.submitter && e.submitter.value;
  if (action === 'cancel') return; // dialog closes; make no changes
  const name = form.elements.name.value.trim();
  if (!name) { e.preventDefault(); return; }
  const kind = form.elements.kind.value;
  const raw = form.elements.target.value;
  const num = raw === '' || isTargetKind(kind) ? null : Math.max(0, parseInt(raw, 10) || 0);
  const editId = dialog.dataset.editId;
  if (editId) {
    // Only these fields change. `history` is keyed by id and is never touched.
    state.counters = state.counters.map((c) => (c.id === editId
      ? { ...c, name, kind, goal: kind === 'good' ? num : null, limit: kind === 'bad' ? num : null }
      : c));
    save(state);
  } else {
    setState(createCounter(state, { name, kind, goal: kind === 'good' ? num : null, limit: kind === 'bad' ? num : null }));
  }
  renderAll();
});

el('deleteBtn').addEventListener('click', () => {
  const editId = dialog.dataset.editId;
  const counter = state.counters.find((c) => c.id === editId);
  if (!window.confirm(`Delete “${counter ? counter.name : 'this'}” and every day recorded for it?`)) return;
  state.counters = state.counters.filter((c) => c.id !== editId);
  delete state.history[editId];
  save(state);
  renderAll();
  dialog.close();
});

// ---- tabs ---------------------------------------------------------------

const VIEW = { count: 'v-count', target: 'v-target', breathe: 'v-breathe' };

function show(id) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  el(id).classList.add('active');
}

document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('on'));
    t.classList.add('on');
    if (t.dataset.tab === 'target') renderTargets();
    show(VIEW[t.dataset.tab]);
  });
});

// ---- greeting -----------------------------------------------------------

const h = new Date().getHours();
el('greetLine').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
el('greetDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// ---- boot ---------------------------------------------------------------

initTargets({ getState, setState, openStats, openEdit: openCounterForm });
initBackup({ getState, setState, onRestored: renderAll });
renderAll();
initBreathe();
