import { chromium, devices } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=metal'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(600);

const vp = page.viewportSize();
const before = await page.evaluate(() => window.__claw.target());

// 1. drag nella zona comandi in basso a sinistra
const sx = vp.width * 0.24;
const sy = vp.height * 0.8;
await page.mouse.move(sx, sy);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(sx + i * 5, sy);
  await page.waitForTimeout(60);
}
await page.mouse.up();
await page.waitForTimeout(200);
const after = await page.evaluate(() => window.__claw.target());

// 2. drag al centro del vetro NON deve muovere il claw
await page.mouse.move(vp.width * 0.5, vp.height * 0.42);
await page.mouse.down();
for (let i = 1; i <= 6; i++) {
  await page.mouse.move(vp.width * 0.5 + i * 12, vp.height * 0.42);
  await page.waitForTimeout(50);
}
await page.mouse.up();
await page.waitForTimeout(200);
const afterGlass = await page.evaluate(() => window.__claw.target());

console.log('before  ', before);
console.log('afterStk', after, 'deltaX', (after.x - before.x).toFixed(3));
console.log('afterGls', afterGlass, 'deltaX', (afterGlass.x - after.x).toFixed(3));

const stickWorks = Math.abs(after.x - before.x) > 0.02;
const glassIgnored = Math.abs(afterGlass.x - after.x) < 0.005;
console.log(stickWorks ? 'OK stick muove il claw' : 'FAIL stick non muove');
console.log(glassIgnored ? 'OK vetro non muove' : 'FAIL il vetro muove ancora il claw');
await browser.close();
process.exit(stickWorks && glassIgnored ? 0 : 1);
