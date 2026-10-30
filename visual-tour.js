// Headless browser tour: takes screenshots of every area and menu and reports console errors.
// Needs Playwright + Chromium (dev only). Run with the server already started on PORT (default 3000):
//   PORT=3000 node tests/visual-tour.js
const { chromium } = require('playwright');
const PORT = process.env.PORT || 3000, OUT = process.env.OUT || 'shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 576 } }); p.setDefaultTimeout(120000);
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(1500);
  await p.fill('#gName', 'Parker'); await p.click('#guestbtn'); await p.waitForTimeout(1500);
  const shot = async (n) => { await p.waitForTimeout(2500); await p.screenshot({ path: OUT + '/' + n + '.png' }); };
  // give this guest some progress so every area can be visited (test only, guest save is local)
  await p.evaluate(() => { const s = App.s; s.taps = 5e9; s.gems = 800; s.rb = 3; s.open = [0, 1, 2, 3, 4]; s.pets = { 0: 3, 4: 1, 11: 2, 5: 1, 34: 1, 26: 1 }; s.clicks = 2000; });
  await shot('03-hub');
  const tour = [['04-plains', -24, -60, 0], ['05-candy', 24, -62, 0], ['06-desert', -24, 70, Math.PI], ['07-magma', 24, 70, Math.PI], ['08-space', 70, -10, -Math.PI / 2], ['09-garden', -34, 0, -Math.PI / 2], ['10-obby', 305, 0, -Math.PI / 2], ['11-boss', 0, 4, Math.PI]];
  for (const [n, x, z, yaw] of tour) { await p.evaluate(([x, z, yaw]) => { App._debug.tp(x, z); App._debug.cam.yaw = yaw; App._debug.P.yaw = yaw + Math.PI; }, [x, z, yaw]); await shot(n); }
  await p.evaluate(() => { App._debug.tp(0, 3); App._debug.cam.yaw = 0; });
  for (const panel of ['pets', 'gems', 'quests', 'map', 'board', 'settings', 'credits', 'trade', 'rebirth']) { await p.evaluate(pn => UI.show(pn), panel); await shot('p-' + panel); }
  await p.evaluate(() => UI.hide());
  await p.evaluate(() => { App._debug.tp(-24, -66); App.s.area = 0; App.act('hatch', { n: 3 }); });
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + '/h1-egg.png' });
  await p.waitForTimeout(2600); await p.screenshot({ path: OUT + '/h2-reveal.png' });
  const info = await p.evaluate(() => ({ quality: App.E.quality, draws: App.E.stats.draws, tris: App.E.stats.tris, boss: !!App.boss, online: App.online }));
  console.log(JSON.stringify(info));
  console.log(errs.length ? 'CONSOLE ERRORS:\n' + errs.slice(0, 10).join('\n') : 'No console errors');
  await b.close();
})();
