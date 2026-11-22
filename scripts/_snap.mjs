import { chromium, devices } from 'playwright-core';

const AGENT = process.env.AGENT ?? 'snap';
const URL = process.env.URL ?? 'http://localhost:5233/';
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const device = process.env.DEVICE === 'desktop' ? null : devices['iPhone 13'];
const ctx = await browser.newContext(device ? { ...device } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 90000 }).catch(() => logs.push('ready timeout'));
await page.waitForTimeout(Number(process.env.WAIT ?? 2600));
const path = `artifacts/${AGENT}.png`;
await page.screenshot({ path });
const stats = await page.evaluate(() => ({
  info: window.__claw?.info?.(),
  fps: window.__claw?.fps?.(),
  dpr: window.__studio?.renderer.getPixelRatio(),
  bloom: window.__studio?.bloom?.enabled,
  post: !!(window.__studio?.composer && window.__studio?.bloom?.enabled),
  dbg: window.__studio?.debugStats?.(),
}));
console.log(`saved ${path}`, JSON.stringify(stats));
console.log(logs.slice(0, 8).join('\n'));
await browser.close();
