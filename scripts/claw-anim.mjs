/**
 * Misura l'animazione del braccio meccanico durante un ciclo completo.
 *
 * - apre Chrome headful (playwright-core)
 * - campiona l'altezza e l'apertura delle chele ogni 50 ms *di tempo simulato*
 *   (rAF page-side, dt identico al loop di main: min(0.05, frameDt)), cosi' la
 *   misura regge anche su una macchina carica
 * - stampa tabella, min/max, salti e jerk approssimato (differenza seconda)
 * - salva 6 frame in <out>/<label>-0X-*.png
 * - fallisce se un salto tra campioni consecutivi supera 0.15
 *
 * Uso: node scripts/claw-anim.mjs [--url=http://localhost:5173/] [--label=claw]
 *      [--out=artifacts] [--shots=6]
 *
 * Il campionamento legge window.__clawArm() se presente (probe read-only
 * esposto da Claw: altezza visuale, apertura per dito, sway, tilt); altrimenti
 * ricade su window.__claw.probe().
 */
import { chromium } from 'playwright-core';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const URL = arg('url', process.env.URL ?? 'http://localhost:5173/');
const OUT = arg('out', 'artifacts');
const LABEL = arg('label', 'claw');
const SHOTS = Number(arg('shots', '6'));
const W = Number(arg('w', '1200'));
const H = Number(arg('h', '760'));
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const JUMP_LIMIT = 0.15;
const STEP = 0.05;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false,
  args: [
    '--use-angle=metal',
    '--ignore-gpu-blocklist',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    `--window-size=${W},${H + 90}`,
  ],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

// pausa/ripresa del loop rAF: la cattura del canvas e' lenta su macchina carica,
// cosi' il fotogramma resta esattamente al momento voluto
await page.addInitScript(() => {
  const orig = window.requestAnimationFrame.bind(window);
  const queue = [];
  let frozen = false;
  window.__rafFreeze = (on) => {
    frozen = !!on;
    if (!frozen) {
      const cbs = queue.splice(0);
      for (const cb of cbs) orig(cb);
    }
  };
  window.requestAnimationFrame = (cb) => (frozen ? (queue.push(cb), 0) : orig(cb));
});
const logs = [];
let envKind = null;
page.on('console', (m) => {
  const text = m.text();
  if (text.startsWith('env:')) envKind = text.trim();
  if (m.type() === 'error') logs.push(`console: ${text}`);
});
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));

const boot = async () => {
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 90000 });
  await page.bringToFront();
  // l'HDRI locale puo' andare in timeout su una macchina carica: senza env la
  // scena resta bianca e gli screenshot sono inutilizzabili. Ricarichiamo.
  const t0 = Date.now();
  while (!envKind && Date.now() - t0 < 12000) await page.waitForTimeout(250);
  await page.waitForTimeout(1200);
};

await boot();
for (let i = 0; i < 2 && envKind !== 'env: hdri'; i++) {
  console.log(`env ${envKind ?? 'nessuno'}: ricarico (${i + 1})`);
  envKind = null;
  await boot();
}
console.log(`env: ${envKind ?? 'sconosciuto'}`);

// il loader e' un overlay CSS: con la finestra in background la transizione puo'
// restare a meta' e sporcare gli screenshot. Lo togliamo solo per la cattura.
await page.evaluate(() => {
  const el = document.getElementById('boot');
  if (el) el.style.display = 'none';
  document.getElementById('hint')?.classList.remove('show');
});

const hasArmProbe = await page.evaluate(() => typeof window.__clawArm === 'function');

// id dei progetti dal roster (per mirare a una capsula vera)
const roster = await readFile('src/game/roster.ts', 'utf8').catch(() => '');
const ids = [...roster.matchAll(/\bid:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

const projectPos = async (id) => {
  await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 20000 }).catch(() => {});
  return page.evaluate((pid) => window.__claw.projectPos(pid), id);
};

// il premio piu' in alto: e' quello che il claw puo' davvero afferrare
let target = null;
for (const id of ids) {
  const p = await projectPos(id);
  if (!p) continue;
  if (!target || p.y > target.y) target = { ...p, id };
}
console.log(
  `probe: ${hasArmProbe ? '__clawArm' : '__claw.probe'} | progetti: ${ids.length} | top: ${
    target ? `${target.id} @ ${target.x.toFixed(3)},${target.y.toFixed(3)},${target.z.toFixed(3)}` : 'n/a'
  }`
);

