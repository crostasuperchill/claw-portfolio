#!/usr/bin/env node
/**
 * physics-check.mjs — verifica numerica della fisica delle capsule.
 *
 * Apre il gioco con Playwright, aspetta 4 s di simulazione, campiona 10 capsule
 * per 2 s e stampa:
 *   - velocità media residua (deve essere < 0.01 m/s: capsule ferme/addormentate)
 *   - massima compenetrazione stimata (capsule-capsule e capsule-pavimento)
 *   - capsule cadute nello chute da sole (deve essere 0)
 * Poi esegue un grab di test su "magicwall" e verifica che la capsula presa si
 * sia mossa di > 0.3 m (lift + carry + drop).
 *
 * Uso:
 *   node scripts/physics-check.mjs                 # avvia da solo il dev server
 *   URL=http://localhost:4173/ node scripts/physics-check.mjs
 *   HEADLESS=1 node scripts/physics-check.mjs      # per CI (WebGL più lento)
 *
 * Exit code 0 se tutti i criteri passano, 1 altrimenti.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HEADLESS = process.env.HEADLESS === '1';
const PRIZE_ID = 'magicwall';

const THRESHOLDS = {
  residualSpeed: 0.01, // m/s
  penetration: 0.002, // m (tolleranza contact skin)
  dropDistance: 0.3, // m
};

function log(msg) {
  console.log(`[physics-check] ${msg}`);
}

function resolveChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error('Chrome non trovato: imposta CHROME_PATH');
  return found;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 30_000, child = null) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (child && child.exitCode !== null) {
      throw new Error(`server uscito con codice ${child.exitCode}`);
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (res.ok) return;
    } catch {
      /* non ancora pronto */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`server non raggiungibile entro ${timeoutMs} ms: ${url}`);
}

