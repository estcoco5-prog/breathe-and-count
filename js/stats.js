import {
  goodStreak, underLimitStreak, buildStreak, cleanStreak, hasLimit,
  weeklySeries, gridCells, todayKey, daysBack,
  bestRun, runList, markedDays, missedDays, weekTotal, dailyAverage,
} from './logic.js';
import { renderCal, legend, runRows } from './grid.js';

let current = null; // { counter, days, backTo }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthName = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
const prettyDate = (key) => `${Number(key.slice(8))} ${monthName(key)}`;
const isTarget = (c) => c.kind === 'build' || c.kind === 'avoid';
const el = (id) => document.getElementById(id);

function startOf(counter, days) {
  if (counter.createdAt) return todayKey(new Date(counter.createdAt));
  const keys = Object.keys(days || {}).sort();
  return keys.length ? keys[0] : todayKey();
}

// ---- hero bands ---------------------------------------------------------

function ring(pct, color) {
  const C = 207.3; // 2 * pi * 33
  const off = Math.max(0, C * (1 - Math.min(1, pct)));
  return `<svg viewBox="0 0 80 80" width="74" height="74" aria-hidden="true">
    <circle cx="40" cy="40" r="33" fill="none" stroke="var(--surface-2)" stroke-width="9"></circle>
    <circle cx="40" cy="40" r="33" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 40 40)"></circle>
    <text x="40" y="45" text-anchor="middle" font-size="17" font-weight="600" fill="var(--ink)"
      font-family="-apple-system, system-ui, sans-serif">${Math.round(pct * 100)}%</text>
  </svg>`;
}

function countHero(counter, days, todayK) {
  const today = Number(days[todayK]) || 0;
  const target = counter.kind === 'bad' ? (hasLimit(counter) ? counter.limit : null) : counter.goal;
  const total = Object.values(days).reduce((a, b) => a + (Number(b) || 0), 0);
  const start = startOf(counter, days);

  let sub;
  if (counter.kind === 'good') {
    const n = goodStreak(days, todayK);
    sub = `${n} day${n === 1 ? '' : 's'} in a row · <b>${total.toLocaleString()}</b> all time`;
  } else if (hasLimit(counter)) {
    const n = underLimitStreak(days, counter.limit, todayK, start);
    sub = `${n} day${n === 1 ? '' : 's'} at or under your limit · <b>${total.toLocaleString()}</b> all time`;
  } else {
    sub = `No daily limit set — tap Edit to add one · <b>${total.toLocaleString()}</b> all time`;
  }

  const pct = target ? today / target : null;
  const color = counter.kind === 'bad' ? 'var(--rose)' : 'var(--count-4)';

  return `<div class="hero honey">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
      <div>
        <div class="eyebrow"><i></i>Today</div>
        <div class="bigrow">
          <div class="big">${today}</div>
          ${target ? `<div class="unit">of ${target}</div>` : ''}
        </div>
      </div>
      ${pct === null ? '' : ring(pct, color)}
    </div>
    <div class="sub">${sub}</div>
  </div>`;
}

function targetHero(counter, days, todayK) {
  const start = startOf(counter, days);
  const build = counter.kind === 'build';
  const now = build ? buildStreak(days, todayK, start) : cleanStreak(days, todayK, start);
  const best = Math.max(bestRun(days, start, todayK, build), now);

  let sub;
  if (build) {
    const lastDone = (Number(days[todayK]) || 0) >= 1 ? todayK : daysBack(todayK, 1);
    sub = now > 0
      ? `Unbroken since <b>${prettyDate(daysBack(lastDone, now - 1))}</b>`
      : 'Not started yet — today can be day one.';
  } else {
    const slipRuns = runList(days, start, todayK, true);
    const last = slipRuns.length ? slipRuns.map((r) => r.endKey).sort().pop() : null;
    if (!last) sub = 'No slips at all since you started.';
    else if (now === 0) sub = 'Slipped today — tomorrow can start a new run.';
    else sub = `Last slip <b>${prettyDate(last)}</b>`;
  }

  return `<div class="hero">
    <div class="eyebrow"><i></i>${build ? 'Streak right now' : 'Clean right now'}</div>
    <div class="bigrow"><div class="big">${now}</div><div class="unit">day${now === 1 ? '' : 's'}</div></div>
    <div class="sub">${sub}</div>
    <div class="track"><i style="width:${best ? Math.max(4, Math.round((now / best) * 100)) : 0}%"></i></div>
    <div class="ends"><span>${now} day${now === 1 ? '' : 's'} in</span><span>best ever ${best}</span></div>
  </div>`;
}