const startSampler = () =>
  page.evaluate(() => {
    const rows = [];
    window.__animSamples = rows;
    window.__animProg = { phase: '?', t: 0, sim: 0, done: false };
    const first = performance.now();
    let last = first;
    let sim = 0;
    let next = 0;
    let phase = null;
    let phaseT = 0;
    const cross = [null, null, null];
    let prevF = null;
    let prevSim = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      sim += dt;
      const claw = window.__claw;
      const st = claw?.state?.() ?? '?';
      if (st !== phase) {
        phase = st;
        phaseT = 0;
      } else {
        phaseT += dt;
      }
      window.__animProg = { phase, t: +phaseT.toFixed(3), sim: +sim.toFixed(3), done: false };
      const arm = window.__clawArm?.();
      if (arm?.f) {
        for (let k = 0; k < 3; k++) {
          if (cross[k] !== null) continue;
          if (arm.f[k] < 0.97) {
            // interpolazione sub-frame sull'attraversamento di 0.97
            if (prevF && prevF[k] >= 0.97) {
              const w = (prevF[k] - 0.97) / Math.max(1e-6, prevF[k] - arm.f[k]);
              cross[k] = +(prevSim + (sim - prevSim) * w).toFixed(4);
            } else {
              cross[k] = +sim.toFixed(4);
            }
          }
        }
        window.__animCross = cross;
        prevF = [arm.f[0], arm.f[1], arm.f[2]];
        prevSim = sim;
      }
      if (sim >= next) {
        let y = arm?.yVis;
        let open = arm?.open ?? null;
        let fingers = arm?.f ?? null;
        if (y === undefined) {
          const p = claw?.probe?.();
          y = p?.tipY ?? 0;
        }
        rows.push({
          t: +sim.toFixed(4),
          phase: st,
          y: +Number(y).toFixed(5),
          x: arm ? +Number(arm.x ?? 0).toFixed(5) : null,
          z: arm ? +Number(arm.z ?? 0).toFixed(5) : null,
          open: open === null ? null : +open.toFixed(4),
          f: fingers ? fingers.map((v) => +v.toFixed(4)) : null,
          sway: arm ? +Math.hypot(arm.swayX ?? 0, arm.swayZ ?? 0).toFixed(5) : null,
          tilt: arm ? +Math.hypot(arm.tiltX ?? 0, arm.tiltZ ?? 0).toFixed(5) : null,
          vy: arm ? +Number(arm.vy ?? 0).toFixed(4) : null,
          grabbed: arm ? !!arm.grabbed : null,
        });
        next += 0.05;
      }
      if (sim < 120) requestAnimationFrame(tick);
      else window.__animProg.done = true;
    };
    requestAnimationFrame(tick);
  });

const progress = () => page.evaluate(() => window.__animProg ?? { phase: '?', t: 0 });

const waitPhase = async (phase, at, timeout = 25000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const p = await progress();
    if (p.phase === phase && p.t >= at) return true;
    await page.waitForTimeout(40);
  }
  return false;
};

const closeCard = async () => {
  await page.evaluate(() => {
    const card = document.getElementById('card');
    if (card && !card.classList.contains('hidden')) document.getElementById('card-close')?.click();
  });
};

const shotPlan = [
  { phase: 'drop', at: 0.16, name: '01', label: 'anticipation' },
  { phase: 'drop', at: 0.9, name: '02', label: 'descent' },
  { phase: 'close', at: 0.72, name: '03', label: 'close' },
  { phase: 'lift', at: 0.38, name: '04', label: 'lift' },
  { phase: 'carry', at: 0.5, name: '05', label: 'carry' },
  { phase: 'return', at: 0.42, name: '06', label: 'return' },
].slice(0, SHOTS);

/**
 * Aspetta la fase e cattura il canvas nello stesso task: attesa, freeze e
 * render avvengono dentro la pagina, cosi' la latenza CDP non sposta il frame.
 */
