import { chromium, devices } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  executablePath: EXE,
  headless: false,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(2500);

async function fps(ms = 2000) {
  return page.evaluate(
    (d) =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const tick = () => {
          n++;
          if (performance.now() - t0 < d) requestAnimationFrame(tick);
          else res(n / ((performance.now() - t0) / 1000));
        };
        requestAnimationFrame(tick);
      }),
    ms
  );
}

console.log('full post', (await fps()).toFixed(1), JSON.stringify(await page.evaluate(() => window.__claw.info())));
await page.evaluate(() => window.__studio.setPost(false));
await page.waitForTimeout(400);
console.log('no post  ', (await fps()).toFixed(1), JSON.stringify(await page.evaluate(() => window.__claw.info())));
await page.evaluate(() => window.__studio.setPost(true));
await page.evaluate(() => (window.__studio.bloom.enabled = false));
await page.waitForTimeout(400);
console.log('no bloom ', (await fps()).toFixed(1), JSON.stringify(await page.evaluate(() => window.__claw.info())));
await page.evaluate(() => window.__studio.setLeds(0));
await page.waitForTimeout(400);
console.log('leds 0   ', (await fps()).toFixed(1));
await page.evaluate(() => window.__studio.setLeds(9.5));
await page.waitForTimeout(300);

const dpr = await page.evaluate(() => window.devicePixelRatio);
console.log('dpr', dpr, 'viewport', await page.evaluate(() => [innerWidth, innerHeight]));
await browser.close();
