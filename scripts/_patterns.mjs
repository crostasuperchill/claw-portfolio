import { chromium, devices } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const base = process.env.URL ?? 'http://localhost:4173/';
const variants = process.env.QS ? process.env.QS.split(',') : ['?noauto', '?noauto&nopost', '?noauto&noshadow', '?noauto&nopost&noshadow'];

const browser = await chromium.launch({ executablePath: EXE, headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });

for (const q of variants) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', e.message));
  await page.goto(base + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(2200);
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 < 2500) requestAnimationFrame(tick);
          else res(n / ((performance.now() - t0) / 1000));
        };
        requestAnimationFrame(tick);
      })
  );
  const info = await page.evaluate(() => window.__claw.info());
  const dbg = await page.evaluate(() => window.__studio.debugStats());
  console.log(`"${q}" fps=${fps.toFixed(1)}`, JSON.stringify(info), 'renders/frame', (dbg.sceneRenders / dbg.frames).toFixed(2), 'dpr', await page.evaluate(() => window.__studio.renderer.getPixelRatio()));
  await ctx.close();
}
await browser.close();
