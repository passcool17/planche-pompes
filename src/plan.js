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

/** Valeurs prudentes tant que la planche n'a pas été testée : ~40 % du max au sol, entre 6 et 15. */
export function defaultBase(profile) {
  const m = Number(profile?.regMax) || 0;
  return m ? Math.min(15, Math.max(6, Math.round(m * 0.4))) : 10;
}

/** Nouveau cycle à partir d'un test sur la planche (ou des valeurs prudentes). */
export function makeCycle(test, profile, start) {
  const fallback = defaultBase(profile);
  const vals = ORDER.map((c) => test?.res?.[c]).filter((v) => v > 0);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  const base = {};
  for (const c of ORDER) {
    const max = test?.res?.[c] > 0 ? test.res[c] : avg;
    base[c] = max ? Math.max(3, Math.round(max * 0.55)) : fallback;
  }
  return { id: 'c' + Date.now().toString(36), start, base, sets: vals.length ? 3 : 2, tested: vals.length > 0, testId: test?.id || null };
}

export const step = (profile) => ((Number(profile?.age) || 0) >= 45 ? 1 : 2);

function setDone(ex) { return ex.sets.length >= ex.nSets && ex.sets.every((r) => r >= ex.target); }

/** Réussite d'une couleur dans une semaine donnée du cycle : toutes les séries atteintes, pas « Difficile ». */
function weekSuccess(state, cycle, week, c) {
  const ss = state.sessions.filter((s) => s.cycleId === cycle.id && s.week === week && s.type === 'plan');
  const ex = ss.flatMap((s) => s.ex.filter((e) => e.c === c).map((e) => ({ ...e, hard: s.rating === 'hard' || s.stopped })));
  return ex.length > 0 && ex.every((e) => setDone(e) && !e.hard);
}

/** Cible (répétitions/série et nombre de séries) pour une couleur, une semaine du cycle. */
export function target(state, cycle, week, c) {
  const inc = step(state.profile);
  let reps = cycle.base[c];
  const last = Math.min(week, CYCLE_WEEKS) - 1;
  for (let w = 1; w <= Math.min(last, CYCLE_WEEKS - 1); w++) if (w < week && w <= 2 && weekSuccess(state, cycle, w, c)) reps += inc;
  if (week >= CYCLE_WEEKS) return { reps: Math.max(3, Math.round(reps * 0.7)), sets: 2, deload: true };
  return { reps, sets: cycle.sets, deload: false };
}

/** Situation du jour : test à faire, repos, séance, ou nouveau test dû. */
export function today(state, date = iso()) {
  const cy = state.cycle;
  if (!cy) return { kind: 'test', first: true };
  const d = diffDays(cy.start, date);
  if (d < 0) return { kind: 'before', start: cy.start };
  const week = Math.floor(d / 7) + 1, day = (d % 7) + 1;
  if (week > CYCLE_WEEKS) return { kind: 'test', first: false, week, day };
  const done = state.sessions.find((s) => s.cycleId === cy.id && s.date === date && s.type === 'plan');
  const groups = WEEK[day - 1];
  if (!groups) return { kind: 'rest', week, day };
  return { kind: 'train', week, day, done, ex: groups.map((c) => ({ c, ...target(state, cy, week, c) })) };
}

/** Tableau d'une semaine du cycle (projection). */
export function weekTable(state, week) {
  const cy = state.cycle;
  return WEEK.map((g, i) => ({ day: i + 1, date: cy ? addDays(cy.start, (week - 1) * 7 + i) : null, ex: g ? g.map((c) => ({ c, ...(cy ? target(state, cy, week, c) : { reps: defaultBase(state.profile), sets: 2 }) })) : null }));
}

/** Série : séances d'entraînement prévues faites d'affilée (les jours de repos ne cassent pas la série). */
export function streak(state, date = iso()) {
  const cy = state.cycle; if (!cy) return 0;
  const doneDates = new Set(state.sessions.filter((s) => s.type === 'plan' && !s.stopped).map((s) => s.date));
  let n = 0;
  for (let i = 0; i < 400; i++) {
    const day = addDays(date, -i);
    const d = diffDays(cy.start, day);
    if (d < 0) break;
    const wd = d % 7;
    if (!WEEK[wd] || Math.floor(d / 7) >= CYCLE_WEEKS) continue;
    if (doneDates.has(day)) n++;
    else if (i > 0) break;
  }
  // Inclut les cycles précédents simplement par les séances consécutives déjà comptées.
  return n;
}