const captureAt = async (file, phase, at) => {
  const data = await page.evaluate(
    async ({ phase: ph, at: thr }) =>
      await new Promise((resolve) => {
        const t0 = performance.now();
        const check = () => {
          const p = window.__animProg;
          if (p && p.phase === ph && p.t >= thr) {
            try {
              window.__rafFreeze?.(true);
              const s = window.__studio;
              if (!s) return resolve(null);
              if (s.composer) s.composer.render();
              else s.renderer.render(s.scene, s.camera);
              const url = s.renderer.domElement.toDataURL('image/png');
              const arm = window.__clawArm?.();
              window.__rafFreeze?.(false);
              resolve({ url, y: arm ? +arm.yVis.toFixed(3) : null, open: arm ? +arm.open.toFixed(2) : null, grabbed: !!arm?.grabbed });
            } catch {
              resolve(null);
            }
            return;
          }
          if (performance.now() - t0 > 30000) return resolve(null);
          requestAnimationFrame(check);
        };
        requestAnimationFrame(check);
      }),
    { phase, at }
  );
  if (!data?.url) return null;
  await writeFile(file, Buffer.from(data.url.split(',')[1], 'base64'));
  return { y: data.y, open: data.open, grabbed: data.grabbed };
};

// ─── ciclo misurato: campionamento + 6 frame (con pausa durante la cattura) ──
const aimPoint = target ? { x: target.x, z: target.z } : { x: 0.0, z: 0.09 };
const startCycle = async () => {
  await closeCard();
  await page.evaluate((p) => {
    window.__claw.aim(p.x, p.z);
    window.__claw.drop();
  }, aimPoint);
};

await startSampler();
await startCycle();

const frames = [];
for (const shot of shotPlan) {
  const file = path.join(OUT, `${LABEL}-${shot.name}.png`);
  const state = await captureAt(file, shot.phase, shot.at);
  if (!state) {
    console.log(`frame ${shot.name}: fase ${shot.phase} non raggiunta`);
    continue;
  }
  frames.push({ file, phase: shot.phase, at: shot.at, label: shot.label, state });
  console.log(
    `frame ${shot.name} (${shot.label}, ${shot.phase}@${shot.at}s) -> ${file}  y ${state.y} open ${state.open}${
      state.grabbed ? ' grab' : ''
    }`
  );
}

await waitPhase('idle', 0, 30000);
const rows = (await page.evaluate(() => window.__animSamples ?? [])).filter((r) => Number.isFinite(r.y));

if (!rows.length) {
  console.error('nessun campione raccolto');
  await browser.close();
  process.exit(1);
}

// solo il ciclo: dal primo campione non-idle all'ultimo campione non-idle consecutivo
const startI = rows.findIndex((r) => r.phase !== 'idle');
let endI = rows.length - 1;
for (let i = startI; i < rows.length; i++) {
  if (rows[i].phase === 'idle') {
    endI = i;
    break;
  }
}
const cycle = rows.slice(startI, endI + 1);
const t0 = cycle[0].t;
const tEnd = cycle[cycle.length - 1].t;

// griglia uniforme 50 ms (interpolazione lineare dei campioni rAF)
const grid = [];
for (let t = 0; t <= tEnd - t0 + 1e-9; t += STEP) {
  const at = t0 + t;
  let i = 0;
  while (i < cycle.length - 1 && cycle[i + 1].t < at) i++;
  const a = cycle[i];
  const b = cycle[Math.min(i + 1, cycle.length - 1)];
  const span = Math.max(1e-6, b.t - a.t);
  const w = Math.max(0, Math.min(1, (at - a.t) / span));
  const mix = (k) => (a[k] === null || b[k] === null ? null : a[k] + (b[k] - a[k]) * w);
  grid.push({
    t: +t.toFixed(3),
    phase: w < 0.5 ? a.phase : b.phase,
    y: mix('y'),
    x: mix('x'),
    z: mix('z'),
    open: mix('open'),
    f: a.f && b.f ? a.f.map((v, k) => v + (b.f[k] - v) * w) : null,
    sway: mix('sway'),
    tilt: mix('tilt'),
  });
}

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const minmax = (key) => {
  const vals = grid.map((g) => g[key]).filter(finite);
  return { min: Math.min(...vals), max: Math.max(...vals) };
};
const diff = (key) => grid.map((g, i) => (i === 0 || !finite(g[key]) || !finite(grid[i - 1][key]) ? null : g[key] - grid[i - 1][key]));
const diff2 = (key) =>
  grid.map((g, i) =>
    i < 2 || !finite(g[key]) || !finite(grid[i - 1][key]) || !finite(grid[i - 2][key])
      ? null
      : g[key] - 2 * grid[i - 1][key] + grid[i - 2][key]
  );
