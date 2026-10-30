// Headless server tests: real WebSocket clients against the real server.js.
// Run: node tests/test-server.js   (needs the "ws" package: npm install)
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto'), http = require('http');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const L = require('../public/logic.js'), C = L.C;

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-test-'));
const PORT = 39000 + Math.floor(Math.random() * 900);
// seed two rich accounts directly in the database
function seedUser(name, pw, extra) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex');
  const s = Object.assign(L.fresh(name), extra);
  return { name, email: name.toLowerCase() + '@test.com', salt, hash, created: 0, last: 0, state: s };
}
const db = { users: {
  rich: seedUser('Rich', 'secret123', { taps: 1e7, gems: 2000, pets: { 0: 5, 4: 2 } }),
  bob: seedUser('Bob', 'hunter22', { taps: 1e6, pets: { 1: 3, 5: 1 } }),
  astro: seedUser('Astro', 'moon1234', { taps: 7e8, rb: 5, dust: 1000, pets: { 4: 6 } })
}, emails: { 'rich@test.com': 'rich', 'bob@test.com': 'bob', 'astro@test.com': 'astro' }, sessions: {}, week: { id: '', scores: {} }, pending: {} };
fs.writeFileSync(path.join(DATA, 'db.json'), JSON.stringify(db));

let srv;
function startServer(extra) {
  return new Promise((res, rej) => {
    srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT, DATA_DIR: DATA }, extra || {}), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    srv.stdout.on('data', d => { out += d; if (out.includes('running on')) res(); });
    srv.stderr.on('data', d => process.stderr.write('[server] ' + d));
    setTimeout(() => rej(new Error('server did not start: ' + out)), 8000);
  });
}
const stopServer = () => new Promise(r => { srv.once('exit', r); srv.kill('SIGTERM'); });

class Client {
  constructor() { this.msgs = []; this.waiters = []; }
  open() {
    return new Promise((res, rej) => {
      this.ws = new WebSocket('ws://127.0.0.1:' + PORT);
      this.ws.on('open', res); this.ws.on('error', rej);
      this.ws.on('message', m => { const d = JSON.parse(m); this.msgs.push(d); this.waiters = this.waiters.filter(w => !w(d)); });
    });
  }
  send(o) { this.ws.send(JSON.stringify(o)); }
  wait(pred, ms = 4000, label = '') {
    const found = this.msgs.find(pred); if (found) { this.msgs.splice(this.msgs.indexOf(found), 1); return Promise.resolve(found); }
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('timeout waiting for ' + label)), ms);
      this.waiters.push(d => { if (pred(d)) { clearTimeout(to); this.msgs.splice(this.msgs.indexOf(d), 1); res(d); return true; } return false; });
    });
  }
  lastState() { const st = this.msgs.filter(m => m.t === 'st'); return st.length ? st[st.length - 1].s : null; }
  close() { this.ws.close(); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = p => new Promise(res => http.get('http://127.0.0.1:' + PORT + p, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({ code: r.statusCode, body: b })); }));
async function auth(c, msg) { await c.open(); c.send(msg); return c.wait(d => d.t === 'welcome' || d.t === 'auth', 6000, 'auth'); }

let passed = 0;
async function t(name, fn) { try { await fn(); passed++; console.log('  ok  ', name); } catch (e) { console.log('  FAIL', name, '\n      ', e.message); process.exitCode = 1; } }

