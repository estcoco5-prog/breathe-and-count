import { PRESETS, roundSeconds, sessionSeconds, scaleForPhase } from './breathing.js';

const CIRC = 2 * Math.PI * 132;

export function initBreathe() {
  const chipWrap = document.getElementById('patternChips');
  const patterns = [...PRESETS, { id: 'custom', name: 'Custom', steps: [['Breathe in', 4], ['Hold', 2], ['Breathe out', 6], ['Hold', 0]] }];
  let selPattern = 0;

  patterns.forEach((p, i) => {
    const c = document.createElement('button');
    c.className = 'chip' + (i === 0 ? ' sel' : '');
    const lbl = p.name === 'Custom' ? 'Set your own seconds' : p.steps.map((s) => s[1]).join('–') + ' sec';
    c.innerHTML = `<div class="cn">${p.name}</div><div class="cp">${lbl}</div>`;
    c.addEventListener('click', () => {
      selPattern = i;
      document.querySelectorAll('.chip').forEach((x) => x.classList.remove('sel'));
      c.classList.add('sel');
      document.getElementById('customRow').style.display = p.id === 'custom' ? 'flex' : 'none';
    });
    chipWrap.appendChild(c);
  });

  document.getElementById('durRow').addEventListener('click', (e) => {
    const d = e.target.closest('.dur'); if (!d) return;
    document.querySelectorAll('.dur').forEach((x) => x.classList.remove('sel'));
    d.classList.add('sel');
  });

  const session = document.getElementById('session');
  const circle = document.getElementById('circle');
  const phaseWord = document.getElementById('phaseWord');
  const phaseCount = document.getElementById('phaseCount');
  const sessTime = document.getElementById('sessTime');
  const progFill = document.getElementById('progFill');
  progFill.style.strokeDasharray = CIRC;

  let timer = null, tick = null, paused = false, remaining = 120, total = 120, curSteps = [], si = 0, secLeft = 0;
  const updateRing = () => { progFill.style.strokeDashoffset = CIRC * (1 - Math.max(remaining, 0) / total); };
  const updateTime = () => {
    const m = Math.floor(Math.max(remaining, 0) / 60), s = Math.max(remaining, 0) % 60;
    sessTime.textContent = `${m}:${s < 10 ? '0' : ''}${s} left`;
    updateRing();
  };

  function customSteps() {
    const v = (id) => Math.max(0, parseInt(document.getElementById(id).value, 10) || 0);
    return [['Breathe in', v('cin')], ['Hold', v('ch1')], ['Breathe out', v('cout')], ['Hold', v('ch2')]];
  }

  function runStep() {
    if (si >= curSteps.length) si = 0;
    const [word, secs] = curSteps[si];
    if (secs <= 0) { si++; return runStep(); }
    phaseWord.textContent = word; secLeft = secs; phaseCount.textContent = secs;
    const target = scaleForPhase(word);
    if (target !== null) { circle.style.transition = `transform ${secs}s cubic-bezier(.4,0,.4,1)`; circle.style.transform = `scale(${target})`; }
    else { circle.style.transition = 'transform .3s ease'; }
    timer = setTimeout(() => { si++; runStep(); }, secs * 1000);
  }

  function startSession() {
    const p = patterns[selPattern];
    curSteps = (p.id === 'custom' ? customSteps() : p.steps).filter((s) => s[1] > 0);
    if (curSteps.length === 0) return;
    si = 0; paused = false;
    document.getElementById('sessName').textContent = p.name === 'Custom' ? 'Custom pattern' : p.name;
    document.getElementById('pauseBtn').textContent = 'Pause';
    const durBtn = document.querySelector('.dur.sel');
    remaining = durBtn.dataset.rounds
      ? +durBtn.dataset.rounds * roundSeconds(curSteps)
      : sessionSeconds(curSteps, { minutes: +durBtn.dataset.min });
    total = remaining;
    progFill.style.transition = 'none'; updateRing();
    requestAnimationFrame(() => { progFill.style.transition = 'stroke-dashoffset 1s linear'; });
    updateTime(); session.classList.add('on'); runStep();
    tick = setInterval(() => {
      if (paused) return;
      remaining--; secLeft--;
      if (secLeft >= 0) phaseCount.textContent = secLeft;
      if (remaining <= 0) endSession();
      updateTime();
    }, 1000);
  }

  function endSession() {
    clearTimeout(timer); clearInterval(tick);
    circle.style.transition = 'transform .6s ease'; circle.style.transform = 'scale(1)';
    session.classList.remove('on');
    progFill.style.transition = 'none'; progFill.style.strokeDashoffset = 0;
  }

  document.getElementById('startBtn').addEventListener('click', startSession);
  document.getElementById('stopBtn').addEventListener('click', endSession);
  document.getElementById('pauseBtn').addEventListener('click', function () {
    paused = !paused; this.textContent = paused ? 'Resume' : 'Pause';
    if (paused) { clearTimeout(timer); const cs = getComputedStyle(circle).transform; circle.style.transition = 'none'; circle.style.transform = cs; }
    else runStep();
  });
}
