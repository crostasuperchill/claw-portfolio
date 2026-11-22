import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const VIEW = process.env.VIEW ?? 'charms';
const TOY = process.env.TOY ?? 'charm';
const PORT = Number(process.env.PORT ?? 5206);
const URL = `http://localhost:${PORT}/_preview.html?view=${VIEW}&toy=${TOY}`;
const OUT = VIEW === 'detail' ? `artifacts/detail-${TOY}.png` : `artifacts/preview-${VIEW}.png`;

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
let up = false;
for (let i = 0; i < 80; i++) {
  try {
    const r = await fetch(URL);
    if (r.ok) { up = true; break; }
  } catch { /* wait */ }
  await new Promise((r) => setTimeout(r, 400));
}
if (!up) {
  console.error('dev server did not start');
  server.kill('SIGTERM');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const data = await page.evaluate(() => window.__snap(1.2));
await writeFile(OUT, Buffer.from(data.split(',')[1], 'base64'));
const info = await page.evaluate(() => ({ bboxes: window.__bboxes, toyTop: window.__toyTop }));
console.log(VIEW, JSON.stringify(info.bboxes));
console.log('toyTop', JSON.stringify(info.toyTop));

await browser.close();
server.kill('SIGTERM');
