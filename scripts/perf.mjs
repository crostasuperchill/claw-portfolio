import { chromium, devices } from 'playwright-core';

const URL = process.env.URL ?? 'http://localhost:4173/';
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });

for (const query of ['', '?notrans=1', '?noshadow=1', '?notrans=1&noshadow=1']) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(URL + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
          else res(n / ((performance.now() - t0) / 1000));
        };
        requestAnimationFrame(tick);
      })
  );
  const info = await page.evaluate(() => (window.__claw?.info ? window.__claw.info() : null));
  console.log(`"${query || 'baseline'}" fps=${fps.toFixed(1)}`, info ? JSON.stringify(info) : '');
  await ctx.close();
}
await browser.close();
