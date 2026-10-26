// Voice + vibration cues for the breathing session, and keeping the screen awake.
// Browser-only; the what-to-play rules live in breathing.js (cueForPhase).
import { cueForPhase } from './breathing.js';

const PREF_KEY = 'bc_cues';
let wakeLock = null, hapticLabel = null;

export function loadPrefs() {
  const def = { voice: true, vibrate: true };
  try { const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); return { voice: p.voice ?? def.voice, vibrate: p.vibrate ?? def.vibrate }; }
  catch { return def; }
}
export function savePrefs(p) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private mode: keep in memory only */ }
}

// iPhone only lets a page speak after a tap — call this from the Begin button.
export function unlockVoice() {
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; speechSynthesis.speak(u);
  } catch { /* no speech on this browser */ }
}

function speak(text) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = 0.85; u.pitch = 0.95;
    speechSynthesis.speak(u);
  } catch { /* no speech on this browser */ }
}

export function stopVoice() { try { speechSynthesis.cancel(); } catch { /* none */ } }

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
  if (prefs.voice) speak(cue.say);
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
