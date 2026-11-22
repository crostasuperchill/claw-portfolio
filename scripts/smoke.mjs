#!/usr/bin/env node
/**
 * Smoke test end-to-end del claw portfolio.
 *
 * Apre il sito in Chrome (headful di default: il WebGL headless gira a ~15 fps
 * e falsa sia il test di performance sia il comportamento fisico), attende che
 * la scena sia pronta, esegue un grab deterministico su "magicwall", verifica
 * che compaia la prize card e salva uno screenshot in artifacts/iphone-prize.png.
 *
 * Env:
 *   URL          URL da testare            (default http://localhost:4173/)
 *   TIMEOUT      timeout globale in ms     (default 120000)
 *   HEADLESS=1   forza Chrome headless     (per CI, niente gate sugli fps)
 *   MIN_FPS      soglia fps headful        (default 30, 0 = disabilitata)
 *   CHROME_PATH  path esplicito di Chrome  (default: Chrome di sistema)
 *
 * Exit code: 0 se tutto passa, 1 con messaggio ed errore dettagliato altrimenti.
 */
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright-core';

const URL = process.env.URL ?? 'http://localhost:4173/';
const HEADLESS = process.env.HEADLESS === '1';
const TIMEOUT = positiveInt(process.env.TIMEOUT, 120_000);
const MIN_FPS = Number(process.env.MIN_FPS ?? 30);
const PRIZE_ID = 'magicwall';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ARTIFACT_DIR = path.join(ROOT, 'artifacts');
const ARTIFACT = path.join(ARTIFACT_DIR, 'iphone-prize.png');
const FAILURE_ARTIFACT = path.join(ARTIFACT_DIR, 'iphone-failure.png');

let browser = null;
let page = null;
let timedOut = false;

function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

function log(message) {
  console.log(`[smoke] ${message}`);
}

function resolveChrome() {
  if (process.env.CHROME_PATH) {
    if (!existsSync(process.env.CHROME_PATH)) {
      throw new Error(`CHROME_PATH non esiste: ${process.env.CHROME_PATH}`);
    }
    return process.env.CHROME_PATH;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      'Chrome non trovato. Installa Google Chrome oppure imposta CHROME_PATH al percorso dell\'eseguibile.'
    );
  }
  return found;
}

async function measureFps(target) {
  return target.evaluate(
    () =>
      new Promise((resolve) => {
        let frames = 0;
        const start = performance.now();
        const tick = () => {
          frames += 1;
          const elapsed = performance.now() - start;
          if (elapsed < 3000) requestAnimationFrame(tick);
          else resolve(frames / (elapsed / 1000));
        };
        requestAnimationFrame(tick);
      })
  );
}

async function run() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const executablePath = resolveChrome();
  log(`Chrome ${HEADLESS ? 'headless' : 'headful'}: ${executablePath}`);

  const args = ['--ignore-gpu-blocklist'];
  if (process.platform === 'darwin') args.push('--use-angle=metal');

  browser = await chromium.launch({ executablePath, headless: HEADLESS, args });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  page = await context.newPage();

  const runtimeErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    runtimeErrors.push(`pageerror: ${error.message}`);
  });

  log(`carico ${URL}`);
  let response;
  try {
    response = await page.goto(URL, { waitUntil: 'load', timeout: TIMEOUT });
  } catch (error) {
    throw new Error(
      `impossibile aprire ${URL}: ${error instanceof Error ? error.message : String(error)}. ` +
        `Il server è avviato? Prova con "npm run preview".`
    );
  }
  if (!response || !response.ok()) {
    throw new Error(`HTTP ${response ? response.status() : 'nessuna risposta'} su ${URL}`);
  }

  log('attendo window.__claw.ready');
  await page.waitForFunction(() => window.__claw?.ready === true, undefined, { timeout: TIMEOUT });

  const fps = await measureFps(page);
  log(`fps ${fps.toFixed(1)}`);
  if (!HEADLESS && Number.isFinite(MIN_FPS) && MIN_FPS > 0 && fps < MIN_FPS) {
    throw new Error(
      `fps ${fps.toFixed(1)} sotto la soglia ${MIN_FPS}: WebGL non sta girando in GPU (usa headful, non headless)`
    );
  }

  log(`testGrab('${PRIZE_ID}')`);
  const won = await page.evaluate((id) => window.__claw.testGrab(id), PRIZE_ID);
  if (won !== true) {
    throw new Error(
      `testGrab('${PRIZE_ID}') ha restituito ${String(won)}: il premio non è stato afferrato o la card non si è aperta`
    );
  }

  log('attendo la prize card');
  await page.waitForSelector('[data-prize]', { state: 'visible', timeout: TIMEOUT });
  const shownPrize = await page.evaluate(
    () => document.getElementById('card')?.dataset.prize ?? null
  );
  if (shownPrize !== PRIZE_ID) {
    log(`attenzione: card aperta su "${String(shownPrize)}" invece di "${PRIZE_ID}"`);
  }
  await page.waitForTimeout(500); // lascia finire la transizione della card
  await page.screenshot({ path: ARTIFACT });
  log(`screenshot salvato in ${ARTIFACT}`);

  if (runtimeErrors.length > 0) {
    throw new Error(`errori runtime (${runtimeErrors.length}):\n  - ${runtimeErrors.join('\n  - ')}`);
  }

  return fps;
}

async function captureFailure() {
  if (!page || page.isClosed()) return;
  try {
    await page.screenshot({ path: FAILURE_ARTIFACT });
    log(`screenshot di failure salvato in ${FAILURE_ARTIFACT}`);
  } catch {
    // best effort: la pagina potrebbe essere già chiusa
  }
}

async function collectDiagnostics() {
  if (!page || page.isClosed()) return null;
  try {
    return await page.evaluate(() => {
      const claw = window.__claw;
      if (!claw) return null;
      const debug = claw.debug?.() ?? null;
      let pendingPos = null;
      try {
        pendingPos = debug?.pending ? claw.projectPos(debug.pending) : null;
      } catch {
        pendingPos = null;
      }
      return { state: claw.state?.() ?? null, debug, pendingPos };
    });
  } catch {
    return null;
  }
}

const watchdog = setTimeout(() => {
  timedOut = true;
  console.error(`[smoke] FAIL timeout globale di ${TIMEOUT} ms superato (URL: ${URL})`);
  void browser?.close().catch(() => {});
  // se la chiusura del browser si blocca, esci comunque
  setTimeout(() => process.exit(1), 3000);
}, TIMEOUT);

let exitCode = 1;
try {
  const fps = await run();
  log(`OK fps=${fps.toFixed(1)}`);
  exitCode = 0;
} catch (error) {
  await captureFailure();
  if (!timedOut) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[smoke] FAIL: ${message}`);
    const diagnostics = await collectDiagnostics();
    if (diagnostics) {
      console.error(`[smoke] stato al momento del fail: ${JSON.stringify(diagnostics)}`);
    }
    if (error instanceof Error && error.stack) {
      console.error(error.stack.split('\n').slice(1).join('\n'));
    }
  }
} finally {
  clearTimeout(watchdog);
  if (browser) {
    try {
      await browser.close();
    } catch {
      // ignore: il browser può essere già morto (timeout o crash)
    }
  }
}

process.exit(exitCode);
