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
    ? (week ? `This week · limit ${counter.limit ?? '—'}/day` : 'Last 30 days · aim lower')
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
    const startKey = todayKey(new Date(counter.createdAt));
    document.getElementById('stStreakK').textContent = 'Under limit';
    document.getElementById('stStreak').innerHTML = `${underLimitStreak(days, counter.limit ?? Infinity, todayKey(), startKey)} <small>days</small>`;
  } else {
    document.getElementById('stStreakK').textContent = 'Streak';
    document.getElementById('stStreak').innerHTML = `${goodStreak(days, todayKey())} <small>days</small>`;
  }
  document.getElementById('stTotalK').textContent = 'All-time total';
  document.getElementById('stTotal').textContent = allTimeTotal(state, counterId).toLocaleString();
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
