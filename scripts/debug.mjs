import { chromium, devices } from 'playwright-core';

const URL = 'http://localhost:4173/';
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=metal'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror:', e.message));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
await page.waitForTimeout(1500);

const out = await page.evaluate(async () => {
  const c = window.__claw;
  const log = [];
  c.testGrab('magicwall');
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (c.state() === 'idle' && i > 20) {
      log.push('pos=' + JSON.stringify(c.projectPos('magicwall')));
      log.push('below=' + JSON.stringify(c.whatBelow()));
      break;
    }
  }
  return log;
});
console.log(out.join('\n'));
await browser.close();
