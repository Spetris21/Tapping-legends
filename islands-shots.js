// Screenshots of every island (wide view), the start screen, menus and the walk / jump / fall animations.
//   PORT=3000 node tests/islands-shots.js   (server must be running)
const { chromium } = require('playwright');
const PORT = process.env.PORT || 3000, OUT = process.env.OUT || 'shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } }); p.setDefaultTimeout(240000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(3500);
  const shot = async (n, wait) => { await p.waitForTimeout(wait || 2500); await p.screenshot({ path: OUT + '/' + n + '.png' }); console.log('shot', n); };
  await shot('I0-start', 500);
  await p.fill('#gName', 'Parker'); await p.click('#guestbtn'); await p.waitForTimeout(1500);
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { App.setSetting('quality', 'med'); const s = App.s; s.rb = 3; s.open = [0, 1, 2, 3, 4]; s.taps = 2e9; s.gems = 300; s.pets = { 0: 2, 4: 1, 11: 1, 26: 1 }; });
  await ev(() => { document.getElementById('hud').style.display = 'none'; });
  // wide views of each island: stand near the middle, camera pulled back and up
  const views = [['I1-spawn-plains', 0, 0.8], ['I2-candy-meadow', 1, 2.2], ['I3-dusty-desert', 2, -0.6], ['I4-magma-volcano', 3, 0.7], ['I5-space-station', 4, 2.5]];
  for (const [n, k, yaw] of views) {
    await ev(([k, yaw]) => { const c = TL.W.CEN[k]; App._debug.tp(c[0], c[1] + (k < 2 ? 9 : k < 4 ? -9 : 0) + (k === 4 ? 0 : 0)); if (k === 4) App._debug.tp(c[0] - 9, c[1]); const d = App._debug.cam; d.yaw = yaw; d.pitch = 0.62; d.dist = 30; App.E.far = 170; }, [k, yaw]);
    await shot(n, 4000);
  }
  await ev(() => { document.getElementById('hud').style.display = ''; });
  // animation poses in the lobby
  await ev(() => { App._debug.tp(0, 4); const d = App._debug.cam; d.yaw = -1.2; d.pitch = 0.18; d.dist = 7.5; App.E.far = 105; });
  await p.keyboard.down('KeyD'); await p.waitForTimeout(1600); await shot('A1-walk', 50); await p.waitForTimeout(500); await shot('A1b-walk', 50); await p.keyboard.up('KeyD');
  await ev(() => { App._debug.tp(0, 4); App._debug.P.vy = 9; App._debug.P.gr = false; App._debug.P.coy = 0; });
  await shot('A2-jump', 250);
  await ev(() => { App._debug.tp(0, 4, 9); App._debug.P.vy = -7; App._debug.P.gr = false; });
  await shot('A3-fall', 250);
  for (const panel of ['gems', 'pets', 'quests']) { await ev(pn => UI.show(pn), panel); await shot('U-' + panel, 1500); }
  await ev(() => UI.hide());
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'No page errors');
  await b.close();
})();
