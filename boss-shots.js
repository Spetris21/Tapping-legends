// Screenshots of the Tap Titan in each phase. Start the server with TL_TEST_BOSS=300 first:
//   TL_TEST_BOSS=300 PORT=3000 npm start   then   PORT=3000 node tests/boss-shots.js
const { chromium } = require('playwright');
const PORT = process.env.PORT || 3000, OUT = process.env.OUT || 'shots';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 576 } }); p.setDefaultTimeout(120000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(800);
  await p.fill('#gName', 'Wolfie'); await p.click('#guestbtn'); await p.waitForTimeout(1500);
  await p.evaluate(() => { App.setSetting('quality', 'high'); App._debug.tp(5, 5); App._debug.cam.yaw = 2.678; App._debug.cam.pitch = 0.22; App._debug.cam.dist = 13; App._debug.P.yaw = 2.678 + Math.PI; });
  await p.waitForTimeout(2500);
  const state = () => p.evaluate(() => App.boss ? App.boss.hp + '/' + App.boss.max : 'none');
  console.log('boss', await state());
  await p.screenshot({ path: OUT + '/b1-phase1.png' });
  const tapFor = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { await p.evaluate(() => { for (let i = 0; i < 3; i++) App._debug.tap(512, 300); }); await p.waitForTimeout(250); } };
  await tapFor(9000); console.log('boss', await state()); await p.screenshot({ path: OUT + '/b2-phase2.png' });
  await tapFor(9000); console.log('boss', await state()); await p.screenshot({ path: OUT + '/b3-phase3.png' });
  await tapFor(9000); console.log('boss', await state()); await p.waitForTimeout(600); await p.screenshot({ path: OUT + '/b4-defeated.png' });
  console.log(errs.length ? 'ERRORS ' + errs.join('\n') : 'No page errors');
  await b.close();
})();
