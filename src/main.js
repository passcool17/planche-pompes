import './style.css';
import { boardSVG, COLORS, ORDER, LINES, LEVELS, NLEVELS, levelOfPos } from './board.js';
import { WEEK, CYCLE_WEEKS, iso, today, weekTable, streak, newCycle, rollCycles, step, parse, START, MAX_REPS, levelAt, testCap } from './plan.js';
import { load, save, DEFAULT, validImport, clear, lbToKg, kgToLb, cmToFtIn, ftInToCm } from './store.js';
import { WARMUP, TIPS, SAFETY } from './content.js';
import { unlock, beep, keepAwake } from './fx.js';

let S = load();
const persist = () => save(S);
/** Départ à 2 × 10 : un plan créé par l’ancienne version (basé sur le test) repart à 2 × 10 aujourd’hui. L’historique est gardé. */
function migrate() {
  let ch = false;
  // v2 → v3 : niveaux de difficulté. Chaque couleur passe au niveau 1 en gardant ses répétitions (même cycle, historique intact).
  if (S.cycle && S.cycle.v === 2) { for (const c of ORDER) S.cycle.level[c] = { ...S.cycle.level[c], lvl: S.cycle.level[c].lvl || 1 }; S.cycle.v = 3; S.migratedLevels = iso(); ch = true; }
  if (!S.lvlPosV) { S.lvlPos = { ...Object.fromEntries(ORDER.map((c) => [c, {}])), ...S.lvlPos }; for (const c of ORDER) if (S.pos?.[c] > 0) S.lvlPos[c][levelOfPos(c, S.pos[c])] = S.pos[c]; S.lvlPosV = 1; ch = true; }
  if (S.cycle && S.cycle.v !== 3) { S.cycles.push(S.cycle); S.cycle = newCycle(iso()); S.planStart = S.cycle.start; S.migrated2x10 = iso(); ch = true; }
  if (!S.cycle && S.profileSaved) { S.cycle = newCycle(iso()); S.planStart = S.cycle.start; ch = true; }
  if (rollCycles(S)) ch = true;
  if (ch) persist();
}
migrate();
/** Niveau de difficulté actuel d'une couleur et position choisie pour ce niveau. */
const lvlOf = (c) => (S.cycle ? levelAt(S, S.cycle, today(S).week || 1, c).lvl || 1 : 1);
const posFor = (c, lvl = lvlOf(c)) => { const ok = LEVELS[c][lvl - 1], p = S.lvlPos?.[c]?.[lvl]; return ok.includes(p) ? p : ok[0]; };
const niv = (n) => `<small class="niv">Niv. ${n}</small>`;
const $ = (q, r = document) => r.querySelector(q);
const app = $('#app');
const SPEED = Math.max(1, Number(localStorage.getItem('pp-speed')) || 1); // tests automatisés seulement
const DAYS = ['Jour 1', 'Jour 2', 'Jour 3', 'Jour 4', 'Jour 5', 'Jour 6', 'Jour 7'];
const fmtDate = (s, o = { weekday: 'short', day: 'numeric', month: 'short' }) => parse(s).toLocaleDateString('fr-CA', o);
const chip = (c, extra = '') => `<span class="chip" style="--c:${COLORS[c].hex}"><i aria-hidden="true"></i>${COLORS[c].name}${extra}</span>`;
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;

// ---------- Navigation ----------
const ROUTES = { accueil: home, plan: planScreen, progres: progress, reglages: settings, seance: sessionScreen };
const NAV = [['accueil', 'Accueil', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z'], ['plan', 'Plan', 'M4 5h16v15H4zM4 9h16M9 3v4M15 3v4'], ['progres', 'Progrès', 'M4 20V10M10 20V4M16 20v-7M22 20H2'], ['reglages', 'Réglages', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.4.2-2-3-1-1 2h-1.8l-1-2-3 1 .2 2L6 7.2 4 7 3 10l2 1v2l-2 1 1 3 2-.2 1.3 1.4-.2 2 3 1 1-2h1.8l1 2 3-1-.2-2 1.3-1.4 2 .2 1-3-2-1z']];
let route = 'accueil';
function go(r, focus = true) {
  if (cur && r !== 'seance') { keepAwake(false); }
  route = ROUTES[r] ? r : 'accueil';
  if (location.hash !== '#' + route) history.replaceState(null, '', '#' + route);
  render(focus);
}
function render(focus) {
  stopTick();
  if (rollCycles(S)) persist();
  app.innerHTML = ROUTES[route]();
  document.body.classList.toggle('in-session', route === 'seance');
  const nav = $('#nav');
  nav.hidden = route === 'seance';
  nav.innerHTML = NAV.map(([r, l, d]) => `<a href="#${r}" ${r === route ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>${l}</a>`).join('');
  document.title = (route === 'accueil' ? '' : ($('h1', app)?.textContent + ' · ')) + 'Planche Pompes';
  if (focus) { const h = $('h1', app); h?.setAttribute('tabindex', '-1'); h?.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  if (route === 'seance') afterSessionRender();
  installBanner();
}
window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r !== route) { if (route === 'seance' && cur && !cur.saved) { history.replaceState(null, '', '#seance'); return confirmQuit(); } go(r); } });

