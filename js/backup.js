// Backup & restore: take a copy of everything out, or put one back.
// Restoring replaces the lot, so it always asks first and never half-applies.
import { exportState, importState, save } from './storage.js';

let ctx = null; // { getState, setState, onRestored }
const el = (id) => document.getElementById(id);

function say(id, text, bad = false) {
  const node = el(id);
  node.textContent = text;
  node.classList.toggle('bad', bad);
}

export function openBackup() {
  const text = exportState(ctx.getState());
  el('exportBox').value = text;
  el('downloadBtn').href = 'data:application/json;charset=utf-8,' + encodeURIComponent(text);
  el('importBox').value = '';
  say('backupSaid', '');
  say('restoreSaid', '');
  el('backupDialog').showModal();
}

export function initBackup(context) {
  ctx = context;

  ['backupLink', 'backupLink2'].forEach((id) => {
    const btn = el(id);
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); openBackup(); });
  });
  el('closeBackup').addEventListener('click', () => el('backupDialog').close());

  el('copyBtn').addEventListener('click', () => {
    const box = el('exportBox');
    const ok = () => say('backupSaid', 'Copied. Now paste it somewhere safe.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(box.value).then(ok, () => {
        box.focus(); box.select();
        say('backupSaid', 'Selected — hold and choose Copy.');
      });
    } else {
      box.focus(); box.select();
      say('backupSaid', 'Selected — hold and choose Copy.');
    }
  });

  el('restoreBtn').addEventListener('click', () => {
    const result = importState(el('importBox').value);
    if (!result.ok) {
      say('restoreSaid', result.reason, true);
      return;
    }
    const n = result.state.counters.length;
    const ok = window.confirm(
      `Replace everything on this device with this backup?\n\n`
      + `It has ${n} counter${n === 1 ? '' : 's'}. What is on this device now will be gone.`
    );
    if (!ok) {
      say('restoreSaid', 'Nothing was changed.');
      return;
    }
    ctx.setState(result.state);
    save(result.state);
    ctx.onRestored();
    say('restoreSaid', `Restored ${n} counter${n === 1 ? '' : 's'}.`);
  });
}
