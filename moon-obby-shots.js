// Checks the camera follows the player up (jetpack + high moon obby rocks) and screenshots the moon obby.
//   PORT=3000 node tests/moon-obby-shots.js   (server must be running)
const { chromium } = require('playwright');
const PORT = process.env.PORT || 3000, OUT = process.env.OUT || 'shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } }); p.setDefaultTimeout(240000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(800);
  await p.fill('#gName', 'Parker'); await p.click('#guestbtn'); await p.waitForTimeout(1500);
  const ev = (f, a) => p.evaluate(f, a);
  const shot = async (n, wait) => { await p.waitForTimeout(wait || 2500); await p.screenshot({ path: OUT + '/' + n + '.png' }); console.log('shot', n); };
  // is the player on screen? (projects the player's head into screen space)
  const onScreen = () => ev(() => { const P = App._debug.P, pr = App.E.project(P.x, P.y + 2, P.z); return pr ? { x: Math.round(pr[0]), y: Math.round(pr[1]), py: +P.y.toFixed(1), visible: pr[1] > 0 && pr[1] < innerHeight && pr[0] > 0 && pr[0] < innerWidth } : { visible: false, py: P.y }; });
  await ev(() => { App.setSetting('quality', 'low'); const s = App.s; s.rocket = true; s.rb = 5; App._debug.tp(TL.W.MOON_SPAWN[0], TL.W.MOON_SPAWN[1]); });
  await p.waitForTimeout(1500);
  // 1) jetpack: walk onto the pad and check the player stays on screen at the top
  await ev(() => { const j = TL.W.JETS[1]; App._debug.P.x = j.x; App._debug.P.z = j.z; App._debug.cam.yaw = -0.6; });
  await p.waitForFunction(() => !App._debug.P.fly && App._debug.P.y > 8, null, { timeout: 120000 });
  const top = await onScreen(); console.log('on the jetpack platform:', JSON.stringify(top));
  await shot('M1-jetpack-platform', 1500);
  // 2) moon obby start, then teleport the run to high checkpoints to see the camera + obstacles
  await ev(() => { const st = TL.W.STN.mobby; App._debug.tp(st.x, st.z); App._debug.use(); });
  await p.waitForTimeout(1000);
  const views = [['M2-moon-obby-start', 0, 0.5], ['M3-moon-obby-spinner', 9, 0.35], ['M4-moon-obby-bounce', 15, 0.2], ['M5-moon-obby-star-ring', 21, 0.3]];
  for (const [n, i, pitch] of views) {
    await ev(([i, pitch]) => { const q = TL.W.MROCK[i], c = TL.W.MCRYSTAL; App._debug.tp(q.x, q.z, q.y + 0.05); App._debug.cam.yaw = Math.atan2(q.x - c[0], q.z - c[1]) + 0.9; App._debug.cam.pitch = pitch; App._debug.cam.dist = 15; }, [i, pitch]);
    await p.waitForTimeout(1500); const v = await onScreen(); console.log(n, JSON.stringify(v));
    await shot(n, 1000);
  }
  const hud = await ev(() => ({ bar: document.getElementById('evbar').textContent, btn: document.getElementById('obLobby').textContent, sub: document.getElementById('sub').textContent }));
  console.log(JSON.stringify(hud));
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 8).join('\n') : 'No page errors');
  await b.close();
})();
