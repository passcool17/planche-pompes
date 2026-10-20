const KEY = 'planche-pompes-v1';
export const DEFAULT = () => ({
  v: 1,
  profile: { age: 49, weight: 160, wUnit: 'lb', heightCm: 177.8, hUnit: 'ft', regMax: 30 },
  profileSaved: false,
  settings: { rest: 30, testRest: 120, sound: true, vib: true },
  pos: { chest: 0, shoulders: 0, back: 0, triceps: 0 },
  lvlPos: { chest: {}, shoulders: {}, back: {}, triceps: {} },
  tests: [], cycle: null, cycles: [], sessions: [],
});
export function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.v === 1) { const d = DEFAULT(); return { ...d, ...s, profile: { ...d.profile, ...s.profile }, settings: { ...d.settings, ...s.settings }, pos: { ...d.pos, ...s.pos } }; }
  } catch { /* données illisibles : on repart à neuf */ }
  return DEFAULT();
}
export const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
export function validImport(o) {
  return o && o.v === 1 && o.profile && Array.isArray(o.sessions) && Array.isArray(o.tests);
}
export const clear = () => localStorage.removeItem(KEY);

// Conversions
export const lbToKg = (lb) => lb * 0.45359237;
export const kgToLb = (kg) => kg / 0.45359237;
export const cmToFtIn = (cm) => { const t = Math.round(cm / 2.54); return [Math.floor(t / 12), t % 12]; };
export const ftInToCm = (ft, inch) => Math.round((ft * 12 + inch) * 2.54 * 10) / 10;