// ---- chips --------------------------------------------------------------

const chip = (value, label, cls = '') =>
  `<div class="chip ${cls}"><b>${value}</b><span>${label}</span></div>`;

function chipsFor(counter, days, todayK) {
  const start = startOf(counter, days);
  if (counter.kind === 'build') {
    return chip(bestRun(days, start, todayK, true), 'best streak')
      + chip(markedDays(days, start, todayK), 'days done', 'good')
      + chip(missedDays(days, start, todayK), 'days missed', 'bad');
  }
  if (counter.kind === 'avoid') {
    const slips = markedDays(days, start, todayK);
    const slippedToday = (Number(days[todayK]) || 0) >= 1;
    const span = missedDays(days, start, todayK) + slips + (slippedToday ? 0 : 1);
    return chip(bestRun(days, start, todayK, false), 'best run')
      + chip(slips, 'slips ever', 'bad')
      + chip(`${Math.round(((span - slips) / span) * 100)}%`, 'clean days', 'good');
  }
  if (counter.kind === 'good') {
    return chip(goodStreak(days, todayK), 'day streak', 'good')
      + chip(weekTotal(days, todayK), 'this week')
      + chip(dailyAverage(days, start, todayK), 'avg a day');
  }
  const limited = hasLimit(counter);
  return chip(limited ? underLimitStreak(days, counter.limit, todayK, start) : '—',
    limited ? 'days under' : 'no limit set')
    + chip(weekTotal(days, todayK), 'this week')
    + chip(dailyAverage(days, start, todayK), 'avg a day');
}

// ---- charts -------------------------------------------------------------

const ZONE = 122;  // px available for a bar
const LABELS = 28; // px of weekday + date under the bars

function drawWeekBars(counter, days, todayK) {
  const series = weeklySeries(days, todayK);
  const target = counter.kind === 'bad' ? (hasLimit(counter) ? counter.limit : null) : counter.goal;
  const max = Math.max(1, ...series.map((d) => d.value), target || 0);

  const bars = el('chartBars');
  bars.className = 'bars' + (counter.kind === 'bad' ? ' bad' : '');
  bars.innerHTML = series.map((d) => {
    const h = d.value > 0 ? Math.round(8 + (d.value / max) * (ZONE - 8)) : 4;
    return `<div class="bar${d.key === todayK ? ' today' : ''}">
      <em class="${d.value ? '' : 'zero'}">${d.value}</em>
      <span class="${d.value ? '' : 'empty'}" style="height:${h}px"></span>
      <b>${d.label}</b><i>${Number(d.key.slice(8))}</i>
    </div>`;
  }).join('');

  if (target) {
    const y = LABELS + 8 + Math.round((target / max) * (ZONE - 8));
    el('chartWrap').insertAdjacentHTML('beforeend',
      `<div class="goal-line" style="bottom:${y}px"></div>
       <div class="goal-tag" style="bottom:${y + 4}px">${counter.kind === 'bad' ? 'LIMIT' : 'GOAL'} ${target}</div>`);
  }
  el('chartLegend').innerHTML = legend([{ cls: 'out', style: 'background:var(--count-3)', label: 'today' }]);
}

