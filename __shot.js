const { chromium } = require('@playwright/test');
(async () => {
  const OUT = process.argv[2];
  const b = await chromium.launch();
  // mobile
  const m = await b.newPage({ viewport: { width: 390, height: 850 }, deviceScaleFactor: 2 });
  await m.goto('http://localhost:3005/', { waitUntil:'networkidle', timeout:60000 }).catch(()=>{});
  await m.waitForFunction(() => [...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Overview'), { timeout: 25000 }).catch(()=>{});
  await m.waitForTimeout(4000);
  await m.screenshot({ path: OUT+'/grid-mobile.png' });
  await m.close();
  // desktop
  const d = await b.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  await d.goto('http://localhost:3005/', { waitUntil:'networkidle', timeout:60000 }).catch(()=>{});
  await d.waitForTimeout(4500);
  await d.screenshot({ path: OUT+'/grid-desktop.png' });
  await b.close();
})();
