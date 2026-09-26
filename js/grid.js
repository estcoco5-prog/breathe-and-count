// Turns gridCells() output into the dated calendar used by every stats screen
// and by the 7-day strip on a target card. Pure string building, no state.
import { intensityStep } from './logic.js';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function calHead() {
  return `<div class="cal-head">${WEEKDAYS.map((d) => `<span>${d}</span>`).join('')}</div>`;
}

// mode 'count' — the number in every box, shaded by how close it is to goal
// mode 'done'  — filled when the day was done, outlined when it was missed
// mode 'clean' — filled when the day was clean, rose when it was a slip
// runFrom      — first key of the run happening now, so it can be shown deeper
export function renderCal(cells, { mode = 'count', goal = null, runFrom = null, tall = false, dates = true } = {}) {
  const body = cells.map((c) => {
    if (c.blank) return '<div class="cal-cell blank"></div>';
    if (c.beforeStart) return '<div class="cal-cell before"></div>';

    const marked = c.value >= 1;
    const inRun = runFrom !== null && c.key >= runFrom;
    const date = dates ? `<span class="dm">${c.dayOfMonth}</span>` : '';
    const today = c.today ? ' today' : '';

    if (mode === 'count') {
      return `<div class="cal-cell c${intensityStep(c.value, goal)}${today}">${date}<span class="vv">${c.value}</span></div>`;
    }
    if (mode === 'done') {
      return marked
        ? `<div class="cal-cell${inRun ? ' run' : ''}${today}">${c.dayOfMonth}</div>`
        : `<div class="cal-cell miss${today}">${c.dayOfMonth}<u></u></div>`;
    }
    // clean
    return marked
      ? `<div class="cal-cell slip${today}">${c.dayOfMonth}<u></u></div>`
      : `<div class="cal-cell${inRun ? ' run' : ''}${today}">${c.dayOfMonth}</div>`;
  }).join('');

  return `${calHead()}<div class="cal${tall ? ' tall' : ''}">${body}</div>`;
}

// The compact 7-day strip on a target card: no weekday header, no blanks.
export function renderStrip(cells, { mode, runFrom }) {
  const body = cells.filter((c) => !c.blank).map((c) => {
    const marked = c.value >= 1;
    const inRun = runFrom !== null && c.key >= runFrom;
    const today = c.today ? ' today' : '';
    if (mode === 'done') {
      return marked
        ? `<div class="cal-cell${inRun ? ' run' : ''}${today}">${c.dayOfMonth}</div>`
        : `<div class="cal-cell miss${today}">${c.dayOfMonth}</div>`;
    }
    return marked
      ? `<div class="cal-cell slip${today}">${c.dayOfMonth}</div>`
      : `<div class="cal-cell${inRun ? ' run' : ''}${today}">${c.dayOfMonth}</div>`;
  }).join('');
  return `<div class="strip">${body}</div>`;
}

export function legend(items) {
  return `<div class="legend">${items.map((i) => (
    i.scale
      ? `<span style="font-size:10.5px;color:var(--ink-soft)">${i.from}</span>
         <div class="scale">${i.scale.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
         <span style="font-size:10.5px;color:var(--ink-soft)">${i.to}</span>`
      : `<div><i class="${i.cls || ''}" style="${i.style || ''}"></i><span>${i.label}</span></div>`
  )).join('')}</div>`;
}

export function runRows(runs, monthName) {
  if (!runs.length) return '<div class="cal-note">No runs yet — the first one starts today.</div>';
  const top = runs.slice(0, 4);
  const max = top[0].length;
  return top.map((r) => `
    <div class="run-row${r.current ? ' now' : ''}">
      <div class="len">${r.length} day${r.length === 1 ? '' : 's'}</div>
      <div class="track"><i style="width:${Math.max(6, Math.round((r.length / max) * 100))}%"></i></div>
      <div class="when">${r.current ? 'now' : monthName(r.endKey)}</div>
    </div>`).join('');
}
