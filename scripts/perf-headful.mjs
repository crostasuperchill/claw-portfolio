import { chromium, devices } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath: EXE,
  headless: false,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(2000);
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
const info = await page.evaluate(() => window.__claw.info());
console.log('headful fps', fps.toFixed(1), JSON.stringify(info));
await browser.close();
