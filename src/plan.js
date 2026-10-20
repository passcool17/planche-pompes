import { ORDER } from './board.js';

// Programme de 7 jours du feuillet (mêmes couleurs, même ordre).
export const WEEK = [
  ['chest', 'triceps'], ['shoulders', 'back'], null, ['triceps', 'shoulders'], ['chest', 'back'], null, ['shoulders', 'chest'],
];
export const CYCLE_WEEKS = 4; // 3 semaines de progression + 1 semaine allégée, puis nouveau test.

export const iso = (d = new Date()) => d.toLocaleDateString('en-CA');
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const diffDays = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

export const START = { reps: 10, sets: 2 }; // Départ : 2 × 10 pour toutes les couleurs.
export const MAX_REPS = 15; // À 2 × 15, on passe à 3 × 10.
export const step = (profile) => ((Number(profile?.age) || 0) >= 45 ? 1 : 2);

/** Niveau suivant après une semaine réussie. */
export function nextLevel(l, inc = 1) {
  if (l.sets < 3 && l.reps + inc > MAX_REPS) return { reps: 10, sets: 3 };
  return { reps: l.reps + inc, sets: l.sets };
}
/** Le test sur la planche (optionnel) freine la progression : cible ≤ 75 % du dernier max, sans jamais descendre sous 2 × 10. */
export function testCap(state, c) {
  const t = [...(state.tests || [])].reverse().find((x) => x.res?.[c] > 0);
  return t ? Math.max(START.reps, Math.round(t.res[c] * 0.75)) : Infinity;
}
export function newCycle(start, level) {
  const lv = level || Object.fromEntries(ORDER.map((c) => [c, { ...START }]));
  return { id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), start, level: lv, v: 2 };
}

function setDone(ex) { return ex.sets.length >= ex.nSets && ex.sets.every((r) => r >= ex.target); }
/** Réussite d'une couleur dans une semaine du cycle : toutes les séries atteintes, pas « Difficile », pas arrêtée. */
export function weekSuccess(state, cycle, week, c) {
  const ss = state.sessions.filter((s) => s.cycleId === cycle.id && s.week === week && s.type === 'plan');
  const ex = ss.flatMap((s) => s.ex.filter((e) => e.c === c).map((e) => ({ ...e, hard: s.rating === 'hard' || s.stopped })));
  return ex.length > 0 && ex.every((e) => setDone(e) && !e.hard);
}

/** Niveau (séries × répétitions) d'une couleur au début de la semaine `week` (1 à 4, 5 = début du cycle suivant).
 *  project = semaine à partir de laquelle on suppose les séances réussies (aperçu du plan). */
export function levelAt(state, cycle, week, c, project = Infinity) {
  const inc = step(state.profile), cap = testCap(state, c);
  let l = { ...cycle.level[c] };
  for (let w = 1; w < Math.min(week, CYCLE_WEEKS); w++) {
    const ok = w >= project || weekSuccess(state, cycle, w, c);
    if (!ok) continue;
    const n = nextLevel(l, inc);
    if (n.sets > l.sets || n.reps <= cap) l = n;
  }
  return l;
}
/** Cible d'une semaine. Semaine 4 allégée : 2 séries, environ 30 % de volume en moins. */
export function target(state, cycle, week, c, project) {
  const l = levelAt(state, cycle, week, c, project);
  if (week >= CYCLE_WEEKS) return l.sets >= 3 ? { reps: l.reps, sets: 2, deload: true } : { reps: Math.max(5, Math.round(l.reps * 0.7)), sets: 2, deload: true };
  return { ...l, deload: false };
}

/** Fait avancer les cycles terminés (4 semaines) : le suivant repart du niveau atteint. Renvoie true si changé. */
export function rollCycles(state, date = iso()) {
  let changed = false;
  if (!state.cycle) return false;
  while (diffDays(state.cycle.start, date) >= CYCLE_WEEKS * 7) {
    const cy = state.cycle;
    // Départ du cycle suivant = niveau après la semaine 3 (si réussie).
    const lv = Object.fromEntries(ORDER.map((c) => [c, levelAt(state, cy, CYCLE_WEEKS + 1, c)]));
    state.cycles.push(cy);
    state.cycle = newCycle(addDays(cy.start, CYCLE_WEEKS * 7), lv);
    state.cycle.n = (cy.n || 1) + 1;
    changed = true;
  }
  return changed;
}

/** Situation du jour : repos ou séance. */
export function today(state, date = iso()) {
  const cy = state.cycle;
  if (!cy) return { kind: 'none' };
  const d = diffDays(cy.start, date);
  if (d < 0) return { kind: 'before', start: cy.start };
  const week = Math.min(Math.floor(d / 7) + 1, CYCLE_WEEKS), day = (d % 7) + 1;
  const done = state.sessions.find((s) => s.cycleId === cy.id && s.date === date && s.type === 'plan');
  const groups = WEEK[day - 1];
  if (!groups) return { kind: 'rest', week, day };
  return { kind: 'train', week, day, done, ex: groups.map((c) => ({ c, ...target(state, cy, week, c) })) };
}

/** Tableau d'une semaine du cycle (projection). */
export function weekTable(state, week, project) {
  const cy = state.cycle;
  return WEEK.map((g, i) => ({ day: i + 1, date: cy ? addDays(cy.start, (week - 1) * 7 + i) : null, ex: g ? g.map((c) => ({ c, ...(cy ? target(state, cy, week, c, project) : { ...START }) })) : null }));
}

/** Série : séances d'entraînement prévues faites d'affilée (les jours de repos ne cassent pas la série). */
export function streak(state, date = iso()) {
  const cy = state.cycle; if (!cy) return 0;
  const origin = state.planStart || cy.start;
  const doneDates = new Set(state.sessions.filter((s) => s.type === 'plan' && !s.stopped).map((s) => s.date));
  let n = 0;
  for (let i = 0; i < 1000; i++) {
    const day = addDays(date, -i);
    if (diffDays(origin, day) < 0) break;
    const wd = ((diffDays(cy.start, day) % 7) + 7) % 7; // les cycles se suivent : même jour de la semaine du programme
    if (!WEEK[wd]) continue;
    if (doneDates.has(day)) n++;
    else if (i > 0) break;
  }
  return n;
}
