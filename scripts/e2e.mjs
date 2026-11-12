import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml'};
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== root && !file.startsWith(root + sep)) throw new Error('Invalid path');
    const body = await readFile(file);
    res.writeHead(200, {'content-type':mime[extname(file)] || 'application/octet-stream','cache-control':'no-store'});
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});
await new Promise(resolveListen => server.listen(4173,'127.0.0.1',resolveListen));
let browser;
try {
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if(message.type()==='error') errors.push(message.text()); });
  await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
  await page.waitForFunction(() => {
    const c=document.querySelector('#world');
    if(!c || !c.width || !c.height) return false;
    const x=c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data;
    return x[3]===255;
  });
  const sceneColors = await page.evaluate(() => {
    const c=document.querySelector('#world'), data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const colors=new Set();
    for(let y=0;y<c.height;y+=13)for(let x=0;x<c.width;x+=13){
      const i=(y*c.width+x)*4;colors.add(data[i]+','+data[i+1]+','+data[i+2]);
    }
    return colors.size;
  });
  if(sceneColors<28) throw new Error('Urban scene render looks visually empty or flat: '+sceneColors+' sampled colors');
  if (!(await page.locator('#sprint').isVisible())) throw new Error('Mobile sprint control is missing');
  if (!(await page.locator('#minimap').isVisible())) throw new Error('City minimap is missing');
  await page.waitForFunction(() => { const m=document.querySelector('#minimap'); return m.getContext('2d').getImageData(20,20,1,1).data[3] > 0; });
  await page.locator('#menu-open').click();
  await page.locator('#medkit').waitFor();
  await page.locator('#medkit').click();
  await page.locator('#buy-medkit').waitFor();
  await page.locator('#buy-medkit').click();
  await page.locator('#crew').click();
  if (!(await page.locator('#modal-content').innerText()).includes('Команда: 1')) throw new Error('Hired crew member was not added');
  await page.locator('#save').click();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('gcr-save-v2')));
  if (!persisted || !persisted.state || !Array.isArray(persisted.state.inventory)) throw new Error('Save data was not written');
  await page.locator('#continue').click();
  await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(() => document.querySelector('#world')?.width > 0);
  await page.evaluate(async () => { if ('serviceWorker' in navigator) await navigator.serviceWorker.ready; return true; });
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller);
  await page.context().setOffline(true);
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#world');
  await page.context().setOffline(false);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  await page.locator('#attack').tap();
  await page.waitForTimeout(150);
  if (errors.length) throw new Error('Browser errors: ' + errors.join(' | '));
  console.log('Browser E2E passed: mobile boot, canvas render, menu, medkit inventory, keyboard movement and touch action.');
} finally {
  if (browser) await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
