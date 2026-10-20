// Bips (Web Audio) et vibration.
let ac;
export function unlock() {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch { ac = null; }
}
export function beep(settings, kind = 'tick') {
  if (settings.sound && ac) {
    const seq = kind === 'end' ? [[880, 0, .18], [1175, .2, .32]] : kind === 'go' ? [[660, 0, .12]] : [[520, 0, .08]];
    for (const [f, t, d] of seq) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; o.type = 'sine'; o.connect(g); g.connect(ac.destination);
      const t0 = ac.currentTime + t; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + .02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.start(t0); o.stop(t0 + d + .02);
    }
  }
  if (settings.vib && navigator.vibrate) navigator.vibrate(kind === 'end' ? [180, 80, 180] : kind === 'go' ? 120 : 40);
}
let lock;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !lock) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { lock = null; }); }
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
