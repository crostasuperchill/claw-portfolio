import { mulberry32 } from './rng';

export type Spot = { x: number; y: number; z: number };
export type Rect = { x: number; z: number; w: number; d: number };

/** Il buco reale nel piano: deve combaciare con addPlayfield e col cabinet. */
export const CHUTE_GAP = 0.2;
/** Bordo del buco che non regge una capsula (spessore del rim fisico). */
export const CHUTE_RIM = 0.02;
/** Passo orizzontale = 2 raggi + 5% d'aria: nessuna coppia parte compenetrata. */
const SPACING = 2.05;
/** Aria sotto lo strato superiore al momento dello spawn (poi si assesta). */
const TOP_CLEARANCE = 0.006;

type Cell = { x: number; z: number; row: number };
type TopSpot = { x: number; y: number; z: number };

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Reticolo esagonale (file alternate di mezzo passo) dentro il rettangolo dei
 * centri ammessi. Le file sono centrate in z e il reticolo è centrato in x
 * senza perdere lo stagger.
 */
function hexGrid(x0: number, x1: number, z0: number, z1: number, step: number): Cell[] {
  if (x1 < x0 || z1 < z0) return [];
  const h = (step * Math.sqrt(3)) / 2;
  const rows = Math.max(1, Math.floor((z1 - z0) / h + 1e-6) + 1);
  const zStart = (z0 + z1) / 2 - ((rows - 1) * h) / 2;
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * (step / 2);
    for (let x = x0 + off; x <= x1 + 1e-9; x += step) {
      cells.push({ x, z: zStart + row * h, row });
    }
  }
  if (!cells.length) return cells;
  let min = Infinity;
  let max = -Infinity;
  for (const c of cells) {
    if (c.x < min) min = c.x;
    if (c.x > max) max = c.x;
  }
  const shift = (x0 + x1) / 2 - (min + max) / 2;
  for (const c of cells) c.x += shift;
  return cells;
}

/**
 * Buchi triangolari dello strato inferiore in cui può appoggiarsi lo strato
 * superiore. L'orientamento (punta in basso / in alto) si alterna tra le
 * fasce: occupare entrambi gli orientamenti nella stessa fascia farebbe
 * sovrapporre le capsule dello strato alto. Ogni buca è il baricentro della
 * terna di appoggio, così la capsula nasce già sopra i tre contatti.
 */
function pockets(bottom: Cell[], step: number): { x: number; z: number }[] {
  const byRow = new Map<number, Cell[]>();
  for (const c of bottom) {
    const row = byRow.get(c.row);
    if (row) row.push(c);
    else byRow.set(c.row, [c]);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const rA = rows[i];
    const rB = rows[i + 1];
    if (rB !== rA + 1) continue;
    const A = byRow.get(rA)!.sort((a, b) => a.x - b.x);
    const B = byRow.get(rB)!.sort((a, b) => a.x - b.x);
    // La buca sta sempre nella metà inferiore della fascia: due capsule della
    // fila bassa + una della fila alta. Il baricentro cade sulla capsula
    // singola (fila alta), che alterna x a ogni fila: le buche di fasce
    // adiacenti risultano quindi sfalsate di mezzo passo.
    for (let k = 0; k < A.length - 1; k++) {
      const a = A[k];
      const b = A[k + 1];
      const mid = (a.x + b.x) / 2;
      const other = B.find((c) => Math.abs(c.x - mid) < step * 0.3);
      if (!other) continue;
      out.push({
        x: (a.x + b.x + other.x) / 3,
        z: (a.z + b.z + other.z) / 3,
      });
    }
  }
  return out;
}

/**
 * Buchi stabili sopra uno strato già occupato: baricentri delle terne di
 * capsule che formano un triangolo di lato ~passo. La capsula nasce appoggiata
 * sui tre centri e la quota è calcolata perché la distanza 3D da ognuno sia
 * almeno un diametro (niente compenetrazione allo spawn).
 */
function layerPockets(prev: Spot[], step: number, radius: number): Spot[] {
  if (prev.length < 3) return [];
  const lo = step * 0.86;
  const hi = step * 1.14;
  const minArea = 0.28 * ((Math.sqrt(3) / 4) * step * step);
  const diameter = radius * 2 * 1.002;
  const out: Spot[] = [];
  for (let i = 0; i < prev.length; i++) {
    const a = prev[i];
    for (let j = i + 1; j < prev.length; j++) {
      const b = prev[j];
      const dab = Math.hypot(a.x - b.x, a.z - b.z);
      if (dab < lo || dab > hi) continue;
      for (let k = j + 1; k < prev.length; k++) {
        const c = prev[k];
        const dac = Math.hypot(a.x - c.x, a.z - c.z);
        const dbc = Math.hypot(b.x - c.x, b.z - c.z);
        if (dac < lo || dac > hi || dbc < lo || dbc > hi) continue;
        const area = Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) / 2;
        if (area < minArea) continue;
        const x = (a.x + b.x + c.x) / 3;
        const z = (a.z + b.z + c.z) / 3;
        let y = -Infinity;
        for (const p of [a, b, c]) {
          const d = Math.hypot(x - p.x, z - p.z);
          const need = Math.sqrt(Math.max(0, diameter * diameter - d * d));
          y = Math.max(y, p.y + need);
        }
        if (out.some((o) => Math.hypot(o.x - x, o.z - z) < step * 0.5)) continue;
        out.push({ x, y: y + TOP_CLEARANCE, z });
      }
    }
  }
  return out;
}

