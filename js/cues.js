// Sound + vibration cues for the breathing session, and keeping the screen awake.
// Browser-only; the what-to-play rules live in breathing.js (cueForPhase).
import { cueForPhase } from './breathing.js';

const PREF_KEY = 'bc_cues';
let ctx = null, wakeLock = null, hapticLabel = null;

export function loadPrefs() {
  try { return { sound: true, vibrate: true, ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; }
  catch { return { sound: true, vibrate: true }; }
}
export function savePrefs(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private mode: keep in memory only */ }
}

// iPhone only allows audio that was unlocked by a tap — call this from the Begin button.
export function unlockAudio() {
  try {
    // 'playback' lets the chime play even with the silent switch on (iOS 17+).
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state !== 'running') ctx.resume();
  } catch { ctx = null; }
}

function chime([f0, f1]) {
  if (!ctx) return;
  const t = ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.linearRampToValueAtTime(f1, t + 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  osc.connect(g).connect(ctx.destination);
  osc.start(t); osc.stop(t + 0.95);
}

// iPhone Safari has no navigator.vibrate. Since iOS 18, toggling a native
// <input switch> gives a small system tap — that is the only haptic a web app gets.
function iosTap() {
  if (!hapticLabel) {
    hapticLabel = document.createElement('label');
    hapticLabel.setAttribute('aria-hidden', 'true');
    hapticLabel.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0;pointer-events:none';
    const sw = document.createElement('input');
    sw.type = 'checkbox'; sw.setAttribute('switch', ''); sw.tabIndex = -1;
    hapticLabel.appendChild(sw);
    document.body.appendChild(hapticLabel);
  }
  hapticLabel.click();
}

function buzz(cue) {
  if (navigator.vibrate) { navigator.vibrate(cue.pattern); return; }
  for (let i = 0; i < cue.pulses; i++) setTimeout(iosTap, i * 180);
}

export function playCue(word, prefs) {
  const cue = cueForPhase(word);
  if (prefs.sound) chime(cue.tone);
  if (prefs.vibrate) buzz(cue);
}

// Without this the phone locks mid-session and the cues stop.
export async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch { wakeLock = null; }
}
