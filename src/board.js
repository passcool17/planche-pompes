// Planche « Push Up Board 21 in 1 » (AERLANG PU3-B) : schéma reproduit du feuillet.
// Coordonnées relevées sur la photo de la moitié gauche ; la moitié droite est son miroir.
export const COLORS = {
  chest: { name: 'Pectoraux', short: 'Pecs', color: 'Bleu', hex: '#3b82f6', text: '#7cb3ff' },
  shoulders: { name: 'Épaules', short: 'Épaules', color: 'Rouge', hex: '#ef4444', text: '#ff8a8a' },
  back: { name: 'Dos', short: 'Dos', color: 'Jaune', hex: '#f5c518', text: '#f8d65a' },
  triceps: { name: 'Triceps', short: 'Triceps', color: 'Vert', hex: '#22c55e', text: '#5fdc8d' },
};
export const ORDER = ['chest', 'shoulders', 'back', 'triceps'];

const RAW = {
  B1: [145, 120, 'chest'], B2: [145, 240, 'chest', 1], B3: [145, 355, 'chest'], B4: [145, 455, 'chest'],
  B5: [145, 575, 'chest', 1], B6: [145, 690, 'chest'], B7: [590, 690, 'chest'],
  G1: [400, 115, 'triceps'], G2: [655, 110, 'triceps'], G3: [655, 350, 'triceps'], G4: [365, 575, 'triceps'], G5: [620, 570, 'triceps'],
  R1: [270, 320, 'shoulders'], R2: [450, 485, 'shoulders'], R3: [590, 450, 'shoulders'],
  Y1: [530, 320, 'back'], Y2: [275, 485, 'back'], Y3: [400, 690, 'back'],
};
const k = 0.66;
export const HOLES = Object.fromEntries(Object.entries(RAW).map(([id, [x, y, c, oval]]) =>
  [id, { x: Math.round((x - 60) * k + 18), y: Math.round((y - 60) * k + 22), c, oval: !!oval }]));

// Positions (lignes de couleur) : la poignée va dans les 2 trous aux extrémités.
// La 1re de chaque couleur sert pour le plan et le test.
export const LINES = {
  chest: [['B1', 'B3', 'bord extérieur, en haut'], ['B4', 'B6', 'bord extérieur, en bas'], ['B1', 'G1', 'en haut, à plat'], ['G1', 'Y1', 'diagonale du haut'], ['B6', 'Y2', 'diagonale du bas'], ['G4', 'B7', 'en bas, vers le centre']],
  shoulders: [['R1', 'R2', 'diagonale du milieu'], ['B1', 'R1', 'diagonale du haut'], ['R2', 'R3', 'au centre'], ['R2', 'G4', 'courte, au centre'], ['R3', 'B7', 'verticale, près du centre']],
  back: [['R1', 'Y1', 'au milieu, à plat'], ['G2', 'Y1', 'diagonale du haut'], ['B4', 'Y2', 'courte, côté extérieur'], ['Y2', 'Y3', 'diagonale du bas'], ['B6', 'Y3', 'en bas, à plat']],
  triceps: [['G4', 'G5', 'en bas, près du centre'], ['G1', 'G2', 'en haut, à plat'], ['G2', 'G3', 'verticale, près du centre'], ['G1', 'R1', 'diagonale du haut'], ['B6', 'G4', 'diagonale du bas'], ['G5', 'Y3', 'diagonale vers le bas']],
};

const W = 1000, H = 476;
const mx = (x, side) => (side ? W - x : x);

function lineEl(a, b, c, side, cls) {
  const A = HOLES[a], B = HOLES[b];
  return `<line class="${cls}" x1="${mx(A.x, side)}" y1="${A.y}" x2="${mx(B.x, side)}" y2="${B.y}" stroke="${COLORS[c].hex}"/>`;
}
function holeEl(id, side, on) {
  const h = HOLES[id], x = mx(h.x, side), col = COLORS[h.c].hex;
  const cls = on ? 'hole on' : 'hole';
  return h.oval
    ? `<rect class="${cls}" x="${x - 30}" y="${h.y - 16}" width="60" height="32" rx="16" stroke="${col}"/>`
    : `<circle class="${cls}" cx="${x}" cy="${h.y}" r="21" stroke="${col}"/>`;
}

