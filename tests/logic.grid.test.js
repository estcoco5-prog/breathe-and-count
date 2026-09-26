import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gridCells, intensityStep, weekTotal, dailyAverage, daysAtGoal } from '../js/logic.js';

test('gridCells returns whole weeks with leading blanks so columns are weekdays', () => {
  const cells = gridCells({}, '2026-08-28', '2026-09-26', 30);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.length, 35);
  assert.equal(cells.filter((c) => c.blank).length, 5); // 28 Aug 2026 is a Friday
  assert.equal(cells[5].key, '2026-08-28');
  assert.equal(cells[34].key, '2026-09-26');
  assert.equal(cells[34].today, true);
  assert.equal(cells[5].dayOfMonth, 28);
});

test('gridCells marks days before the counter existed', () => {
  const cells = gridCells({}, '2026-09-20', '2026-09-26', 30);
  const real = cells.filter((c) => !c.blank);
  assert.equal(real.filter((c) => c.beforeStart).length, 23);
  assert.equal(real.filter((c) => !c.beforeStart).length, 7);
});

test('gridCells handles a counter created today', () => {
  const cells = gridCells({ '2026-09-26': 2 }, '2026-09-26', '2026-09-26', 30);
  const real = cells.filter((c) => !c.blank);
  assert.equal(real.filter((c) => !c.beforeStart).length, 1);
  assert.equal(cells.length % 7, 0);
});

test('gridCells crosses a year boundary without gaps', () => {
  const cells = gridCells({ '2025-12-31': 4 }, '2025-12-01', '2026-01-05', 30);
  const keys = cells.filter((c) => !c.blank).map((c) => c.key);
  assert.equal(keys[keys.indexOf('2025-12-31') + 1], '2026-01-01');
  assert.equal(cells.find((c) => c.key === '2025-12-31').value, 4);
});

test('gridCells treats a non-numeric stored value as 0', () => {
  const cells = gridCells({ '2026-09-26': 'three' }, '2026-09-26', '2026-09-26', 30);
  assert.equal(cells.find((c) => c.key === '2026-09-26').value, 0);
});

test('intensityStep spreads 0..goal over five steps', () => {
  assert.equal(intensityStep(0, 30), 0);
  assert.equal(intensityStep(30, 30), 4);
  assert.equal(intensityStep(45, 30), 4);
  assert.equal(intensityStep(5, 30), 1);
  assert.equal(intensityStep(3, null), 4);
});

test('weekTotal, dailyAverage and daysAtGoal', () => {
  const days = { '2026-09-24': 10, '2026-09-25': 20, '2026-09-26': 30 };
  assert.equal(weekTotal(days, '2026-09-26'), 60);
  assert.equal(dailyAverage(days, '2026-09-24', '2026-09-26'), 20);
  assert.equal(daysAtGoal(days, '2026-09-24', '2026-09-26', 20), 2);
  assert.equal(daysAtGoal(days, '2026-09-24', '2026-09-26', null), 0);
});