const maxAbs = (arr) => arr.reduce((m, v) => (finite(v) ? Math.max(m, Math.abs(v)) : m), 0);
const meanAbs = (arr) => {
  const vals = arr.filter(finite).map(Math.abs);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
};
const spikes = (arr) => {
  const vals = arr.filter(finite).map(Math.abs).sort((a, b) => a - b);
  if (!vals.length) return 0;
  const med = vals[Math.floor(vals.length / 2)] || 0;
  const lim = Math.max(med * 4, 1e-6);
  return vals.filter((v) => v > lim).length;
};

const dy = diff('y');
const d2y = diff2('y');
const dop = diff('open');
const d2op = diff2('open');

const phases = [];
for (const g of grid) {
  const last = phases[phases.length - 1];
  if (!last || last.phase !== g.phase) phases.push({ phase: g.phase, t0: g.t, t1: g.t });
  else last.t1 = g.t;
}

const jumps = [];
for (let i = 1; i < grid.length; i++) {
  if (Math.abs(grid[i].y - grid[i - 1].y) > JUMP_LIMIT) jumps.push(`y @${grid[i].t}s: ${(grid[i].y - grid[i - 1].y).toFixed(3)}`);
  if (finite(grid[i].open) && finite(grid[i - 1].open) && Math.abs(grid[i].open - grid[i - 1].open) > JUMP_LIMIT) {
    jumps.push(`open @${grid[i].t}s: ${(grid[i].open - grid[i - 1].open).toFixed(3)}`);
  }
}

// sfalsamento: primo istante (sui campioni rAF, non sulla griglia) in cui ogni
// dito scende sotto 0.97 di apertura, interpolato tra due campioni
const crossTime = (k) => {
  for (let i = 1; i < cycle.length; i++) {
    const a = cycle[i - 1].f?.[k];
    const b = cycle[i].f?.[k];
    if (a === undefined || b === undefined) continue;
    if (a >= 0.97 && b < 0.97) {
      const span = Math.max(1e-6, cycle[i].t - cycle[i - 1].t);
      return cycle[i - 1].t + span * ((a - 0.97) / Math.max(1e-6, a - b));
    }
  }
  return null;
};
const measuredCross = (await page.evaluate(() => window.__animCross ?? [null, null, null])) || [null, null, null];
// tempi assoluti (sim) del primo istante sotto 0.97 per dito; contano le differenze
const stagger = [0, 1, 2].map((k) => measuredCross[k] ?? crossTime(k));
const staggerDeltas = stagger.map((v, i) => (i && v !== null && stagger[i - 1] !== null ? +((v - stagger[i - 1]) * 1000).toFixed(0) : null));

// velocita' orizzontale massima per fase (andata vs ritorno)
const speedByPhase = {};
for (let i = 1; i < grid.length; i++) {
  if (!finite(grid[i].x) || !finite(grid[i - 1].x)) continue;
  const v = Math.hypot(grid[i].x - grid[i - 1].x, grid[i].z - grid[i - 1].z) / STEP;
  const p = grid[i].phase;
  speedByPhase[p] = Math.max(speedByPhase[p] ?? 0, v);
}

const grabbed = grid.some((g) => g.phase === 'lift') && cycle.some((r) => r.grabbed && r.phase === 'lift');
const fmt = (v, d = 4) => (finite(v) ? v.toFixed(d).padStart(8) : '       -');
const pad = (s, n) => String(s).padEnd(n);

