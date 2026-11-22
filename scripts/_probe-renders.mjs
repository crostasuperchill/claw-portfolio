import { chromium, devices } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, headless: false, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(process.env.URL ?? 'http://localhost:4173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const a = await page.evaluate(() => window.__studio.debugStats());
await page.waitForTimeout(2000);
const b = await page.evaluate(() => window.__studio.debugStats());
console.log('frames', b.frames - a.frames, 'sceneRenders', b.sceneRenders - a.sceneRenders);
console.log('now', JSON.stringify(b));
console.log('shadowAuto', await page.evaluate(() => window.__studio.sun.shadow.autoUpdate));
console.log('dpr', await page.evaluate(() => window.__studio.renderer.getPixelRatio()));
await browser.close();
