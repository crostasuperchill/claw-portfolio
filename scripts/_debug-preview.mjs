import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
const PORT=5207, URL=`http://localhost:${PORT}/_preview.html?view=charms`;
const server=spawn('npx',['vite','--port',String(PORT),'--strictPort'],{stdio:'ignore'});
for(let i=0;i<80;i++){try{if((await fetch(URL)).ok)break}catch{} await new Promise(r=>setTimeout(r,400));}
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--ignore-gpu-blocklist']});
const ctx=await browser.newContext({viewport:{width:1200,height:800},deviceScaleFactor:1});
const page=await ctx.newPage();
page.on('console',m=>console.log('console',m.type(),m.text())); page.on('pageerror',e=>console.log('ERR',e.message));
await page.goto(URL,{waitUntil:'load'});
await page.waitForTimeout(4000);
const out=await page.evaluate(()=>{const c=document.getElementById('stage'); return {w:c.width,h:c.height, ready:window.__ready, bbox:window.__bboxes};});
console.log(out);
await page.screenshot({path:'artifacts/preview-debug.png'});
await browser.close(); server.kill('SIGTERM');
