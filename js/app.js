import { load, save } from './storage.js';
import { createCounter, getToday, increment, decrement } from './logic.js';
import { openStats } from './stats.js';
import { initBreathe } from './breathe-ui.js';

let state = load();
const listEl = document.getElementById('counterList');

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function counterCard(c) {
  const val = getToday(state, c.id);
  const isBad = c.kind === 'bad';
  const goalTxt = isBad
    ? (c.limit != null ? (val <= c.limit ? `of ${c.limit} limit ✓` : `of ${c.limit} limit · over`) : 'today')
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
  if (state.counters.length === 0) {
    listEl.innerHTML = '<div class="empty">No counters yet.<br>Tap “New counter” to add one.</div>';
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

// ---- add / edit dialog ----
const dialog = document.getElementById('counterDialog');
const form = dialog.querySelector('form');
document.getElementById('addBtn').addEventListener('click', () => openCounterForm(null));

function openCounterForm(existing) {
  form.elements.name.value = existing ? existing.name : '';
  form.elements.kind.value = existing ? existing.kind : 'good';
  const t = existing ? (existing.kind === 'bad' ? existing.limit : existing.goal) : null;
  form.elements.target.value = t == null ? '' : t;
  dialog.dataset.editId = existing ? existing.id : '';
  toggleTargetLabel();
  document.getElementById('deleteBtn').style.display = existing ? 'block' : 'none';
  dialog.showModal();
}

function toggleTargetLabel() {
  document.getElementById('targetLabel').childNodes[0].nodeValue =
    form.elements.kind.value === 'bad' ? 'Daily limit (optional)' : 'Daily goal (optional)';
}
form.elements.kind.addEventListener('change', toggleTargetLabel);

form.addEventListener('submit', (e) => {
  const action = e.submitter && e.submitter.value;
  if (action === 'cancel') return; // dialog closes; make no changes
  const name = form.elements.name.value.trim();
  if (!name) { e.preventDefault(); return; }
  const kind = form.elements.kind.value;
  const raw = form.elements.target.value;
  const num = raw === '' ? null : Math.max(0, parseInt(raw, 10) || 0);
  const editId = dialog.dataset.editId;
  if (editId) {
    state.counters = state.counters.map((c) => c.id === editId
      ? { ...c, name, kind, goal: kind === 'good' ? num : null, limit: kind === 'bad' ? num : null }
      : c);
  } else {
    state = createCounter(state, { name, kind, goal: kind === 'good' ? num : null, limit: kind === 'bad' ? num : null });
  }
  persist();
  renderCounters();
});

document.getElementById('deleteBtn').addEventListener('click', () => {
  const editId = dialog.dataset.editId;
  state.counters = state.counters.filter((c) => c.id !== editId);
  delete state.history[editId];
  persist();
  renderCounters();
  dialog.close();
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

// ---- greeting ----
const h = new Date().getHours();
document.getElementById('greetLine').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
document.getElementById('greetDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

// ---- boot ----
renderCounters();
initBreathe();