/**
 * Pila a più strati stabili.
 *
 * Lo strato basso riempie il pavimento a reticolo esagonale (fila di 4 e di 3
 * capsule, passo 2.05r) e lascia libero il buco dello chute: nessuna capsula
 * nasce sopra il vuoto, quindi non può caderci da sola. Lo strato alto occupa
 * una buca su due tra le terne dello strato basso, come in un impilamento
 * esagonale: ogni capsula ha tre appoggi e non rotola via.
 *
 * Oltre la capacità dei due strati, gli extra finiscono in buche triangolari
 * dello strato precedente (terzo, quarto strato…), sempre filtrate lontano
 * dallo chute e dentro il playfield: nessuna capsula nasce sopra il vuoto.
 *
 * `exclude` è il footprint dello chute passato dal gioco; il buco fisico però
 * è CHUTE_GAP, quindi il layout usa il centro dell'exclude e il buco vero.
 */
export function spawnLayout(opts: {
  seed: number;
  count: number;
  width: number;
  depth: number;
  radius: number;
  floorY: number;
  exclude?: Rect;
}): Spot[] {
  const { seed, count, width, depth, radius, floorY, exclude } = opts;
  const rnd = mulberry32(seed);
  const halfW = width / 2;
  const halfD = depth / 2;
  const step = radius * SPACING;
  const jitter = () => (rnd() - 0.5) * radius * 0.02; // ±1% del raggio
  const bottomY = floorY + radius + 0.004;

  const bottomMain: Cell[] = [];
  const bottomStrips: Cell[] = [];

  // Bordo destro del buco + margine: nessuno strato alto può sporgere sopra il vuoto.
  let chuteSafeX = -Infinity;

  if (exclude) {
    const gx0 = exclude.x - CHUTE_GAP / 2;
    const gx1 = exclude.x + CHUTE_GAP / 2;
    chuteSafeX = gx1 + CHUTE_RIM + radius * 1.8;
    const gz0 = exclude.z - CHUTE_GAP / 2;
    const gz1 = exclude.z + CHUTE_GAP / 2;
    const clear = CHUTE_RIM + radius;

    const slabX0 = gx1 + clear;
    const slabX1 = halfW - radius;
    const slabZ0 = -halfD + radius;
    const slabZ1 = halfD - radius;

    if (slabX0 <= slabX1 && slabZ0 <= slabZ1) {
      for (const c of hexGrid(slabX0, slabX1, slabZ0, slabZ1, step)) {
        bottomMain.push({
          ...c,
          x: clamp(c.x + jitter(), slabX0, slabX1),
          z: clamp(c.z + jitter(), slabZ0, slabZ1),
        });
      }

      // Due strisce di pavimento ai lati del buco (larghe quanto il buco).
      const stripX0 = gx0 + radius;
      const stripX1 = gx1 - radius;
      if (stripX1 >= stripX0) {
        const strips: [number, number][] = [
          [-halfD + radius, gz0 - clear],
          [gz1 + clear, halfD - radius],
        ];
        for (const [z0, z1] of strips) {
          for (const c of hexGrid(stripX0, stripX1, z0, z1, step)) {
            bottomStrips.push({
              ...c,
              x: clamp(c.x + jitter(), stripX0, stripX1),
              z: clamp(c.z + jitter(), z0, z1),
            });
          }
        }
      }
    } else {
      // Campo con chute in mezzo: riempi tutto e scarta i centri sopra il buco.
      for (const c of hexGrid(-halfW + radius, halfW - radius, -halfD + radius, halfD - radius, step)) {
        const x = c.x + jitter();
        const z = c.z + jitter();
        const overX = x > gx0 - clear && x < gx1 + clear;
        const overZ = z > gz0 - clear && z < gz1 + clear;
        if (overX && overZ) continue;
        bottomMain.push({
          ...c,
          x: clamp(x, -halfW + radius, halfW - radius),
          z: clamp(z, -halfD + radius, halfD - radius),
        });
      }
    }
  } else {
    for (const c of hexGrid(-halfW + radius, halfW - radius, -halfD + radius, halfD - radius, step)) {
      bottomMain.push({ ...c, x: c.x + jitter(), z: c.z + jitter() });
    }
  }

  // Centra la pila sul baricentro dello strato basso principale.
  const pileX = bottomMain.length
    ? bottomMain.reduce((s, c) => s + c.x, 0) / bottomMain.length
    : 0;
  const pileZ = bottomMain.length
    ? bottomMain.reduce((s, c) => s + c.z, 0) / bottomMain.length
    : 0;
  const distanceFromPile = (p: { x: number; z: number }) =>
    Math.hypot(p.x - pileX, p.z - pileZ);

  // Buca esagonale: la sfera appoggia su tre capsule del piano inferiore.
  const pocketRise = (2 * radius) ** 2 - (step * step) / 3;
  const topY =
    floorY + radius + (pocketRise > 0 ? Math.sqrt(pocketRise) : 0) + TOP_CLEARANCE;
  const topPockets: TopSpot[] =
    pocketRise > 0
      ? pockets(bottomMain, step).map((p) => ({
          x: p.x + jitter() * 0.5,
          z: p.z + jitter() * 0.5,
          y: topY,
        }))
      : [];

  const allBottom: Cell[] = [...bottomMain, ...bottomStrips];
  const spots: Spot[] = [];
  const asSpot = (c: Cell): Spot => ({ x: c.x, y: bottomY, z: c.z });
  const sortPlan = (a: { x: number; z: number }, b: { x: number; z: number }) =>
    a.z - b.z || a.x - b.x;

  if (count <= allBottom.length) {
    // Pila piccola: usa solo lo strato basso, scelto dal centro verso fuori.
    const chosen = [...allBottom].sort((a, b) => distanceFromPile(a) - distanceFromPile(b));
    for (const c of chosen.slice(0, count).sort(sortPlan)) spots.push(asSpot(c));
  } else {
    for (const c of allBottom) spots.push(asSpot(c));
    const topCount = Math.min(count - allBottom.length, topPockets.length);
    const chosenTop = [...topPockets]
      .sort((a, b) => distanceFromPile(a) - distanceFromPile(b))
      .slice(0, topCount)
      .sort(sortPlan);
    for (const p of chosenTop) spots.push(p);

    // Strati successivi: buche triangolari sopra le capsule già posate.
    // Le quote sono calcolate perché ogni capsula appoggi su tre supporti
    // senza compenetrare; il filtro sul buco evita qualunque sporgenza.
    let prev: Spot[] = chosenTop;
    for (let layer = 0; layer < 6 && spots.length < count; layer++) {
      const candidates = layerPockets(prev, step, radius)
        .filter((p) => {
          if (Math.abs(p.x) > halfW - radius + 1e-9) return false;
          if (Math.abs(p.z) > halfD - radius + 1e-9) return false;
          if (p.x <= chuteSafeX) return false;
          return true;
        })
        .sort((a, b) => distanceFromPile(a) - distanceFromPile(b));

      // Due buche adiacenti condividono due supporti: si possono occupare solo
      // buche alternate, altrimenti le capsule dello stesso strato si toccano.
      const accepted: Spot[] = [];
      for (const c of candidates) {
        if (spots.length + accepted.length >= count) break;
        if (accepted.some((a) => Math.hypot(a.x - c.x, a.z - c.z) < radius * 2.001)) continue;
        accepted.push(c);
      }
      if (!accepted.length) break;
      accepted.sort(sortPlan);
      for (const p of accepted) spots.push(p);
      prev = accepted;
    }

    // Fallback per conteggi molto alti: mensole sicure sopra la pila, sempre
    // a destra dello chute e con spazio verticale calcolato per non
    // compenetrare nulla allo spawn.
    let shelfGuard = 0;
    while (spots.length < count && shelfGuard++ < 6) {
      const heightAt = (p: { x: number; z: number }) => {
        let y = floorY + radius + 0.004;
        for (const s of spots) {
          const d = Math.hypot(p.x - s.x, p.z - s.z);
          if (d >= radius * 2) continue;
          const need = Math.sqrt(Math.max(0, (radius * 2 * 1.002) ** 2 - d * d));
          y = Math.max(y, s.y + need);
        }
        return y + TOP_CLEARANCE;
      };
      const candidates = allBottom
        .filter(
          (c) =>
            c.x > chuteSafeX &&
            Math.abs(c.x) <= halfW - radius + 1e-9 &&
            Math.abs(c.z) <= halfD - radius + 1e-9
        )
        .map((c) => ({ x: c.x, z: c.z, y: heightAt(c) }))
        .sort((a, b) => distanceFromPile(a) - distanceFromPile(b));
      if (!candidates.length) break;
      const y = Math.max(...candidates.map((c) => c.y));
      const accepted: Spot[] = [];
      for (const c of candidates) {
        if (spots.length + accepted.length >= count) break;
        if (accepted.some((a) => Math.hypot(a.x - c.x, a.z - c.z) < radius * 2.001)) continue;
        accepted.push({ x: c.x, y, z: c.z });
      }
      if (!accepted.length) break;
      accepted.sort(sortPlan);
      for (const p of accepted) spots.push(p);
    }
  }

  return spots;
}
