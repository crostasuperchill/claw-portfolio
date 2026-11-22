import { chromium, devices } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=metal'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
await page.goto('http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(1000);
console.log(JSON.stringify(await page.evaluate(() => window.__claw.stats()), null, 1));
await browser.close();
