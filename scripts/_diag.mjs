import { chromium } from 'playwright-core';

const EXE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL ?? 'http://localhost:4173/';
const browser = await chromium.launch({ executablePath: EXE, args: ['--use-angle=metal'] });
let fail = 0;

for (const mode of ['desktop', 'iphone']) {
  const ctx =
    mode === 'iphone'
      ? await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 3,
          isMobile: true,
          hasTouch: true,
        })
      : await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__claw?.ready === true, null, { timeout: 60000 });
  await page.waitForTimeout(400);

  const sc = await page.evaluate(() => window.__claw.stickScreen());
  const ui0 = await page.evaluate(() => window.__claw.ui());
  console.log(`\n[${mode}] stickScreen ${JSON.stringify(sc)} rotZ0=${ui0.rotZ} capY0=${ui0.capY} children=${ui0.stickChildren}`);

  // 1) drag sulla levetta
  const t0 = await page.evaluate(() => window.__claw.target());
  await page.mouse.move(sc.x, sc.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(sc.x + i * 6, sc.y);
    await page.waitForTimeout(40);
  }
  const uiDrag = await page.evaluate(() => window.__claw.ui());
  await page.mouse.up();
  await page.waitForTimeout(400);
  const t1 = await page.evaluate(() => window.__claw.target());
  const uiBack = await page.evaluate(() => window.__claw.ui());
  const dx = t1.x - t0.x;
  console.log(`[${mode}] stick: dx=${dx.toFixed(3)} rotZ_drag=${uiDrag.rotZ} rotZ_back=${uiBack.rotZ}`);
  const okStick = dx > 0.02 && uiDrag.rotZ < -0.1 && Math.abs(uiBack.rotZ) < 0.06;
  console.log(`[${mode}] ${okStick ? 'OK' : 'FAIL'} levetta: muove + si inclina + torna`);

  // 2) bottone: corsa visibile
  const btn = await page.evaluate(() => window.__claw.buttonScreen());
  console.log(`[${mode}] buttonScreen ${JSON.stringify(btn)}`);
  await page.mouse.move(btn.x, btn.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const capDown = await page.evaluate(() => window.__claw.ui());
  await page.mouse.up();
  await page.waitForTimeout(600);
  const capUp = await page.evaluate(() => window.__claw.ui());
  const travelled = Math.abs(capDown.capY - capUp.capY);
  console.log(`[${mode}] bottone: capY premuto=${capDown.capY} rilasciato=${capUp.capY} corsa=${travelled.toFixed(4)}`);
  const okBtn = travelled > 0.002;
  console.log(`[${mode}] ${okBtn ? 'OK' : 'FAIL'} bottone: corsa visibile`);

  if (!okStick) fail++;
  if (!okBtn) fail++;
  await ctx.close();
}
await browser.close();
console.log(fail === 0 ? '\nTUTTO OK' : `\n${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
