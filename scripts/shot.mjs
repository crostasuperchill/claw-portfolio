import { chromium, devices } from 'playwright-core';
import { mkdir } from 'node:fs/promises';

const URL = process.env.URL ?? 'http://127.0.0.1:4173/';
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});

async function shoot(name, device) {
  const ctx = await browser.newContext(
    device ? { ...devices[device] } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
  );
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'load' });
  await page
    .waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 })
    .catch(() => logs.push('ready timeout'));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `artifacts/${name}.png` });
  console.log(`--- ${name} ---`);
  console.log(logs.slice(0, 25).join('\n'));
  await ctx.close();
}

const only = process.env.ONLY;
if (!only || only === 'iphone') await shoot('iphone', 'iPhone 13');
if (!only || only === 'desktop') await shoot('desktop', null);
await browser.close();
