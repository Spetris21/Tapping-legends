// Browser test of the real login flow: register in the UI, tap, reload, "Continue as", check the save came back.
//   PORT=3000 node tests/browser-account.js   (server must be running)
const { chromium } = require('playwright');
const assert = require('assert');
const PORT = process.env.PORT || 3000;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 900, height: 520 } });
  const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(800);
  const name = 'Kid' + (Date.now() % 100000);
  await p.click('#tabReg'); await p.fill('#aUser', name); await p.fill('#aEmail', name + '@school.edu'); await p.fill('#aPass', 'lunch123');
  await p.click('#authbtn');
  await p.waitForFunction(() => window.App && App.inGame && App.mode === 'account', null, { timeout: 15000 });
  console.log('  ok   registered and entered the game as', name);
  await p.evaluate(() => App.setSetting('quality', 'low'));
  for (let i = 0; i < 30; i++) { await p.evaluate(() => App._debug.tap(400, 260)); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  const taps1 = await p.evaluate(() => Math.floor(App.s.taps));
  assert(taps1 >= 30, 'taps after clicking: ' + taps1); console.log('  ok   30 clicks counted by the server, taps =', taps1);
  await p.evaluate(() => App.act('hatch', { n: 1 })); await p.waitForTimeout(1500);
  const toast = await p.textContent('#toast'); assert(/Not enough/.test(toast), 'expected a not-enough-taps message, got: ' + toast);
  console.log('  ok   hatching without enough taps is refused:', JSON.stringify(toast));
  await p.reload(); await p.waitForTimeout(1200);
  const btn = await p.textContent('#resumebtn'); assert(btn.includes(name), 'resume button shows the name: ' + btn);
  await p.click('#resumebtn');
  await p.waitForFunction(() => window.App && App.inGame, null, { timeout: 15000 });
  await p.waitForTimeout(800);
  const taps2 = await p.evaluate(() => Math.floor(App.s.taps));
  assert(taps2 >= taps1, 'taps after reload: ' + taps2); console.log('  ok   "Continue as ' + name + '" restored the cloud save, taps =', taps2);
  console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : '  ok   no page errors');
  await b.close();
})().catch(e => { console.error('  FAIL', e.message); process.exit(1); });