/** SVG de la planche. focus = { c, i } pour mettre une position en valeur (mêmes trous des 2 côtés). */
export function boardSVG(focus, { title } = {}) {
  const fl = focus ? LINES[focus.c][focus.i] : null;
  const onHoles = fl ? new Set([fl[0], fl[1]]) : new Set();
  let s = '';
  for (const side of [0, 1]) {
    for (const c of ORDER) LINES[c].forEach(([a, b], i) => {
      const hot = focus && focus.c === c && focus.i === i;
      const dim = focus && !hot;
      s += lineEl(a, b, c, side, `ln${dim ? ' dim' : ''}${hot ? ' hot' : ''}`);
    });
  }
  for (const side of [0, 1]) for (const id in HOLES) s += holeEl(id, side, onHoles.has(id));
  if (fl) for (const side of [0, 1]) {
    const A = HOLES[fl[0]], B = HOLES[fl[1]];
    s += `<line class="grip" x1="${mx(A.x, side)}" y1="${A.y}" x2="${mx(B.x, side)}" y2="${B.y}"/>`;
    for (const h of [A, B]) s += `<circle class="peg" cx="${mx(h.x, side)}" cy="${h.y}" r="10"/>`;
  }
  const lab = (x, y, c, t) => `<text x="${x}" y="${y}" fill="${COLORS[c].text}" class="lbl${focus && focus.c !== c ? ' dim' : ''}">${t}</text>`;
  s += lab(500, 120, 'back', 'DOS') + lab(500, 160, 'chest', 'PECS') + lab(500, 400, 'shoulders', 'ÉPAULES') + lab(500, 440, 'triceps', 'TRICEPS');
  const t = title || (fl ? `Planche : poignées sur la ligne ${COLORS[focus.c].color.toLowerCase()} ${fl[2]}, mêmes trous à gauche et à droite` : 'Planche : les 4 zones de couleur');
  return `<svg class="board" viewBox="0 0 ${W} ${H}" role="img" aria-label="${t}"><rect class="bg" x="4" y="4" width="${W - 8}" height="${H - 8}" rx="18"/><line class="fold" x1="500" y1="20" x2="500" y2="${H - 20}"/>${s}</svg>`;
}

// Niveaux de difficulté (notre classement, pas celui du feuillet) : 1 = poignées vers le bord extérieur, 3 = vers le centre.
// Chaque niveau liste ses positions (paires de trous) ; la 1re est celle par défaut.
const LEVEL_PAIRS = {
  chest: [[['B1', 'B3'], ['B4', 'B6']], [['B1', 'G1'], ['B6', 'Y2']], [['G1', 'Y1'], ['G4', 'B7']]],
  shoulders: [[['B1', 'R1']], [['R1', 'R2'], ['R2', 'G4']], [['R2', 'R3'], ['R3', 'B7']]],
  back: [[['B4', 'Y2'], ['B6', 'Y3']], [['Y2', 'Y3'], ['R1', 'Y1']], [['G2', 'Y1']]],
  triceps: [[['B6', 'G4'], ['G1', 'R1']], [['G4', 'G5'], ['G5', 'Y3']], [['G1', 'G2'], ['G2', 'G3']]],
};
const idxOf = (c, [a, b]) => {
  const i = LINES[c].findIndex(([x, y]) => (x === a && y === b) || (x === b && y === a));
  if (i < 0) throw new Error(`Position inconnue ${c} ${a}-${b}`);
  return i;
};
export const NLEVELS = 3;
/** LEVELS[c][n-1] = indices dans LINES[c] des positions du niveau n. */
export const LEVELS = Object.fromEntries(ORDER.map((c) => [c, LEVEL_PAIRS[c].map((ps) => ps.map((p) => idxOf(c, p)))]));
/** Niveau (1 à 3) d'une position LINES[c][i]. */
export const levelOfPos = (c, i) => LEVELS[c].findIndex((l) => l.includes(i)) + 1 || 1;
