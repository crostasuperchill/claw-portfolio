import { chromium, devices } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto('http://localhost:5233/?noauto', { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 90000 });
await page.waitForTimeout(2200);

await page.screenshot({ path: 'artifacts/_px-bloom.png' });
await page.evaluate(() => (window.__studio.bloom.enabled = false));
await page.waitForTimeout(400);
await page.screenshot({ path: 'artifacts/_px-nobloom.png' });
await page.evaluate(() => {
  document.querySelectorAll('#hud, #hint').forEach((e) => (e.style.visibility = 'hidden'));
  document.getElementById('stage').style.visibility = 'hidden';
});
await page.waitForTimeout(200);
await page.screenshot({ path: 'artifacts/_px-nocanvas.png' });
await browser.close();
