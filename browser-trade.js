// Two real browsers: player A sends a trade request from the Trade menu, B accepts, both see the trade window.
//   PORT=3000 node tests/browser-trade.js   (server must be running)
const { chromium } = require('playwright');
const assert = require('assert');
const PORT = process.env.PORT || 3000;
async function player(b, name) {
  const ctx = await b.newContext({ viewport: { width: 800, height: 480 } }); const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  await p.goto('http://localhost:' + PORT + '/'); await p.waitForTimeout(600);
  await p.click('#tabReg'); await p.fill('#aUser', name); await p.fill('#aEmail', name + '@x.com'); await p.fill('#aPass', 'trade123'); await p.click('#authbtn');
  await p.waitForFunction(() => window.App && App.inGame && App.mode === 'account', null, { timeout: 15000 });
  await p.evaluate(() => App.setSetting('quality', 'low'));
  return p;
}
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const id = Date.now() % 10000, A = await player(b, 'Ann' + id), B = await player(b, 'Ben' + id);
  await A.waitForFunction(() => App.others.size >= 1, null, { timeout: 10000 });
  await A.evaluate(() => UI.show('trade')); await A.waitForTimeout(500);
  await A.click('#panel button.g'); // "Request trade" on the first listed player
  await B.waitForFunction(() => !!App.tradeReq, null, { timeout: 10000 }); console.log('  ok   B received the trade request');
  await B.evaluate(() => UI.show('trade')); await B.waitForTimeout(400);
  await B.click('#panel button.g'); // Accept
  await A.waitForFunction(() => !!App.trade, null, { timeout: 10000 }); await B.waitForFunction(() => !!App.trade, null, { timeout: 10000 });
  const w = await A.evaluate(() => App.trade.with); assert(w.startsWith('Ben')); console.log('  ok   both players see the trade window (A trading with ' + w + ')');
  await A.evaluate(() => App.tradeSend({ a: 'ready', v: true })); await B.evaluate(() => App.tradeSend({ a: 'ready', v: true }));
  await A.waitForFunction(() => !App.trade, null, { timeout: 10000 });
  const msg = await A.textContent('#toast'); console.log('  ok   empty trade handled safely:', JSON.stringify(msg));
  await b.close();
})().catch(e => { console.error('  FAIL', e.message); process.exit(1); });
