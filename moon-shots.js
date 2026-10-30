// Screenshots of the new stuff: customiser, emotes, obby buttons, hangar + rocket, launch, Nebula Moon, meteors, moon menus.
//   PORT=3000 node tests/moon-shots.js   (server must be running)
const { chromium } = require('playwright');
const PORT = process.env.PORT || 3000, OUT = process.env.OUT || 'shots';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 560 } }); p.setDefaultTimeout(240000);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(800);
  await p.fill('#gName', 'Parker'); await p.click('#guestbtn'); await p.waitForTimeout(1500);
  const shot = async (n, wait) => { await p.waitForTimeout(wait || 2500); await p.screenshot({ path: OUT + '/' + n + '.png' }); console.log('shot', n); };
  const ev = (f, a) => p.evaluate(f, a);
  await ev(() => { App.setSetting('quality', 'low'); const s = App.s; s.rb = 5; s.taps = 1e9; s.open = [0, 1, 2, 3, 4]; s.dust = 400; s.mupg.helmet = 1; s.pets = { 30: 2, 31: 6, 33: 1, 4: 5, 1004: 1 }; s.bossWins = 6; s.hatched = 400; });
  // customiser with live preview
  await ev(() => { App.setLook({ skin: TL.C.LOOK.skin[2], shirt: TL.C.LOOK.shirt[4], pants: TL.C.LOOK.pants[3], hat: 'tophat' }); App.setTitle('titan'); UI.show('avatar'); });
  await shot('N1-customiser', 3500);
  await ev(() => { UI.hide(); App.emote('dance'); App._debug.cam.yaw = App._debug.P.yaw + 2.6; });
  await shot('N2-emote-dance', 1200);
  await ev(() => document.getElementById('emotes').classList.add('on'));
  await shot('N3-emote-wheel', 1000);
  await ev(() => document.getElementById('emotes').classList.remove('on'));
  // obby with on-screen buttons
  await ev(() => { const st = TL.W.STN.obby; App._debug.tp(st.x, st.z); App._debug.use(); App._debug.cam.yaw = -Math.PI / 2 + 0.3; });
  await shot('N4-obby-buttons', 2500);
  await ev(() => document.getElementById('obLobby').click());
  // hangar from outside, then the rocket menu
  await ev(() => { const H = TL.W.HANGAR; App._debug.tp(H.x - 4, H.z - H.d / 2 - 7); App._debug.cam.yaw = Math.PI + 0.35; App._debug.cam.pitch = 0.4; App._debug.cam.dist = 16; });
  await shot('N5-hangar', 3000);
  await ev(() => { const r = TL.W.STN.rocket; App._debug.tp(r.x, r.z); App._debug.cam.yaw = Math.PI + 0.5; App._debug.cam.dist = 13; App._debug.cam.pitch = 0.35; App._debug.use(); });
  await shot('N6-rocket-menu', 2000);
  await ev(() => { App.act('rocket'); UI.hide(); App.act('launch'); });
  await p.waitForFunction(() => App.launch && App.launch.t > 3, null, { timeout: 240000 });
  await shot('N7-liftoff', 100);
  await p.waitForFunction(() => !App.launch, null, { timeout: 240000 });
  await ev(() => { App._debug.cam.yaw = Math.PI * 0.85; App._debug.cam.pitch = 0.3; App._debug.cam.dist = 14; });
  await shot('N8-moon-arrival', 3000);
  // force a meteor shower on this client by shifting its clock
  await ev(() => { const mi = TL.meteorInfo(App.now()); App.tOff += (mi.active ? 0 : mi.next - App.now()) + 22000; App._debug.tp(TL.W.MOON.x, TL.W.MOON.z + 8); App._debug.cam.pitch = 0.55; App._debug.cam.dist = 20; App._debug.cam.yaw = 0.3; });
  await shot('N9-meteor-shower', 3000);
  // jetpack flight
  await ev(() => { const j = TL.W.JETS[0]; App._debug.tp(j.x + 2, j.z + 2); App._debug.cam.yaw = 0.8; App._debug.cam.dist = 15; App._debug.P.x = j.x; App._debug.P.z = j.z; });
  await p.waitForFunction(() => App._debug.P.fly && App._debug.P.y > 6, null, { timeout: 120000 }).catch(() => {});
  await shot('N10-jetpack', 200);
  await ev(() => { const q = TL.W.MROCK[3]; App._debug.tp(TL.W.STN.mobby.x, TL.W.STN.mobby.z + 4); App._debug.cam.yaw = 0; App._debug.cam.pitch = 0.15; App._debug.cam.dist = 20; });
  await shot('N11-moon-obby', 3000);
  for (const [n, panel, x] of [['N12-moon-egg', 'megg', 0], ['N13-stardust-shop', 'dshop'], ['N14-shiny-machine', 'shiny'], ['N15-pets-index', 'pets']]) {
    await ev(([panel, x]) => { App.megg = x || 0; UI.show(panel); }, [panel, x]); await shot(n, 1500);
  }
  await ev(() => UI.hide());
  const info = await ev(() => ({ moon: App.onMoon(), dust: App.s.dust, rocket: App.s.rocket, quality: App.E.quality }));
  console.log(JSON.stringify(info));
  console.log(errs.length ? 'ERRORS:\n' + errs.slice(0, 10).join('\n') : 'No page errors');
  await b.close();
})();
