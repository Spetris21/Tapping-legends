// Screenshots of the lobby (overhead + from spawn) and the obby. Server must be running.
//   PORT=3000 node tests/lobby-shots.js
const { chromium } = require('playwright');
const PORT = process.env.PORT || 3000, OUT = process.env.OUT || 'shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1024, height: 640 } }); p.setDefaultTimeout(180000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(800);
  await p.fill('#gName', 'Parker'); await p.click('#guestbtn'); await p.waitForTimeout(1500);
  const shot = async (n, wait) => { await p.waitForTimeout(wait || 3000); await p.screenshot({ path: OUT + '/' + n + '.png' }); };
  const view = (o) => p.evaluate(o => { App.setSetting('quality', o.q || 'med'); const d = App._debug; d.tp(o.x, o.z, o.y || 0); Object.assign(d.cam, o.cam); d.P.yaw = (o.cam.yaw || 0) + Math.PI; if (o.far) App.E.far = o.far; App.settings.names = !o.hide; }, o);
  if (process.env.ONLY_OBBY) { await p.evaluate(() => {}); } else {
  // overhead: hide the HUD so the whole lobby is visible
  await p.evaluate(() => { document.getElementById('hud').style.display = 'none'; });
  await view({ x: 0, z: -2, cam: { yaw: 0, pitch: 1.35, dist: 95 }, far: 300, q: 'low', hide: true });
  await shot('L1-lobby-overhead', 4000);
  await view({ x: 0, z: -2, cam: { yaw: 0.6, pitch: 0.75, dist: 80 }, far: 300, q: 'low', hide: true });
  await shot('L2-lobby-angle', 4000);
  await p.evaluate(() => { document.getElementById('hud').style.display = ''; });
  await view({ x: 0, z: 4, cam: { yaw: 0, pitch: 0.42, dist: 12 } });
  await shot('L3-from-spawn');
  await view({ x: 0, z: 4, cam: { yaw: Math.PI, pitch: 0.35, dist: 12 } });
  await shot('L4-spawn-facing-arena');
  }
  // obby: start it properly, then jump the camera to interesting sections
  await p.evaluate(() => { const st = TL.W.STN.obby; App._debug.tp(st.x, st.z); App._debug.use(); });
  await p.waitForTimeout(800);
  for (const [n, i] of [['O1-obby-spinner', 16], ['O2-obby-kill-bricks', 29], ['O3-obby-hard-end', 41]]) {
    await p.evaluate(i => { const q = TL.W.PL[i]; const d = App._debug; d.tp(q.x, q.z, q.y + 0.05); d.cam.yaw = -Math.PI / 2 + 0.3; d.cam.pitch = 0.5; d.cam.dist = 10; }, i);
    await shot(n, 2500);
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'No page errors');
  await b.close();
})();