async function ensureServer() {
  if (process.env.URL) {
    const url = process.env.URL;
    await waitForServer(url);
    return { url, stop: () => {} };
  }

  // Build + preview: niente HMR che ricarica la pagina a metà campionamento.
  // (Il typecheck completo resta `npm run build`, che include tsc.)
  if (process.env.NO_BUILD !== '1') {
    log('build produzione…');
    const build = spawnSync(
      process.execPath,
      [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--logLevel', 'warn'],
      { cwd: ROOT, stdio: 'inherit' }
    );
    if (build.status !== 0) throw new Error(`vite build fallita (exit ${build.status})`);
  }

  const port = await freePort();
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const url = `http://127.0.0.1:${port + attempt}/`;
    const child = spawn(
      process.execPath,
      [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port + attempt), '--strictPort'],
      { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let out = '';
    child.stdout.on('data', (d) => (out += d.toString()));
    child.stderr.on('data', (d) => (out += d.toString()));
    try {
      await waitForServer(url, 45_000, child);
    } catch (err) {
      lastError = err;
      child.kill('SIGTERM');
      if (attempt < 2) continue;
      console.error(out.slice(-2000));
      throw err;
    }
    if (process.env.DEBUG === '1') {
      child.stdout.on('data', (d) => process.stderr.write(`[vite] ${d}`));
      child.stderr.on('data', (d) => process.stderr.write(`[vite] ${d}`));
    }
    log(`preview: ${url}`);
    return {
      url,
      stop: () => {
        child.kill('SIGTERM');
      },
    };
  }
  throw lastError ?? new Error('preview non avviata');
}

async function main() {
  const server = await ensureServer();
  let browser = null;
  let passed = true;

  try {
    browser = await chromium.launch({
      executablePath: resolveChrome(),
      headless: HEADLESS,
      args: [
        '--use-angle=metal',
        '--ignore-gpu-blocklist',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => log(`PAGE ERROR: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') log(`console.${m.type()}: ${m.text()}`);
    });
    page.setDefaultTimeout(60_000);

    await page.goto(server.url, { waitUntil: 'load' });
    await page.bringToFront();
    await page.waitForFunction(
      () => window.__claw?.ready === true && typeof window.__physics?.time === 'function',
      null,
      { timeout: 60_000 }
    );

    // Istantanea appena pronta: servirà a misurare quanto la pila "si muove"
    // da sola nei primi secondi (assestamento).
    const initialSnap = await page.evaluate(() => window.__physics.capsules());

    // 4 secondi di simulazione: la pila deve essersi assestata.
    await page.waitForFunction(() => window.__physics.time() >= 4, null, {
      timeout: 60_000,
      polling: 100,
    });

    const sample = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const P = window.__physics;
          const all = P.capsules();
          const n = Math.min(10, all.length);
          // 10 capsule distribuite su tutta la pila (ordinate per altezza).
          const order = all.map((_, i) => i).sort((a, b) => all[a].y - all[b].y);
          const pick = [];
          for (let i = 0; i < n; i++) pick.push(order[Math.floor(((i + 0.5) * order.length) / n)]);

          const t0 = P.time();
          const wall0 = performance.now();
          let sum = 0;
          let samples = 0;
          let maxSpeed = 0;
          const speeds = [];

          const finish = () => {
            const snap = P.capsules();
            resolve({
              simSeconds: P.time() - t0,
              meanSpeed: samples ? sum / samples : 0,
              maxSpeed,
              samples,
              frames: speeds.length,
              picked: pick.map((i) => ({
                x: snap[i]?.x ?? 0,
                y: snap[i]?.y ?? 0,
                z: snap[i]?.z ?? 0,
                sleeping: snap[i]?.sleeping ?? false,
              })),
            });
          };

          const tick = () => {
            if (P.time() - t0 >= 2) return finish();
            if (performance.now() - wall0 > 20_000) return finish();
            const cs = P.capsules();
            let frameMax = 0;
            for (const i of pick) {
              const c = cs[i];
              if (!c) continue;
              const s = Math.hypot(c.vx, c.vy, c.vz);
              sum += s;
              samples++;
              if (s > frameMax) frameMax = s;
            }
            maxSpeed = Math.max(maxSpeed, frameMax);
            speeds.push(frameMax);
            requestAnimationFrame(tick);
          };
          tick();
        })
    );

    const state = await page.evaluate(() => {
      const P = window.__physics;
      const caps = P.capsules();
      const ys = caps.map((c) => c.y).sort((a, b) => a - b);
      return {
        total: P.total(),
        sleeping: P.sleeping(),
        fallen: P.fallen(),
        lost: P.lost(),
        penetration: P.penetration(),
        capsuleList: caps,
        yMin: ys[0] ?? 0,
        yMax: ys[ys.length - 1] ?? 0,
        simTime: P.time(),
      };
    });

    // Quanto si sono spostate le capsule dal momento in cui la scena è pronta
    // fino allo stato assestato (4 s). Una pila che "vibra/rotola/collassa"
    // mostra spostamenti grandi anche se poi si addormenta.
    const initialByHandle = new Map(initialSnap.map((c) => [c.handle, c]));
    const moves = [];
    for (const c of state.capsuleList) {
      const i = initialByHandle.get(c.handle);
      if (!i) continue;
      moves.push(Math.hypot(c.x - i.x, c.y - i.y, c.z - i.z));
    }
    const settleMean = moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : 0;
    const settleMax = moves.length ? Math.max(...moves) : 0;
    const settleOver5cm = moves.filter((m) => m > 0.05).length;
    const initialTotal = initialSnap.length;

    const initial = await page.evaluate((id) => window.__claw.projectPos(id), PRIZE_ID);
    const grabResult = await page.evaluate((id) => window.__claw.testGrab(id), PRIZE_ID);
    const final = await page.evaluate((id) => window.__claw.projectPos(id), PRIZE_ID);
    const dropDistance =
      initial && final
        ? Math.hypot(final.x - initial.x, final.y - initial.y, final.z - initial.z)
        : 0;
    const maxPen = Math.max(state.penetration.pair, state.penetration.floor);

    log('');
    log('── resoconto ─────────────────────────────────────────────');
    log(`capsule: ${state.total} vive, ${state.lost} perse nello chute (all'inizio ${initialTotal})`);
    log(`addormentate a riposo: ${state.sleeping}/${state.total}`);
    log(`velocità media residua (10 capsule, 2 s): ${sample.meanSpeed.toFixed(5)} m/s  [< ${THRESHOLDS.residualSpeed}]`);
    log(`velocità massima residua: ${sample.maxSpeed.toFixed(5)} m/s`);
    log(
      `compenetrazione max: ${(maxPen * 1000).toFixed(2)} mm ` +
        `(coppie ${(state.penetration.pair * 1000).toFixed(2)} mm, pavimento ${(state.penetration.floor * 1000).toFixed(2)} mm)  [<= ${THRESHOLDS.penetration * 1000} mm]`
    );
    log(`capsule cadute nello chute da sole: ${state.fallen}  [= 0]`);
    log(
      `assestamento 0→4 s: spostamento medio ${(settleMean * 1000).toFixed(1)} mm, ` +
        `max ${(settleMax * 1000).toFixed(1)} mm, capsule mosse >50 mm: ${settleOver5cm}`
    );
    log(`altezza pila: y ${state.yMin.toFixed(3)} → ${state.yMax.toFixed(3)}  [t=${state.simTime.toFixed(2)} s]`);
    log(
      `grab+drop ${PRIZE_ID}: ${grabResult ? 'ok' : 'FALLITO'}  spostamento ${dropDistance.toFixed(3)} m  [> ${THRESHOLDS.dropDistance}]`
    );

    const checks = [
      ['velocità residua < 0.01', sample.meanSpeed < THRESHOLDS.residualSpeed],
      ['compenetrazione <= 0.002 m', maxPen <= THRESHOLDS.penetration],
      ['nessuna capsula persa nello chute', state.lost === 0],
      ['tutte le capsule presenti', state.total === initialTotal],
      ['capsule addormentate a riposo', state.sleeping === state.total],
      ['grab di test riuscito', grabResult === true],
      ['capsula mossa di > 0.3 m', dropDistance > THRESHOLDS.dropDistance],
    ];
    log('');
    for (const [name, ok] of checks) {
      log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
      if (!ok) passed = false;
    }
    log('──────────────────────────────────────────────────────────');
  } finally {
    if (browser) await browser.close();
    server.stop();
  }

  process.exitCode = passed ? 0 : 1;
}

main().catch((err) => {
  console.error(`[physics-check] errore: ${err?.stack ?? err}`);
  process.exitCode = 1;
});
