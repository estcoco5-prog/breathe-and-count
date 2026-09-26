// The Target tab: activities you are building, and activities you will not do.
// Both are counters with a different `kind`, so they share history with counts.
import {
  todayKey, daysBack, isMarked, toggleDay,
  buildStreak, cleanStreak, bestRun, markedDays, missedDays, gridCells,
} from './logic.js';
import { renderStrip } from './grid.js';

let ctx = null; // { getState, setState, openStats }

const el = (id) => document.getElementById(id);
const isTarget = (c) => c.kind === 'build' || c.kind === 'avoid';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function startOf(counter, days) {
  if (counter.createdAt) return todayKey(new Date(counter.createdAt));
  const keys = Object.keys(days || {}).sort();
  return keys.length ? keys[0] : todayKey();
}

const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>';

function card(state, counter, todayK) {
  const days = state.history[counter.id] || {};
  const start = startOf(counter, days);
  const build = counter.kind === 'build';
  const markedToday = isMarked(state, counter.id, todayK);

  const now = build ? buildStreak(days, todayK, start) : cleanStreak(days, todayK, start);
  const best = Math.max(bestRun(days, start, todayK, build), now);
  const done = markedDays(days, start, todayK);
  const missed = missedDays(days, start, todayK);
  // markedDays includes today; missedDays excludes it, so only add today back
  // when it is still unmarked.
  const span = done + missed + (markedToday ? 0 : 1);

  const lastQualifying = build && !markedToday ? daysBack(todayK, 1) : todayK;
  const runFrom = now > 0 ? daysBack(lastQualifying, now - 1) : null;
  const strip = renderStrip(gridCells(days, start, todayK, 7), { mode: build ? 'done' : 'clean', runFrom });

  const bigLabel = build
    ? (markedToday || now > 0 ? 'days in a row' : 'not yet today')
    : 'days clean';
  const subLabel = build
    ? `best ${best} · missed ${missed} of ${span}`
    : `best run ${best} · ${done} slip${done === 1 ? '' : 's'} ever`;

  let button;
  let hint = '';
  if (build) {
    button = markedToday
      ? `<button class="act done" data-mark="${counter.id}">${CHECK}Done today</button>`
      : `<button class="act todo" data-mark="${counter.id}">Mark today done</button>`;
    if (markedToday) hint = 'tap again to undo';
  } else {
    button = markedToday
      ? `<button class="act slipped" data-mark="${counter.id}">Slipped today</button>`
      : `<button class="act slipbtn" data-mark="${counter.id}">I slipped today</button>`;
    if (markedToday) hint = 'tap again to undo';
  }

  const tag = build
    ? '<span class="tag good">Build momentum</span>'
    : '<span class="tag bad">Will not do</span>';
  const bigColor = build && !markedToday && now === 0 ? 'var(--ink-faint)' : 'var(--spruce)';

  return `<div class="card${build ? '' : ' bad'}">
    <div class="top">
      <div><div class="name">${escapeHtml(counter.name)}</div>${tag}</div>
      <button class="stats-link" data-stats="${counter.id}">Stats ›</button>
    </div>
    <div class="count-row">
      <div class="bignum" style="color:${bigColor}">${now}</div>
      <div class="goaltag">${bigLabel}<br><span style="color:var(--ink-faint)">${subLabel}</span></div>
    </div>
    ${strip}
    ${button}
    <div class="foot"><span class="hintlet">${hint}</span>
      <button class="edit-link" data-edit="${counter.id}">Edit</button></div>
  </div>`;
}

function todayBand(state, targets, todayK) {
  if (!targets.length) return '';
  const builds = targets.filter((c) => c.kind === 'build');
  const avoids = targets.filter((c) => c.kind === 'avoid');
  const doneNow = builds.filter((c) => isMarked(state, c.id, todayK)).length;
  const cleanNow = avoids.filter((c) => !isMarked(state, c.id, todayK)).length;

  const dots = targets.map((c) => {
    const marked = isMarked(state, c.id, todayK);
    if (c.kind === 'build') return marked ? `<i class="on">${CHECK}</i>` : '<i class="off"></i>';
    return marked ? '<i class="off"></i>' : '<i class="clean"></i>';
  }).join('');

  const parts = [];
  if (builds.length) parts.push(`<b>${doneNow} of ${builds.length}</b> done`);
  if (avoids.length) parts.push(`<b>${cleanNow}</b> still clean`);

  return `<div class="hero-today">
    <div class="t"><div class="k">Today</div><div class="v">${parts.join(' · ')}</div></div>
    <div class="dots">${dots}</div>
  </div>`;
}

export function renderTargets() {
  const state = ctx.getState();
  const todayK = todayKey();
  const targets = state.counters.filter(isTarget);
  const builds = targets.filter((c) => c.kind === 'build');
  const avoids = targets.filter((c) => c.kind === 'avoid');

  el('targetToday').innerHTML = todayBand(state, targets, todayK);

  if (!targets.length) {
    el('targetList').innerHTML = '<div class="empty">No targets yet.<br>Add one you want to build up — or one you want to stop.</div>';
    return;
  }

  let html = '';
  if (builds.length) {
    html += '<div class="section-label"><i class="b"></i>Building momentum</div>';
    html += builds.map((c) => card(state, c, todayK)).join('');
  }
  if (avoids.length) {
    html += '<div class="section-label"><i class="a"></i>Not doing</div>';
    html += avoids.map((c) => card(state, c, todayK)).join('');
  }
  el('targetList').innerHTML = html;
}

export function initTargets(context) {
  ctx = context;
  el('targetDate').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  el('targetList').addEventListener('click', (e) => {
    const mark = e.target.closest('[data-mark]');
    const stats = e.target.closest('[data-stats]');
    const edit = e.target.closest('[data-edit]');
    if (mark) {
      ctx.setState(toggleDay(ctx.getState(), mark.dataset.mark));
      renderTargets();
    } else if (stats) {
      ctx.openStats(ctx.getState(), stats.dataset.stats, 'v-target');
    } else if (edit) {
      ctx.openEdit(ctx.getState().counters.find((c) => c.id === edit.dataset.edit));
    }
  });
}
