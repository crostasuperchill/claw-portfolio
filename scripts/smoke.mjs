import { chromium, devices } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const URL = process.env.URL ?? 'http://127.0.0.1:4173/';
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  headless: false,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });

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

const won = await page.evaluate(() => window.__claw.testGrab('magicwall'));
await page.waitForSelector('[data-prize="magicwall"]', { timeout: 30000 });
await page.screenshot({ path: 'artifacts/iphone-prize.png' });

await browser.close();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (!won) {
  console.error('grab failed');
  process.exit(1);
}
if (fps < 45) {
  console.error(`fps ${fps.toFixed(1)} < 45`);
  process.exit(1);
}
console.log(`OK fps=${fps.toFixed(1)}`);