console.log(`\n=== ${LABEL} | ${URL} | grabbed: ${grabbed ? 'yes' : 'no'} | probe: ${hasArmProbe ? '__clawArm' : 'probe-tip'} ===\n`);
console.log(`${pad('t', 6)}${pad('phase', 8)}${pad('y', 9)}${pad('dy', 9)}${pad('d2y', 9)}${pad('open', 9)}${pad('dopen', 9)}${pad('d2open', 9)}${pad('sway', 8)}${pad('tilt', 8)}`);
for (let i = 0; i < grid.length; i++) {
  const g = grid[i];
  console.log(
    `${g.t.toFixed(2).padStart(4)}  ${pad(g.phase, 8)}${fmt(g.y)}${fmt(dy[i])}${fmt(d2y[i])}${fmt(g.open, 3)}${fmt(dop[i])}${fmt(d2op[i])}${fmt(g.sway, 4)}${fmt(g.tilt, 3)}`
  );
}

console.log('\n--- fasi -----------------------------------------------------------');
for (const p of phases) console.log(`${pad(p.phase, 8)} ${p.t0.toFixed(2)}s -> ${p.t1.toFixed(2)}s  (${(p.t1 - p.t0 + STEP).toFixed(2)}s)`);

const yRange = minmax('y');
const opRange = minmax('open');
console.log('\n--- sintesi --------------------------------------------------------');
console.log(`y        min ${yRange.min.toFixed(4)}  max ${yRange.max.toFixed(4)}  corsa ${(yRange.max - yRange.min).toFixed(4)}`);
console.log(`open     min ${opRange.min.toFixed(3)}  max ${opRange.max.toFixed(3)}`);
console.log(`|dy|     max ${maxAbs(dy).toFixed(4)}   medio ${meanAbs(dy).toFixed(4)}`);
console.log(`|d2y|    max ${maxAbs(d2y).toFixed(4)}   medio ${meanAbs(d2y).toFixed(4)}   spikes ${spikes(d2y)}`);
console.log(`|dopen|  max ${maxAbs(dop).toFixed(4)}   medio ${meanAbs(dop).toFixed(4)}`);
console.log(`|d2open| max ${maxAbs(d2op).toFixed(4)}   medio ${meanAbs(d2op).toFixed(4)}   spikes ${spikes(d2op)}`);
console.log(`sway     max ${maxAbs(grid.map((g) => g.sway)).toFixed(4)} m   tilt max ${maxAbs(grid.map((g) => g.tilt)).toFixed(4)} rad`);
console.log(
  `stagger  ${stagger.map((v) => (v === null ? '-' : v.toFixed(2))).join(' / ')} s  ->  ${staggerDeltas
    .map((v) => (v === null ? '-' : `${v}ms`))
    .join(' / ')}`
);
console.log(`xy speed  ${Object.entries(speedByPhase).map(([p, v]) => `${p} ${v.toFixed(2)}m/s`).join('  ')}`);
console.log(`jump>${JUMP_LIMIT}  ${jumps.length ? jumps.join(' | ') : 'nessuno'}`);
console.log(`frames   ${frames.length}`);
if (logs.length) console.log(`errori pagina: ${logs.slice(0, 5).join(' | ')}`);

const summary = {
  label: LABEL,
  url: URL,
  probe: hasArmProbe ? '__clawArm' : 'probe-tip',
  grabbed,
  cycleDuration: +(tEnd - t0 + STEP).toFixed(2),
  phases,
  y: yRange,
  open: opRange,
  dy: { max: maxAbs(dy), mean: meanAbs(dy) },
  d2y: { max: maxAbs(d2y), mean: meanAbs(d2y), spikes: spikes(d2y) },
  dopen: { max: maxAbs(dop), mean: meanAbs(dop) },
  d2open: { max: maxAbs(d2op), mean: meanAbs(d2op), spikes: spikes(d2op) },
  swayMax: maxAbs(grid.map((g) => g.sway)),
  tiltMax: maxAbs(grid.map((g) => g.tilt)),
  stagger,
  staggerDeltas,
  speedByPhase,
  jumps,
  frames,
  grid,
};
const file = path.join(OUT, `${LABEL}-anim.json`);
await writeFile(file, JSON.stringify(summary, null, 1));
console.log(`dati     ${file}`);

await browser.close();

if (jumps.length) {
  console.error(`\nFALLITO: ${jumps.length} salti oltre ${JUMP_LIMIT}`);
  process.exit(2);
}
