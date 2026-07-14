// Pure breathing-pattern math — no DOM. Unit-tested with node:test.

export const PRESETS = [
  { id: 'box', name: 'Box breathing', steps: [['Breathe in', 4], ['Hold', 4], ['Breathe out', 4], ['Hold', 4]] },
  { id: 'relax', name: 'Relax · 4-7-8', steps: [['Breathe in', 4], ['Hold', 7], ['Breathe out', 8]] },
  { id: 'calm', name: 'Calm · 5-5', steps: [['Breathe in', 5], ['Breathe out', 5]] },
];

export function roundSeconds(steps) {
  return steps.reduce((sum, [, secs]) => sum + secs, 0);
}

export function sessionSeconds(steps, { minutes, rounds }) {
  if (minutes != null) return minutes * 60;
  return rounds * roundSeconds(steps);
}

export function scaleForPhase(word) {
  if (word === 'Breathe in') return 1.9;
  if (word === 'Breathe out') return 1;
  return null; // Hold: keep current scale
}