function drawCal(counter, days, todayK, n) {
  const start = startOf(counter, days);
  const cells = gridCells(days, start, todayK, n);
  const first = cells.find((c) => !c.blank && !c.beforeStart);
  const span = `${prettyDate(first ? first.key : todayK)} – ${prettyDate(todayK)}`;
  const bars = el('chartBars');
  bars.className = 'calwrap';
  bars.removeAttribute('style');

  if (isTarget(counter)) {
    const build = counter.kind === 'build';
    const now = build ? buildStreak(days, todayK, start) : cleanStreak(days, todayK, start);
    const lastQualifying = build && (Number(days[todayK]) || 0) < 1 ? daysBack(todayK, 1) : todayK;
    const runFrom = now > 0 ? daysBack(lastQualifying, now - 1) : null;
    bars.innerHTML = renderCal(cells, { mode: build ? 'done' : 'clean', runFrom });
    el('chartTitle').textContent = n > 7 ? span : 'This week';
    el('chartLegend').innerHTML = legend(build
      ? [{ style: 'background:var(--cell-done)', label: 'done, this streak' },
        { style: 'background:var(--cell-done-old)', label: 'done, earlier' },
        { style: 'border:1.5px solid var(--cell-miss-line)', label: 'missed' },
        { cls: 'out', label: 'today' }]
      : [{ style: 'background:var(--cell-done)', label: 'clean, this run' },
        { style: 'background:var(--cell-done-old)', label: 'clean, earlier' },
        { style: 'background:var(--rose)', label: 'slipped' },
        { cls: 'out', label: 'today' }]);
    return;
  }

  const goal = counter.kind === 'bad' ? (hasLimit(counter) ? counter.limit : null) : counter.goal;
  bars.innerHTML = renderCal(cells, { mode: 'count', goal, tall: true });
  el('chartTitle').textContent = `${span} · every day's count`;
  el('chartLegend').innerHTML = legend([{
    scale: ['var(--surface-2)', 'var(--count-1)', 'var(--count-2)', 'var(--count-3)', 'var(--count-4)'],
    from: 'none', to: goal ? (counter.kind === 'bad' ? 'limit' : 'goal') : 'most',
  }]);
}

function renderChart(mode) {
  const { counter, days } = current;
  const todayK = todayKey();
  const week = mode === 'week';
  el('segWeek').classList.toggle('on', week);
  el('segMonth').classList.toggle('on', !week);

  el('chartWrap').innerHTML = '<div class="bars" id="chartBars"></div>';
  el('chartLegend').innerHTML = '';

  if (isTarget(counter)) {
    drawCal(counter, days, todayK, week ? 7 : 30);
  } else if (week) {
    el('chartTitle').textContent = 'This week';
    drawWeekBars(counter, days, todayK);
  } else {
    drawCal(counter, days, todayK, 30);
  }
}

// ---- entry point --------------------------------------------------------

export function openStats(state, counterId, backTo = 'v-count') {
  const counter = state.counters.find((c) => c.id === counterId);
  if (!counter) return;
  const days = state.history[counterId] || {};
  const todayK = todayKey();
  const start = startOf(counter, days);
  current = { counter, days, backTo };

  el('statsName').textContent = counter.name;
  el('statsBack').textContent = backTo === 'v-target' ? '‹ Target' : '‹ Count';
  el('statsHero').innerHTML = isTarget(counter)
    ? targetHero(counter, days, todayK)
    : countHero(counter, days, todayK);
  el('statsChips').innerHTML = chipsFor(counter, days, todayK);

  if (isTarget(counter)) {
    const wanted = counter.kind === 'build';
    el('runsTitle').textContent = wanted ? 'Your longest streaks' : 'Your longest clean runs';
    el('runsList').innerHTML = runRows(runList(days, start, todayK, wanted), monthName);
    el('runsCard').hidden = false;
  } else {
    el('runsCard').hidden = true;
  }

  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  el('v-stats').classList.add('active');
  renderChart('week');
}

el('statsBack').addEventListener('click', () => {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  el(current ? current.backTo : 'v-count').classList.add('active');
});
el('segWeek').addEventListener('click', () => renderChart('week'));
el('segMonth').addEventListener('click', () => renderChart('month'));