(async () => {
  await startServer();
  let token;

  await t('serves the game files, blocks path tricks', async () => {
    assert.equal((await get('/config.js')).code, 200);
    assert.equal((await get('/logic.js')).code, 200);
    assert.notEqual((await get('/../server.js')).code, 200);
    assert.notEqual((await get('/%2e%2e/data/db.json')).code, 200);
  });

  await t('register rejects bad username, short password and bad email', async () => {
    const c = new Client();
    let r = await auth(c, { t: 'register', u: 'a b', p: 'secret123', e: 'x@y.com' }); assert.equal(r.ok, false);
    c.send({ t: 'register', u: 'Zed', p: '123', e: 'x@y.com' }); r = await c.wait(d => d.t === 'auth'); assert.match(r.err, /Password/);
    c.send({ t: 'register', u: 'Zed', p: '123456', e: 'nope' }); r = await c.wait(d => d.t === 'auth'); assert.match(r.err, /email/);
    c.send({ t: 'register', u: 'rich', p: '123456', e: 'new@y.com' }); r = await c.wait(d => d.t === 'auth'); assert.match(r.err, /taken/);
    c.close();
  });

  await t('register a new account works and never stores the password', async () => {
    const c = new Client(); const r = await auth(c, { t: 'register', u: 'Newbie', p: 'pass1234', e: 'newbie@school.com' });
    assert.equal(r.t, 'welcome'); assert(r.token && r.token.length === 64); assert.equal(r.s.name, 'Newbie'); token = r.token;
    c.close(); await sleep(11000); // wait for the 10s autosave
    const raw = fs.readFileSync(path.join(DATA, 'db.json'), 'utf8');
    assert(raw.includes('Newbie') && !raw.includes('pass1234'), 'password must not appear in db.json');
  });

  await t('wrong password fails, right password and saved token work', async () => {
    const a = new Client(); let r = await auth(a, { t: 'login', u: 'Rich', p: 'wrong' }); assert.equal(r.ok, false); a.close();
    const b = new Client(); r = await auth(b, { t: 'login', u: 'rich@test.com', p: 'secret123' }); assert.equal(r.t, 'welcome'); assert.equal(r.name, 'Rich'); b.close();
    const c = new Client(); r = await auth(c, { t: 'resume', token }); assert.equal(r.t, 'welcome'); assert.equal(r.name, 'Newbie'); c.close();
  });

  await t('login is rate limited after 5 wrong tries', async () => {
    const c = new Client(); await c.open(); let r;
    for (let i = 0; i < 6; i++) { c.send({ t: 'login', u: 'bob', p: 'bad' + i }); r = await c.wait(d => d.t === 'auth'); }
    assert.match(r.err, /Too many/); c.send({ t: 'login', u: 'bob', p: 'hunter22' }); r = await c.wait(d => d.t === 'auth' || d.t === 'welcome');
    assert.equal(r.ok, false, 'even the right password is blocked while locked'); c.close();
  });

  const A = new Client(); let wa = await auth(A, { t: 'login', u: 'rich', p: 'secret123' });

  await t('auto-clicker spam is capped by the server', async () => {
    const before = wa.s.clicks;
    for (let i = 0; i < 10; i++) A.send({ t: 'tap', n: 40, seq: i + 1 }); // 400 "clicks" instantly
    await sleep(600); const s = A.lastState();
    assert(s.clicks - before <= C.TAP_BURST + 10, 'accepted ' + (s.clicks - before));
    assert(s.clicks - before > 0);
  });

  await t('CPS cap: never more than 15 clicks in any second', async () => {
    await sleep(1200); A.msgs.length = 0;
    A.send({ t: 'tap', n: 1, seq: 200 }); const c0 = (await A.wait(d => d.t === 'st')).s.clicks;
    await sleep(1100);
    for (let i = 0; i < 20; i++) { A.send({ t: 'tap', n: 6, seq: 201 + i }); await sleep(100); } // 120 clicks in 2 seconds
    await sleep(400); A.msgs.length = 0; await sleep(1100); A.send({ t: 'tap', n: 0, seq: 300 }); const c1 = (await A.wait(d => d.t === 'st')).s.clicks;
    const got = c1 - c0; assert(got <= 15 * 2 + 15 && got >= 15, 'accepted ' + got + ' clicks in ~2s');
  });

  await t('client cannot set its own taps or gems', async () => {
    A.send({ t: 'st', s: { taps: 1e99, gems: 1e9 } }); A.send({ t: 'act', a: 'give', taps: 1e99 });
    await sleep(400); A.send({ t: 'tap', n: 1, seq: 99 }); const st = await A.wait(d => d.t === 'st');
    assert(st.s.taps < 1e8 && st.s.gems < 3000);
  });

  await t('hatching happens on the server', async () => {
    A.msgs.length = 0; A.send({ t: 'act', a: 'hatch', n: 3 });
    const r = await A.wait(d => d.t === 'res' && d.a === 'hatch'); assert(r.r.ok); assert.equal(r.r.pets.length, 3);
  });

  await t('gem shop purchase works and is validated', async () => {
    await sleep(100); A.send({ t: 'act', a: 'buy', id: 'tap' });
    let r = await A.wait(d => d.t === 'res' && d.a === 'buy'); assert(r.r.ok, r.r.err);
    await sleep(100); A.send({ t: 'act', a: 'buy', id: 'autotap' }); r = await A.wait(d => d.t === 'res' && d.a === 'buy');
    assert.equal(r.r.ok, false, 'auto-tap turbo needs a rebirth');
  });

  await t('position-based rewards check where you are', async () => {
    await sleep(100); A.send({ t: 'act', a: 'spin' }); let r = await A.wait(d => d.t === 'res' && d.a === 'spin'); assert.equal(r.r.ok, false);
    const w = L.W.STN.wheel; A.send({ t: 'p', x: w.x, y: 0, z: w.z, w: 0, m: 0 }); await sleep(150);
    A.send({ t: 'act', a: 'spin' }); r = await A.wait(d => d.t === 'res' && d.a === 'spin'); assert(r.r.ok, r.r.err);
  });

  await t('obby finish is refused if done impossibly fast', async () => {
    await sleep(100); A.send({ t: 'act', a: 'obbyStart' }); await A.wait(d => d.t === 'res' && d.a === 'obbyStart');
    const last = L.W.PL[L.W.PL.length - 1]; A.send({ t: 'p', x: last.x, y: last.y, z: last.z, w: 0, m: 0 }); await sleep(150);
    A.send({ t: 'act', a: 'obbyEnd' }); const r = await A.wait(d => d.t === 'res' && d.a === 'obbyEnd'); assert.equal(r.r.ok, false); assert.match(r.r.err, /fast/);
  });

  const B = new Client(); const wb = await auth(B, { t: 'login', u: 'bob', p: 'hunter22' }).catch(e => ({ ok: false }));
  // bob may still be rate limited from the earlier test: wait it out by using a fresh account instead
  let Bc = B, bobName = 'Bob';
  if (wb.t !== 'welcome') { B.close(); Bc = new Client(); const r = await auth(Bc, { t: 'register', u: 'Trader2', p: 'trade123', e: 't2@x.com' }); bobName = 'Trader2'; }

  await t('trading swaps pets atomically after both press ready', async () => {
    A.msgs.length = 0; Bc.msgs.length = 0;
    const bId = (A.msgs.find(m => m.t === 'j') || {}).p; // not needed
    const welcomeB = Bc.msgs; // find B id from player list via A's join message
    const join = await A.wait(d => d.t === 'u', 2000, 'positions');
    const ids = join.p.map(p => p[0]);
    const aId = wa.id, bIdReal = ids.find(i => i !== aId);
    A.send({ t: 'tr', a: 'req', to: bIdReal });
    const req = await Bc.wait(d => d.t === 'tr' && d.a === 'req'); assert.equal(req.from, aId);
    Bc.send({ t: 'tr', a: 'accept', from: aId });
    await A.wait(d => d.t === 'tr' && d.a === 'state');
    const aPetsBefore = A.lastState() || wa.s;
    A.send({ t: 'tr', a: 'offer', pets: { 4: 1, 999: 5 } }); // 999 is not a pet: ignored
    await sleep(200);
    A.send({ t: 'tr', a: 'ready', v: true }); Bc.send({ t: 'tr', a: 'ready', v: true });
    const end = await A.wait(d => d.t === 'tr' && d.a === 'end', 6000, 'trade end'); assert.match(end.m, /complete/);
    await sleep(400);
    const sa = A.lastState(), sb = Bc.lastState();
    assert.equal(sa.pets[4] || 0, 1, 'Rich had 2 Golden Dragons, gave 1'); assert.equal(sb.pets[4], 1);
  });

  await t('trade is cancelled (nothing moves) if a player leaves mid-countdown', async () => {
    A.msgs.length = 0; Bc.msgs.length = 0;
    const ids = (await A.wait(d => d.t === 'u')).p.map(p => p[0]), other = ids.find(i => i !== wa.id);
    await sleep(4200); A.send({ t: 'tr', a: 'req', to: other }); await sleep(100);
    const req = await Bc.wait(d => d.t === 'tr' && d.a === 'req'); Bc.send({ t: 'tr', a: 'accept', from: req.from });
    await A.wait(d => d.t === 'tr' && d.a === 'state');
    A.send({ t: 'tr', a: 'offer', pets: { 0: 2 } }); await sleep(100);
    A.send({ t: 'tr', a: 'ready', v: true }); Bc.send({ t: 'tr', a: 'ready', v: true }); await sleep(500);
    A.send({ t: 'tap', n: 1, seq: 400 }); const before = (await A.wait(d => d.t === 'st')).s.pets[0];
    Bc.close(); const end = await A.wait(d => d.t === 'tr' && d.a === 'end'); assert.match(end.m, /cancel/);
    await sleep(3200); A.send({ t: 'tap', n: 1, seq: 500 }); const st = await A.wait(d => d.t === 'st');
    assert.equal(st.s.pets[0], before);
  });

  await t('guests can join and chat but cannot trade', async () => {
    const G = new Client(); const r = await auth(G, { t: 'guest', n: 'Visitor' }); assert.equal(r.guest, true); assert.equal(r.s, null);
    G.send({ t: 'tr', a: 'req', to: wa.id }); const m = await G.wait(d => d.t === 'fx'); assert.match(m.m, /guest/i);
    G.send({ t: 'c', m: 'hello shit world' }); const chat = await A.wait(d => d.t === 'c' && d.n && d.n.startsWith('Visitor'));
    assert.equal(chat.m, 'hello **** world'); G.close();
  });

  await t('leaderboard lists accounts only', async () => {
    const b = await A.wait(d => d.t === 'b', 7000, 'board'); assert(b.b.all.some(r => r[0] === 'Rich')); assert(!b.b.all.some(r => /Visitor/.test(r[0])));
  });

  await t('rocket + moon actions are checked on the server', async () => {
    const X = new Client(); await auth(X, { t: 'login', u: 'astro', p: 'moon1234' });
    const res = async (msg) => { X.msgs.length = 0; await sleep(120); X.send(Object.assign({ t: 'act' }, msg)); return (await X.wait(d => d.t === 'res' && d.a === msg.a)).r; };
    const go = async (x, z, y) => { X.send({ t: 'p', x, y: y || 0, z, w: 0, m: 0 }); await sleep(150); };
    assert.equal((await res({ a: 'rocket' })).ok, false, 'not at the rocket pad');
    await go(L.W.STN.rocket.x, L.W.STN.rocket.z);
    assert((await res({ a: 'rocket' })).ok); assert.equal((await res({ a: 'launch' })).to, 'moon');
    await go(L.W.STN.megg0.x + 30, L.W.STN.megg0.z);
    assert.equal((await res({ a: 'mhatch', e: 0, n: 1 })).ok, false, 'not at the moon egg');
    await go(L.W.STN.megg0.x, L.W.STN.megg0.z); await sleep(500);
    const h = await res({ a: 'mhatch', e: 0, n: 3 }); assert(h.ok, h.err); assert(h.pets.every(id => id >= 35 && id <= 41));
    assert.equal((await res({ a: 'meteor', slot: 1, i: 0 })).ok, false, 'fake meteor catch refused');
    assert.equal((await res({ a: 'fuse', id: 4 })).ok, false, 'not at the shiny machine');
    await go(L.W.STN.shiny.x, L.W.STN.shiny.z); assert((await res({ a: 'fuse', id: 4 })).ok);
    X.send({ t: 'tap', n: 1, seq: 1 }); const st = (await X.wait(d => d.t === 'st' && d.s.pets[1004])).s;
    assert(st.rocket, 'rocket'); assert.equal(st.pets[1004], 1, 'shiny'); assert.equal(st.dust, 1000 - 3 * C.MOON.EGGS[0].cost, 'dust');
    X.close();
  });

  await t('looks and emotes reach other players; bad looks are rejected', async () => {
    const X = new Client(), Y = new Client(); const wx = await auth(X, { t: 'login', u: 'astro', p: 'moon1234' }); await auth(Y, { t: 'guest', n: 'Watcher' });
    const look = { skin: C.LOOK.skin[4], shirt: C.LOOK.shirt[2], pants: C.LOOK.pants[5], hat: 'tophat' };
    X.send({ t: 'look', look }); const lk = await Y.wait(d => d.t === 'lk' && d.id === wx.id); assert.deepEqual(lk.lk, look);
    X.send({ t: 'look', look: Object.assign({}, look, { skin: '#000001' }) }); const bad = await X.wait(d => d.t === 'fx'); assert.match(bad.m, /locked/);
    X.send({ t: 'em', e: 'dance' }); const em = await Y.wait(d => d.t === 'em'); assert.equal(em.e, 'dance');
    X.close(); Y.close();
  });

  A.close(); await sleep(300); await stopServer();

  await t('progress survives a server restart', async () => {
    await startServer();
    const c = new Client(); const r = await auth(c, { t: 'login', u: 'rich', p: 'secret123' });
    assert.equal(r.t, 'welcome'); assert.equal(r.s.upg.tap, 1, 'gem shop level saved'); assert(r.s.hatched >= 3, 'hatches saved'); c.close();
    await stopServer();
  });

  await t('co-op boss: hits from everyone add up, min contribution enforced', async () => {
    await startServer({ TL_TEST_BOSS: '60' });
    const P1 = new Client(), P2 = new Client(), P3 = new Client();
    await auth(P1, { t: 'login', u: 'rich', p: 'secret123' }); await auth(P2, { t: 'register', u: 'Hitter', p: 'hit12345', e: 'h@x.com' }); await auth(P3, { t: 'guest', n: 'Lazy' });
    const b = C.BOSS_POS; for (const p of [P1, P2, P3]) p.send({ t: 'p', x: b[0], y: 0, z: b[2] + 3, w: 0, m: 0 });
    await P1.wait(d => d.t === 'boss' && d.a === 'start', 4000, 'boss start');
    const g0 = (await (P1.send({ t: 'tap', n: 1, seq: 1 }), P1.wait(d => d.t === 'st'))).s.gems;
    P3.send({ t: 'tap', n: 3, seq: 1 });
    for (let i = 0; i < 9; i++) { P1.send({ t: 'tap', n: 6, seq: i + 2 }); P2.send({ t: 'tap', n: 6, seq: i + 2 }); await sleep(450); }
    const e1 = await P1.wait(d => d.t === 'boss' && d.a === 'end', 6000, 'boss end');
    const e3 = await P3.wait(d => d.t === 'boss' && d.a === 'end', 6000, 'boss end p3');
    assert.equal(e1.win, true); assert(e1.hits >= 25); assert.equal(e1.r.ok, true); assert.equal(e1.r.gems, C.BOSS_WIN_GEMS);
    assert.equal(e3.hits, 3, 'guest hits counted');
    P1.send({ t: 'tap', n: 1, seq: 99 }); const st = await P1.wait(d => d.t === 'st' && d.s.gems > g0);
    assert.equal(st.s.gems - g0, C.BOSS_WIN_GEMS);
    [P1, P2, P3].forEach(p => p.close()); await stopServer();
  });

  console.log(`\n${passed} server tests passed` + (process.exitCode ? ' (with failures)' : ''));
  fs.rmSync(DATA, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); try { srv.kill(); } catch (x) {} process.exit(1); });
