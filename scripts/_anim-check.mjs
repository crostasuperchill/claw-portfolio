import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: false, args: ['--use-angle=metal','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 640 }, deviceScaleFactor: 1 });
page.on('pageerror', e => console.log('pageerror:', e.message));
await page.goto('http://localhost:5182/', { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 90000 });
await page.bringToFront();
await page.evaluate(() => { const b = document.getElementById('boot'); if (b) b.style.display='none'; });
await page.waitForTimeout(800);
const pos = await page.evaluate(() => window.__claw.projectPos('magicwall'));
console.log('target', pos);
await page.evaluate((p) => { window.__claw.aim(p.x, p.z); window.__claw.drop(); }, pos);
const t0 = Date.now();
while (Date.now() - t0 < 9000) {
  const s = await page.evaluate(() => { const a = window.__clawArm?.(); return { st: window.__claw.state(), y: a?.y.toFixed(4), v: a?.yVis.toFixed(4), o: a?.open.toFixed(3), f: a?.f.map(x=>x.toFixed(2)).join('/'), sw: (Math.hypot(a?.swayX||0,a?.swayZ||0)*1000).toFixed(1), ti: (Math.hypot(a?.tiltX||0,a?.tiltZ||0)*57.3).toFixed(2), g: a?.grabbed }; });
  console.log(((Date.now()-t0)/1000).toFixed(2), s.st, s.y, s.v, s.o, s.f, 'sway', s.sw+'mm', 'tilt', s.ti+'deg', s.g?'GRAB':'');
  await page.waitForTimeout(120);
}
await browser.close();