// ---------- Accueil ----------
function profileForm(compact) {
  const p = S.profile, [ft, inch] = cmToFtIn(p.heightCm);
  const w = p.wUnit === 'kg' ? Math.round(lbToKg(p.weight) * 10) / 10 : p.weight;
  return `<form id="profile" class="card form" novalidate>
    <h2>${compact ? 'Ton profil' : 'Profil'}</h2>
    <div class="grid2">
      <label>Âge<input name="age" type="number" inputmode="numeric" min="12" max="99" value="${p.age}" required></label>
      <label>Pompes au sol d’affilée<input name="regMax" type="number" inputmode="numeric" min="0" max="200" value="${p.regMax}"></label>
    </div>
    <fieldset><legend>Poids</legend><div class="row">
      <input name="weight" type="number" inputmode="decimal" min="30" max="700" step="0.1" value="${w}" aria-label="Poids">
      <div class="seg" role="radiogroup" aria-label="Unité de poids">${['lb', 'kg'].map((u) => `<label><input type="radio" name="wUnit" value="${u}" ${p.wUnit === u ? 'checked' : ''}><span>${u}</span></label>`).join('')}</div>
    </div></fieldset>
    <fieldset><legend>Taille</legend><div class="row">
      ${p.hUnit === 'cm' ? `<input name="cm" type="number" inputmode="numeric" min="100" max="230" value="${Math.round(p.heightCm)}" aria-label="Taille en cm">`
        : `<input name="ft" type="number" inputmode="numeric" min="3" max="7" value="${ft}" aria-label="Pieds"><span class="unit">pi</span><input name="in" type="number" inputmode="numeric" min="0" max="11" value="${inch}" aria-label="Pouces"><span class="unit">po</span>`}
      <div class="seg" role="radiogroup" aria-label="Unité de taille">${[['ft', 'pi/po'], ['cm', 'cm']].map(([u, l]) => `<label><input type="radio" name="hUnit" value="${u}" ${p.hUnit === u ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
    </div></fieldset>
    <p class="note">Sur la planche, les pompes sont plus dures qu’au sol : ton plan commence à <strong>2 × 10</strong> pour chaque couleur, peu importe ce nombre.</p>
    <button class="btn primary" type="submit">${compact ? 'C’est bon, on continue' : 'Enregistrer le profil'}</button>
  </form>`;
}
function readProfile(f) {
  const fd = new FormData(f), p = { ...S.profile };
  const num = (k) => { const v = parseFloat(String(fd.get(k) ?? '').replace(',', '.')); return Number.isFinite(v) ? v : null; };
  if (num('age')) p.age = Math.round(num('age'));
  if (num('regMax') !== null) p.regMax = Math.round(num('regMax'));
  const wu = fd.get('wUnit') || p.wUnit, wv = num('weight');
  if (wv) p.weight = wu === 'kg' ? Math.round(kgToLb(wv) * 10) / 10 : wv;
  p.wUnit = wu;
  if (p.hUnit === 'cm') { if (num('cm')) p.heightCm = num('cm'); } else if (num('ft') !== null) p.heightCm = ftInToCm(num('ft'), num('in') || 0);
  p.hUnit = fd.get('hUnit') || p.hUnit;
  return p;
}

function todayCard() {
  const t = today(S);
  if (t.kind === 'none') return '';
  if (t.kind === 'before') return `<section class="card hero"><h2>Ton plan commence ${fmtDate(t.start, { weekday: 'long' })}</h2><p>Premier jour : ${WEEK[0].map((c) => chip(c)).join(' ')}, 2 × 10.</p><a class="btn" href="#plan">Voir mon plan</a></section>`;
  const head = `${S.migrated2x10 === iso() ? '<p class="badge">Nouveau : ton plan repart à 2 × 10. Ton historique est gardé.</p>' : ''}${S.migratedLevels === iso() ? '<p class="badge">Nouveau : 3 niveaux par couleur. Tu commences au niveau 1 avec tes répétitions actuelles.</p>' : ''}<p class="eyebrow">Semaine ${t.week} sur ${CYCLE_WEEKS} · ${DAYS[t.day - 1]}</p>`;
  if (t.kind === 'rest') {
    const nxt = WEEK.slice(t.day).findIndex(Boolean);
    return `<section class="card hero">${head}<h2>Jour de repos</h2><p>Tes muscles se renforcent pendant le repos. Une marche ou quelques étirements, c’est parfait.</p>${nxt >= 0 ? `<p>Prochaine séance : ${WEEK[t.day + nxt].map((c) => chip(c)).join(' ')}</p>` : ''}</section>`;
  }
  const exs = t.ex.map((e) => `<li>${chip(e.c, ' ' + niv(e.lvl))}<span class="tgt">${e.sets} × ${e.reps}</span></li>`).join('');
  if (t.done) return `<section class="card hero done">${head}<h2>Séance faite ✓</h2><p>${plural(t.done.total, 'pompe')} aujourd’hui. Beau travail!</p><ul class="mini">${exs}</ul><a class="btn" href="#progres">Voir mes progrès</a></section>`;
  return `<section class="card hero">${head}<h2>Séance du jour</h2>${t.ex[0].deload ? '<p class="badge">Semaine allégée : moins de séries pour bien récupérer.</p>' : ''}
    <ul class="mini">${exs}</ul>
    <div class="board-wrap">${boardSVG({ c: t.ex[0].c, i: posFor(t.ex[0].c, t.ex[0].lvl) })}</div>
    <p class="note">Échauffement guidé inclus (environ 3 min).</p>
    <button class="btn primary big" data-act="start-plan">Commencer la séance</button></section>`;
}
function testCard() {
  const last = S.tests.at(-1), cy = S.cycle;
  const due = last && cy && cy.n > 1 && last.date < cy.start && today(S).week === 1;
  if (last && !due) return '';
  return `<section class="card"><h2>Test sur la planche <small class="opt">optionnel</small></h2>
    <p>${due ? 'Nouveau cycle : bon moment pour refaire le test.' : 'Quand tu veux, mesure ton max sur la planche, une fois par couleur.'} Ton plan reste à son niveau : le test sert seulement à garder une progression prudente.</p>
    <button class="btn" data-act="start-test">Faire le test</button></section>`;
}
function home() {
  const n = S.sessions.filter((s) => s.type === 'plan' && !s.stopped).length;
  const last = S.tests.at(-1);
  return `<header class="top"><h1 class="brand"><img src="${import.meta.env.BASE_URL}icons/icon-192.png" alt="" width="40" height="40">Planche Pompes</h1></header>
  <div id="install"></div>
  ${S.profileSaved ? '' : `<section class="card intro"><h2 class="lead">Bienvenue!</h2><p>Ton coach pour la planche à pompes 21 en 1 : le programme du feuillet, adapté à toi, avec échauffement, minuteur de repos et suivi.</p></section>${profileForm(true)}`}
  ${S.profileSaved ? todayCard() + testCard() : ''}
  ${S.profileSaved ? `<section class="stats" aria-label="Résumé">
    <div><strong>${streak(S)}</strong><span>séance${streak(S) > 1 ? 's' : ''} d’affilée</span></div>
    <div><strong>${n}</strong><span>séance${n > 1 ? 's' : ''} au total</span></div>
    <div><strong>${last ? ORDER.reduce((a, c) => a + (last.res[c] || 0), 0) : '—'}</strong><span>dernier test (total)</span></div>
  </section>` : ''}
  <p class="safety">${SAFETY}</p>`;
}

// ---------- Plan ----------
let planWeek = null, boardSel = null;
function planScreen() {
  const cy = S.cycle, t = today(S);
  if (!boardSel) boardSel = { c: 'chest', i: posFor('chest') };
  const wk = planWeek || (t.week && t.week <= CYCLE_WEEKS ? t.week : 1);
  const cw = t.week || 1, proj = wk > cw;
  const rows = weekTable(S, wk, cw).map((d) => `<tr${t.week === wk && t.day === d.day ? ' class="now"' : ''}><th scope="row">${DAYS[d.day - 1]}${d.date ? `<small>${fmtDate(d.date)}</small>` : ''}</th><td>${d.ex ? d.ex.map((e) => `<div class="exl">${chip(e.c, ' ' + niv(e.lvl))}<span class="tgt">${e.sets} × ${e.reps}</span></div>`).join('') : '<span class="rest">Repos</span>'}</td></tr>`).join('');
  const inc = step(S.profile);
  return `<h1>Mon plan</h1>
  ${cy ? `<section class="card"><h2>Ton niveau actuel</h2><p class="note">Niveau 1 = poignées vers le bord extérieur, niveau 3 = vers le centre. Ce classement est le nôtre, il ne vient pas du feuillet.</p>${ORDER.some((c) => { const l = levelAt(S, cy, cw, c); return l.sets < 3 && l.reps >= testCap(S, c, l.lvl) && l.reps < MAX_REPS; }) ? '<p class="note">« Limite du test » : refais le test sur la planche pour continuer à monter.</p>' : ''}<ul class="mini">${ORDER.map((c) => { const l = levelAt(S, cy, cw, c), capped = l.sets < 3 && l.reps >= testCap(S, c, l.lvl) && l.reps < MAX_REPS; return `<li>${chip(c)}<span class="tgt"><span class="lvl">Niveau ${l.lvl}/${NLEVELS}</span> · ${l.sets} × ${l.reps}${capped ? ' <small>(limite du test)</small>' : ''}</span></li>`; }).join('')}</ul></section>` : ''}
  <section class="card">
    <p>${cy ? `Cycle ${cy.n || 1}, commencé ${fmtDate(cy.start, { day: 'numeric', month: 'long' })}.` : 'Ton plan commence à 2 × 10 dès que ton profil est enregistré.'} ${!cy || (cy.n || 1) === 1 ? 'Départ : 2 séries de 10 pour chaque couleur.' : ''}</p>
    <div class="tabs" role="group" aria-label="Semaine">${[1, 2, 3, 4].map((w) => `<button class="tab" data-act="week" data-w="${w}" aria-pressed="${w === wk}">Sem. ${w}</button>`).join('')}</div>
    <table class="plan"><caption>Semaine ${wk}${wk === CYCLE_WEEKS ? ' (allégée)' : ''} : séries × répétitions</caption><tbody>${rows}</tbody></table>
    ${proj ? '<p class="note">Aperçu si tu réussis tes séances. Ça s’ajuste selon ce que tu fais vraiment.</p>' : ''}
  </section>
  <section class="card"><h2>Comment ça progresse</h2><ul class="list">
    <li>Départ : <strong>niveau 1</strong>, 2 × 10 pour chaque couleur.</li>
    <li>Chaque semaine réussie (toutes les séries atteintes, pas « Difficile ») : +${inc} répétition${inc > 1 ? 's' : ''} par série.</li>
    <li>Semaine réussie à 2 × ${MAX_REPS} : tu passes au <strong>niveau suivant</strong> (poignées plus près du centre) et tu repars à 2 × 10.</li>
    <li>Au niveau 3, après 2 × ${MAX_REPS} : on passe à <strong>3 × 10</strong>, puis on remonte de la même façon.</li>
    <li>Semaine 4 : allégée (2 séries, environ 30 % de moins) pour récupérer. Le cycle suivant repart de ton niveau.</li>
    <li>Test sur la planche (optionnel) : ta cible ne dépasse pas 75 % de ton max au dernier test fait au même niveau. Refais-le pour débloquer la suite.</li>
    <li>Trop dur? Fais moins de répétitions, mais ne lâche pas. Repos de ${S.settings.rest} s entre les séries.</li>
  </ul></section>
  <section class="card"><h2>La planche</h2>
    <p>Mets une poignée dans 2 trous reliés par une ligne de couleur, et l’autre poignée dans les <strong>mêmes trous de l’autre côté</strong>.</p>
    <div class="tabs zones" role="group" aria-label="Zone">${ORDER.map((c) => `<button class="tab col" style="--c:${COLORS[c].hex}" data-act="bsel" data-c="${c}" aria-pressed="${boardSel.c === c}">${COLORS[c].name}</button>`).join('')}</div>
    <div class="board-wrap">${boardSVG(boardSel)}</div>
    ${LEVELS[boardSel.c].map((ids, k) => `<div class="lvgroup"><h3 id="lv-${k + 1}">Niveau ${k + 1}${k === 0 ? ' · bord extérieur' : k === NLEVELS - 1 ? ' · vers le centre' : ''}${lvlOf(boardSel.c) === k + 1 ? ' <span class="badge">ton niveau</span>' : ''}</h3><div class="poslist" role="group" aria-labelledby="lv-${k + 1}">${ids.map((i) => `<button class="tab" data-act="bpos" data-i="${i}" aria-pressed="${boardSel.i === i}">${LINES[boardSel.c][i][2]}${posFor(boardSel.c, k + 1) === i ? ' ★' : ''}</button>`).join('')}</div></div>`).join('')}
    <p class="note">★ = position utilisée à ce niveau dans tes séances. Les niveaux sont notre classement (du bord vers le centre), pas celui du feuillet.</p>
    <button class="btn" data-act="usepos" ${posFor(boardSel.c, levelOfPos(boardSel.c, boardSel.i)) === boardSel.i ? 'disabled' : ''}>Utiliser cette position au niveau ${levelOfPos(boardSel.c, boardSel.i)} (${COLORS[boardSel.c].name})</button>
  </section>
  <section class="card"><h2>Conseils de forme</h2><ul class="list">${TIPS.all.map((x) => `<li>${x}</li>`).join('')}</ul></section>`;
}

// ---------- Progrès ----------
function progress() {
  const plans = S.sessions.filter((s) => s.type !== 'test');
  const tot = Object.fromEntries(ORDER.map((c) => [c, 0]));
  for (const s of plans) for (const e of s.ex) tot[e.c] += e.sets.reduce((a, b) => a + b, 0);
  const maxTot = Math.max(1, ...Object.values(tot));
  const last = plans.slice(-14);
  const W = 320, H = 140, mv = Math.max(10, ...last.map((s) => s.total));
  const bw = last.length ? Math.min(28, (W - 20) / last.length - 4) : 0;
  const bars = last.map((s, i) => { const h = Math.round((s.total / mv) * (H - 30)); const x = 10 + i * ((W - 20) / last.length); return `<rect x="${x}" y="${H - 18 - h}" width="${bw}" height="${h}" rx="3"/><text x="${x + bw / 2}" y="${H - 22 - h}" class="v">${s.total}</text>`; }).join('');
  const chart = last.length ? `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Pompes par séance, ${last.length} dernières séances : ${last.map((s) => s.total).join(', ')}"><line x1="6" y1="${H - 18}" x2="${W - 6}" y2="${H - 18}" class="ax"/>${bars}<text x="10" y="${H - 4}" class="v l">${fmtDate(last[0].date, { day: 'numeric', month: 'short' })}</text><text x="${W - 10}" y="${H - 4}" class="v r">${fmtDate(last.at(-1).date, { day: 'numeric', month: 'short' })}</text></svg>` : '<p class="note">Ton graphique apparaîtra après ta première séance.</p>';
  const tests = S.tests.slice().reverse();
  return `<h1>Progrès</h1>
  <section class="card"><h2>Pompes par séance</h2>${chart}</section>
  <section class="card"><h2>Total par zone</h2><ul class="bars">${ORDER.map((c) => `<li><span class="bl">${COLORS[c].name}</span><span class="bt"><span style="width:${(tot[c] / maxTot) * 100}%;background:${COLORS[c].hex}"></span></span><strong>${tot[c]}</strong></li>`).join('')}</ul></section>
  <section class="card"><h2>Tests sur la planche</h2>
    ${tests.length ? `<div class="tscroll"><table class="tests"><thead><tr><th scope="col">Date</th>${ORDER.map((c) => `<th scope="col" style="color:${COLORS[c].text}">${COLORS[c].short}</th>`).join('')}</tr></thead><tbody>${tests.map((t) => `<tr><th scope="row">${fmtDate(t.date, { day: 'numeric', month: 'short' })}</th>${ORDER.map((c) => `<td>${t.res[c] ?? '—'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '<p class="note">Pas encore de test. Il se fait dans ta première séance.</p>'}
    <button class="btn" data-act="start-test">Refaire le test sur la planche</button>
  </section>
  <section class="card"><h2>Historique</h2>${S.sessions.length ? `<ul class="hist">${S.sessions.slice().reverse().slice(0, 40).map((s) => `<li><div><strong>${s.type === 'test' ? 'Test sur la planche' : `Sem. ${s.week} · ${DAYS[s.day - 1]}`}</strong><small>${fmtDate(s.date)}${s.stopped ? ' · arrêtée' : ''}${s.rating ? ' · ' + { easy: 'Facile', ok: 'Correct', hard: 'Difficile' }[s.rating] : ''}</small></div><div class="hx">${s.ex.map((e) => `<span style="color:${COLORS[e.c].text}">${COLORS[e.c].short} ${e.sets.join('-') || '—'}</span>`).join(' ')}</div><span class="ht">${s.total}</span></li>`).join('')}</ul>` : '<p class="note">Aucune séance pour l’instant.</p>'}</section>`;
}

// ---------- Réglages ----------
function settings() {
  const st = S.settings;
  return `<h1>Réglages</h1>
  ${profileForm(false)}
  <section class="card form"><h2>Séance</h2>
    <label>Repos entre les séries (secondes)<input id="rest" type="number" inputmode="numeric" min="10" max="180" step="5" value="${st.rest}"></label>
    <label>Repos entre les tests (secondes)<input id="testRest" type="number" inputmode="numeric" min="30" max="300" step="10" value="${st.testRest}"></label>
    <label class="switch"><input type="checkbox" id="sound" ${st.sound ? 'checked' : ''}><span>Son (bips)</span></label>
    <label class="switch"><input type="checkbox" id="vib" ${st.vib ? 'checked' : ''}><span>Vibration</span></label>
  </section>
  <section class="card"><h2>Mes données</h2><p class="note">Tout reste dans ce téléphone. Exporte une copie pour la garder ou la transférer.</p>
    <div class="btns"><button class="btn" data-act="export">Exporter (JSON)</button>
    <label class="btn file">Importer<input type="file" id="import" accept="application/json,.json"></label>
    <button class="btn danger" data-act="reset">Tout effacer</button></div>
    <p id="datamsg" class="note" role="status"></p>
  </section>
  <section class="card"><h2>À propos</h2><p class="note">Pour la planche à pompes 21 en 1 (AERLANG). Programme inspiré du feuillet fourni, adapté à ton test sur la planche.</p><p class="safety">${SAFETY}</p></section>`;
}

// ---------- Séance guidée ----------
let cur = null, tick = null;
function newSession(type) {
  unlock();
  const t = today(S), steps = WARMUP.map((w, i) => ({ t: 'warm', i }));
  cur = { type, date: iso(), startedAt: Date.now(), idx: 0, ex: [], res: {}, steps, count: 0 };
  if (type === 'plan') {
    Object.assign(cur, { cycleId: S.cycle.id, week: t.week, day: t.day });
    t.ex.forEach((e, ei) => {
      cur.ex.push({ c: e.c, lvl: e.lvl || 1, pos: posFor(e.c, e.lvl || 1), target: e.reps, nSets: e.sets, deload: e.deload, sets: [] });
      for (let k = 0; k < e.sets; k++) {
        steps.push({ t: 'set', ei, k });
        if (!(ei === t.ex.length - 1 && k === e.sets - 1)) steps.push({ t: 'rest', secs: S.settings.rest });
      }
    });
  } else {
    ORDER.forEach((c, i) => { steps.push({ t: 'test', c }); if (i < ORDER.length - 1) steps.push({ t: 'rest', secs: S.settings.testRest }); });
  }
  steps.push({ t: 'end' });
  keepAwake(true);
  go('seance');
}
function nextLabel(from) {
  const n = cur.steps.slice(from + 1).find((s) => s.t === 'set' || s.t === 'test');
  if (!n) return null;
  if (n.t === 'test') return { c: n.c, pos: posFor(n.c), text: `Test ${COLORS[n.c].name}` };
  const e = cur.ex[n.ei];
  return { c: e.c, pos: e.pos, text: `Niveau ${e.lvl} · série ${n.k + 1} sur ${e.nSets} · ${e.target} rép.` };
}
function counter(lbl) {
  return `<button class="tap" data-act="tap" aria-describedby="taphelp"><span class="n" id="cnt" aria-live="polite">${cur.count}</span><span id="taphelp" class="h">${lbl}</span></button>
    <div class="row center"><button class="btn sm" data-act="minus">−1<span class="sr-only"> répétition</span></button>
    <label class="inl">Nombre<input id="cntIn" type="number" inputmode="numeric" min="0" max="300" value="${cur.count || ''}" placeholder="0"></label></div>`;
}
function sessionScreen() {
  if (!cur) return `<h1>Séance</h1><p>Aucune séance en cours.</p><a class="btn" href="#accueil">Retour à l’accueil</a>`;
  const s = cur.steps[cur.idx], total = cur.steps.length - 1;
  const bar = `<div class="sbar"><button class="btn sm ghost" data-act="quit">Quitter</button><div class="prog" role="progressbar" aria-label="Avancement de la séance" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${Math.min(cur.idx, total)}"><span style="width:${(Math.min(cur.idx, total) / total) * 100}%"></span></div><button class="btn sm pain" data-act="pain">J’ai mal</button></div>`;
  if (s.t === 'warm') {
    const w = WARMUP[s.i];
    return `${bar}<p class="eyebrow">Échauffement ${s.i + 1} sur ${WARMUP.length}</p><h1>${w.name}</h1><p class="how">${w.how}</p>
    ${w.secs ? `<div class="timer" id="timer" data-secs="${w.secs}" ${w.switchAt ? `data-switch="${w.switchAt}"` : ''}>${ring(w.secs, w.secs)}</div><p class="note center" id="tmsg" aria-live="polite">${w.switchAt ? `${w.switchAt} s de chaque côté` : `${w.secs} secondes`}</p><button class="btn primary big" data-act="tstart" id="tbtn">Démarrer</button>`
      : `<p class="target">${w.reps}</p><button class="btn primary big" data-act="next">Fait ✓</button>`}`;
  }
  if (s.t === 'set') {
    const e = cur.ex[s.ei], C = COLORS[e.c], L = LINES[e.c][e.pos];
    const alt = LEVELS[e.c][e.lvl - 1].length > 1 && s.k === 0;
    return `${bar}<p class="eyebrow" style="color:${C.text}">${C.name} · série ${s.k + 1} sur ${e.nSets}</p><h1>${C.name} <span class="lvl big">Niveau ${e.lvl}/${NLEVELS}</span></h1>
    <div class="board-wrap">${boardSVG({ c: e.c, i: e.pos })}</div>
    <p class="pos">Poignées : ligne <strong style="color:${C.text}">${C.color.toLowerCase()}</strong> ${L[2]}, mêmes trous des 2 côtés.</p>
    ${alt ? `<button class="btn ghost" data-act="altpos">Autre position du niveau ${e.lvl}</button>` : ''}
    <p class="target"><strong>${e.target}</strong> répétitions${e.deload ? ' <span class="badge">semaine allégée</span>' : ''}</p>
    ${counter('Touche à chaque pompe')}
    <button class="btn primary big" data-act="setdone" id="setdone">Série faite</button>
    <details class="tips"><summary>Conseils de forme</summary><ul class="list"><li>${TIPS[e.c]}</li>${TIPS.all.map((x) => `<li>${x}</li>`).join('')}</ul></details>`;
  }
  if (s.t === 'test') {
    const C = COLORS[s.c], pos = posFor(s.c), L = LINES[s.c][pos], i = ORDER.indexOf(s.c);
    return `${bar}<p class="eyebrow" style="color:${C.text}">Test sur la planche · ${i + 1} sur 4 · Niveau ${lvlOf(s.c)}/${NLEVELS}</p><h1>Test ${C.name}</h1>
    <div class="board-wrap">${boardSVG({ c: s.c, i: pos })}</div>
    <p class="pos">Poignées : ligne <strong style="color:${C.text}">${C.color.toLowerCase()}</strong> ${L[2]}, mêmes trous des 2 côtés.</p>
    <p class="how">Fais le plus de pompes possible <strong>sur la planche</strong>, avec une bonne forme. Arrête dès que ton corps n’est plus droit ou que ça tire dans une articulation.</p>
    ${counter('Touche à chaque pompe')}
    <button class="btn primary big" data-act="testdone" id="testdone">Terminé</button>
    <button class="btn ghost" data-act="testskip">Passer cette couleur</button>`;
  }
  if (s.t === 'rest') {
    const nx = nextLabel(cur.idx);
    const swap = nx && cur.steps[cur.idx - 1] && (() => { const p = cur.steps[cur.idx - 1]; const pp = p.t === 'test' ? posFor(p.c) : cur.ex[p.ei]?.pos, pc = p.t === 'test' ? p.c : cur.ex[p.ei]?.c; return pc !== nx.c || pp !== nx.pos; })();
    return `${bar}<p class="eyebrow">Repos</p><h1>Respire</h1>
    <div class="timer" id="timer" data-secs="${s.secs}" data-auto="1">${ring(s.secs, s.secs)}</div>
    <div class="row center"><button class="btn" data-act="plus15">+15 s</button><button class="btn" data-act="next">Passer</button></div>
    ${nx ? `<section class="card nextup"><h2>Ensuite</h2><p>${chip(nx.c)} ${nx.text}</p>${swap ? `<p class="note">Change tes poignées de place :</p><div class="board-wrap sm">${boardSVG({ c: nx.c, i: nx.pos })}</div>` : ''}</section>` : ''}`;
  }
  return summary();
}
function ring(left, totalSecs) {
  const r = 88, C = 2 * Math.PI * r, f = totalSecs ? left / totalSecs : 0;
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="${r}" class="rbg"/><circle cx="100" cy="100" r="${r}" class="rfg" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}"/></svg><span class="tleft" role="timer" aria-label="Temps restant">${Math.ceil(left)}<small>s</small></span>`;
}
function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
function runTimer(el, onEnd) {
  stopTick();
  const total = Number(el.dataset.secs), sw = Number(el.dataset.switch) || 0;
  let end = Date.now() + (total * 1000) / SPEED, lastSec = null, switched = false;
  cur.addTime = (s) => { end += (s * 1000) / SPEED; el._total = (el._total || total) + s; };
  const upd = () => {
    const left = Math.max(0, ((end - Date.now()) / 1000) * SPEED), sec = Math.ceil(left);
    el.innerHTML = ring(left, el._total || total);
    if (sw && !switched && total - left >= sw) { switched = true; beep(S.settings, 'go'); const m = $('#tmsg'); if (m) m.textContent = 'Change de côté!'; }
    if (sec !== lastSec && sec <= 3 && sec > 0) beep(S.settings, 'tick');
    lastSec = sec;
    if (left <= 0) { stopTick(); beep(S.settings, 'end'); onEnd(); }
  };
  upd(); tick = setInterval(upd, 200);
}
function afterSessionRender() {
  const s = cur?.steps[cur.idx]; if (!s) return;
  const el = $('#timer');
  if (s.t === 'rest' && el) runTimer(el, () => advance());
  const inp = $('#cntIn');
  inp?.addEventListener('input', () => { cur.count = Math.max(0, Math.min(300, parseInt(inp.value, 10) || 0)); updCount(false); });
  updCount(false);
}
function updCount(syncInput = true) {
  const n = $('#cnt'); if (n) n.textContent = cur.count;
  if (syncInput) { const i = $('#cntIn'); if (i) i.value = cur.count || ''; }
  const s = cur.steps[cur.idx], b = $('#setdone');
  if (b && s.t === 'set') b.textContent = cur.count ? `Série faite · ${cur.count} rép.` : `Série faite · ${cur.ex[s.ei].target} rép.`;
  const t = $('#testdone'); if (t) { t.textContent = cur.count ? `Terminé · ${cur.count} pompes` : 'Entre ton nombre de pompes'; t.disabled = !cur.count; }
}
function advance() { cur.idx = Math.min(cur.idx + 1, cur.steps.length - 1); cur.count = 0; if (cur.steps[cur.idx].t === 'end') finish(); render(true); }
function finish(stopped = false) {
  if (cur.saved) return;
  cur.stopped = stopped; cur.saved = true; keepAwake(false);
  const total = cur.type === 'test' ? ORDER.reduce((a, c) => a + (cur.res[c] || 0), 0) : cur.ex.reduce((a, e) => a + e.sets.reduce((x, y) => x + y, 0), 0);
  const rec = { id: 's' + Date.now().toString(36), type: cur.type, date: cur.date, startedAt: cur.startedAt, dur: Math.round((Date.now() - cur.startedAt) / 1000), total, stopped, rating: null, ex: cur.ex, cycleId: cur.cycleId, week: cur.week, day: cur.day };
  if (cur.type === 'test') {
    rec.ex = ORDER.filter((c) => cur.res[c] > 0).map((c) => ({ c, lvl: lvlOf(c), pos: posFor(c), target: 0, nSets: 1, sets: [cur.res[c]] }));
    if (!stopped || Object.keys(cur.res).length) {
      const test = { id: 't' + Date.now().toString(36), date: cur.date, res: Object.fromEntries(ORDER.map((c) => [c, cur.res[c] > 0 ? cur.res[c] : null])), pos: Object.fromEntries(ORDER.map((c) => [c, posFor(c)])), lvl: Object.fromEntries(ORDER.map((c) => [c, lvlOf(c)])) };
      if (ORDER.some((c) => test.res[c])) S.tests.push(test);
    }
  }
  S.sessions.push(rec); cur.rec = rec; persist();
}
function summary() {
  const r = cur.rec, min = Math.max(1, Math.round(r.dur / 60));
  if (cur.type === 'test') {
    return `<h1>Test terminé</h1><section class="card"><h2>Ton max sur la planche</h2><ul class="mini">${ORDER.map((c) => `<li>${chip(c)}<span class="tgt">${cur.res[c] || '—'}</span></li>`).join('')}</ul></section>
    <section class="card"><p>Ton plan ne change pas. Ces résultats gardent ta progression prudente : ta cible ne dépassera pas 75 % de ton max sur la planche.</p></section>
    <a class="btn primary big" href="#plan">Voir mon plan</a><a class="btn" href="#accueil">Accueil</a>`;
  }
  return `<h1>${r.stopped ? 'Séance arrêtée' : 'Séance terminée!'}</h1>
  ${r.stopped ? '<p class="card warn">Tu as bien fait d’arrêter. Repose-toi, et si la douleur persiste ou t’inquiète, consulte (811 Info-Santé). Reprends seulement sans douleur.</p>' : ''}
  <section class="stats"><div><strong>${r.total}</strong><span>pompes</span></div><div><strong>${min}</strong><span>min</span></div><div><strong>${streak(S)}</strong><span>d’affilée</span></div></section>
  <section class="card"><ul class="mini">${r.ex.map((e) => `<li>${chip(e.c)}<span class="tgt">${e.sets.join(' · ') || '—'} <small>(cible ${e.target})</small></span></li>`).join('')}</ul></section>
  ${r.stopped ? '' : `<section class="card"><h2 id="rate-h">C’était comment?</h2><div class="tabs" role="group" aria-labelledby="rate-h">${[['easy', 'Facile'], ['ok', 'Correct'], ['hard', 'Difficile']].map(([k, l]) => `<button class="tab" data-act="rate" data-r="${k}" aria-pressed="${r.rating === k}">${l}</button>`).join('')}</div><p class="note">« Difficile » garde les mêmes répétitions la semaine prochaine.</p></section>`}
  <a class="btn primary big" href="#accueil">Terminer</a>`;
}
function confirmQuit() {
  ask('Quitter la séance?', 'Ce que tu as fait jusqu’ici sera enregistré comme séance arrêtée.', 'Quitter', () => { if (cur.idx > WARMUP.length - 1) finish(true); cur = null; keepAwake(false); go('accueil'); });
}

// ---------- Boîte de dialogue ----------
function ask(title, text, ok, onOk, danger) {
  const d = $('#dlg');
  d.innerHTML = `<form method="dialog"><h2 id="dlg-t">${title}</h2><p>${text}</p><div class="btns"><button class="btn" value="no">Annuler</button><button class="btn ${danger ? 'danger' : 'primary'}" value="ok">${ok}</button></div></form>`;
  d.setAttribute('aria-labelledby', 'dlg-t');
  d.onclose = () => { if (d.returnValue === 'ok') onOk(); };
  d.returnValue = ''; d.showModal();
}

// ---------- Événements ----------
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act;
  if (a === 'start-plan') newSession('plan');
  else if (a === 'start-test') newSession('test');
  else if (a === 'week') { planWeek = Number(b.dataset.w); render(false); $(`[data-act=week][data-w="${planWeek}"]`)?.focus(); }
  else if (a === 'bsel') { boardSel = { c: b.dataset.c, i: posFor(b.dataset.c) }; render(false); $(`[data-act=bsel][data-c="${boardSel.c}"]`)?.focus(); }
  else if (a === 'bpos') { boardSel.i = Number(b.dataset.i); render(false); $(`[data-act=bpos][data-i="${boardSel.i}"]`)?.focus(); }
  else if (a === 'usepos') { (S.lvlPos[boardSel.c] ||= {})[levelOfPos(boardSel.c, boardSel.i)] = boardSel.i; persist(); render(false); $(`[data-act=bpos][data-i="${boardSel.i}"]`)?.focus(); }
  else if (a === 'next') advance();
  else if (a === 'altpos') { const e = cur.ex[cur.steps[cur.idx].ei], ids = LEVELS[e.c][e.lvl - 1]; e.pos = ids[(ids.indexOf(e.pos) + 1) % ids.length]; (S.lvlPos[e.c] ||= {})[e.lvl] = e.pos; persist(); const n = cur.count; render(false); cur.count = n; updCount(); $('[data-act=altpos]')?.focus(); }
  else if (a === 'tstart') { unlock(); b.disabled = true; b.textContent = 'C’est parti…'; beep(S.settings, 'go'); runTimer($('#timer'), () => { b.disabled = false; b.textContent = 'Suivant'; b.dataset.act = 'next'; b.focus(); }); }
  else if (a === 'plus15') cur.addTime?.(15);
  else if (a === 'tap') { cur.count = Math.min(300, cur.count + 1); if (S.settings.vib && navigator.vibrate) navigator.vibrate(15); updCount(); }
  else if (a === 'minus') { cur.count = Math.max(0, cur.count - 1); updCount(); }
  else if (a === 'setdone') { const s = cur.steps[cur.idx], e = cur.ex[s.ei]; e.sets.push(cur.count || e.target); advance(); }
  else if (a === 'testdone') { if (!cur.count) return; cur.res[cur.steps[cur.idx].c] = cur.count; advance(); }
  else if (a === 'testskip') { cur.res[cur.steps[cur.idx].c] = null; advance(); }
  else if (a === 'quit') confirmQuit();
  else if (a === 'pain') ask('Tu as mal?', 'On arrête la séance ici. Ne force jamais sur une douleur aux muscles ou aux articulations.', 'Arrêter la séance', () => { stopTick(); finish(true); cur.idx = cur.steps.length - 1; render(true); });
  else if (a === 'rate') { cur.rec.rating = b.dataset.r; const s = S.sessions.find((x) => x.id === cur.rec.id); if (s) s.rating = b.dataset.r; persist(); document.querySelectorAll('[data-act=rate]').forEach((x) => x.setAttribute('aria-pressed', x === b)); }
  else if (a === 'export') {
    const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
    const u = URL.createObjectURL(blob), l = document.createElement('a');
    l.href = u; l.download = `planche-pompes-${iso()}.json`; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
    $('#datamsg').textContent = 'Copie exportée.';
  } else if (a === 'reset') ask('Tout effacer?', 'Ton profil, tes tests et tout ton historique seront supprimés de ce téléphone. Exporte une copie avant si tu veux la garder.', 'Tout effacer', () => { clear(); S = DEFAULT(); cur = null; go('accueil'); }, true);
  else if (a === 'install') { deferred?.prompt(); deferred?.userChoice.finally(() => { deferred = null; installBanner(); }); }
  else if (a === 'install-x') { localStorage.setItem('pp-install-x', '1'); installBanner(); }
});
document.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'profile') return;
  ev.preventDefault();
  S.profile = readProfile(ev.target); S.profileSaved = true;
  if (!S.cycle) { S.cycle = newCycle(iso()); S.planStart = S.cycle.start; }
  persist();
  const msg = route === 'reglages';
  render(!msg);
  if (msg) { const f = $('#profile'); f.insertAdjacentHTML('beforeend', '<p class="note ok" role="status">Profil enregistré.</p>'); }
});
document.addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.name === 'wUnit' || t.name === 'hUnit') { S.profile = readProfile(t.form); if (t.name === 'hUnit') S.profile.hUnit = t.value; persist(); render(false); $(`input[name=${t.name}][value=${t.value}]`)?.focus(); return; }
  if (['rest', 'testRest'].includes(t.id)) { const v = parseInt(t.value, 10); if (v > 0) { S.settings[t.id] = Math.min(Number(t.max), Math.max(Number(t.min), v)); t.value = S.settings[t.id]; persist(); } }
  if (['sound', 'vib'].includes(t.id)) { S.settings[t.id] = t.checked; persist(); if (t.checked) { unlock(); beep(S.settings, 'go'); } }
  if (t.id === 'import' && t.files?.[0]) {
    t.files[0].text().then((txt) => {
      const o = JSON.parse(txt);
      if (!validImport(o)) throw new Error('format');
      ask('Importer ces données?', `${plural(o.sessions.length, 'séance')} et ${plural(o.tests.length, 'test')}. Elles remplaceront les données actuelles.`, 'Importer', () => { save(o); S = load(); migrate(); go('reglages'); $('#datamsg').textContent = 'Données importées.'; });
    }).catch(() => { $('#datamsg').textContent = 'Fichier non reconnu. Choisis un export de Planche Pompes.'; }).finally(() => { t.value = ''; });
  }
});
document.addEventListener('keydown', (ev) => {
  if (route === 'seance' && ev.key === ' ' && $('[data-act=tap]') && !ev.target.closest('input,button,summary')) { ev.preventDefault(); $('[data-act=tap]').click(); }
});

// ---------- Installation ----------
let deferred = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; installBanner(); });
window.addEventListener('appinstalled', () => { deferred = null; installBanner(); });
function installBanner() {
  const el = $('#install'); if (!el) return;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (standalone || localStorage.getItem('pp-install-x') || (!deferred && !ios)) { el.innerHTML = ''; return; }
  el.innerHTML = `<aside class="card install" aria-label="Installer l’appli"><p>${deferred ? 'Installe l’appli sur ton téléphone : elle marche même sans internet.' : 'Pour l’installer : touche <strong>Partager</strong> <span aria-hidden="true">⎋</span> dans Safari, puis <strong>« Sur l’écran d’accueil »</strong>.'}</p><div class="btns">${deferred ? '<button class="btn primary" data-act="install">Installer</button>' : ''}<button class="btn ghost" data-act="install-x">Plus tard</button></div></aside>`;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) window.addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));
go((location.hash.slice(1) === 'seance' ? 'accueil' : location.hash.slice(1)) || 'accueil', false);
