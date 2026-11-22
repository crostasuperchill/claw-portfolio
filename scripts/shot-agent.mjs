import { chromium, devices } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const AGENT = process.env.AGENT ?? 'agent';
const PORT = Number(process.env.PORT ?? 5199);
const URL = `http://localhost:${PORT}/`;
const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

await mkdir('artifacts', { recursive: true });

const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], {
  stdio: 'ignore',
});

let up = false;
for (let i = 0; i < 80; i++) {
  try {
    const r = await fetch(URL);
    if (r.ok) {
      up = true;
      break;
    }
  } catch {
    /* not yet */
  }
  await new Promise((r) => setTimeout(r, 400));
}
if (!up) {
  console.error('dev server did not start');
  server.kill('SIGTERM');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist'],
});

const device = process.env.DEVICE === 'desktop' ? null : devices['iPhone 13'];
const ctx = await browser.newContext(
  device ? { ...device } : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 }
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
const path = `artifacts/${AGENT}.png`;
await page.screenshot({ path });
console.log(`saved ${path}`);
console.log(logs.slice(0, 20).join('\n'));

await browser.close();
server.kill('SIGTERM');
