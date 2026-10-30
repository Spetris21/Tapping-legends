/* Tapping Legends server
   - serves the game files and a WebSocket on the same port
   - accounts (scrypt-hashed passwords), saves, events, co-op boss, trading, weekly board
   - the server owns all account progress: the browser only sends actions
   Run:  npm install  then  npm start   (PORT and DATA_DIR env vars are optional) */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
let WebSocketServer;
try { ({ WebSocketServer } = require('ws')); } catch (e) { console.error('Missing the "ws" package. Run:  npm install'); process.exit(1); }
const L = require('./public/logic.js'), C = L.C, W = L.W;

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PUBLIC = path.join(__dirname, 'public');
const SAVE_EVERY = 10000;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ============================================================ DATABASE (JSON file)
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'db.json');
let db = { users: {}, emails: {}, sessions: {}, week: { id: '', scores: {} }, lastWeek: null, pending: {} };
try {
  if (fs.existsSync(DB_FILE)) db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
} catch (e) {
  console.error('db.json is broken, trying the backup:', e.message);
  try { db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE + '.bak', 'utf8'))); } catch (e2) { console.error('No usable backup, starting empty.'); }
}
for (const u in db.users) db.users[u].state = L.migrate(db.users[u].state);
let dirty = false;
function saveDb(sync) {
  if (!dirty && !sync) return;
  dirty = false;
  const data = JSON.stringify(db), tmp = DB_FILE + '.tmp';
  try {
    if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, DB_FILE + '.bak');
    fs.writeFileSync(tmp, data); fs.renameSync(tmp, DB_FILE);
  } catch (e) { console.error('Save failed:', e.message); dirty = true; }
}
setInterval(saveDb, SAVE_EVERY);
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('Saving and shutting down...'); dirty = true; saveDb(true); process.exit(0); });

// ============================================================ HTTP (static files)
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent((req.url || '/').split('?')[0]);
  if (p === '/health') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end('ok ' + clients.size); }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(buf);
  });
});

// ============================================================ HELPERS
const clients = new Map(); let nextId = 1;
const now = () => Date.now();
const send = (c, o) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };
const broadcast = (o, except) => { const m = JSON.stringify(o); for (const c of clients.values()) if (c.ready && c !== except && c.ws.readyState === 1) c.ws.send(m); };
const num = (v, lo, hi) => (typeof v === 'number' && isFinite(v)) ? Math.max(lo, Math.min(hi, v)) : null;
const BAD = /\b(f+u+c+k+\w*|s+h+i+t+\w*|b+i+t+c+h+\w*|c+u+n+t+\w*|d+i+c+k+\w*|a+s+s+h+o+l+e+\w*|w+h+o+r+e+\w*|s+l+u+t+\w*)\b/gi;
const cleanText = t => String(t || '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120).replace(BAD, m => '*'.repeat(m.length)).trim();
const sys = (m, c) => broadcast({ t: 'c', n: null, m, c });

function ctxFor(c) {
  const t = now(), ev = L.events(t);
  return { now: t, frenzy: !!ev.frenzy, lucky: !!ev.lucky, vip: L.inGarden(c.pos.x, c.pos.z), rate: c.rate };
}
function markSnap(c) { c.snapDirty = true; dirty = true; }
function publicState(s) { const o = Object.assign({}, s); return o; }
function shownPets(c) { return c.s ? L.equipped(c.s).slice(0, 3).map(p => p.id) : (c.guestPets || []); }
function lookOf(c) { return c.s ? c.s.look : (c.guestLook || null); }
function titleOf(c) { return c.s ? c.s.title : (c.guestTitle || ''); }
function playerInfo(c) { return { id: c.id, n: c.name, g: c.guest ? 1 : 0, r: c.s ? c.s.rb : c.guestRb || 0, x: c.pos.x, y: c.pos.y, z: c.pos.z, e: shownPets(c), lk: lookOf(c), ti: titleOf(c) }; }

// ============================================================ ACCOUNTS
const fails = new Map(); // key -> [timestamps]
function tooMany(key, max) { const t = now(), a = (fails.get(key) || []).filter(x => t - x < 10 * 60000); fails.set(key, a); return a.length >= max; }
function fail(key) { const a = fails.get(key) || []; a.push(now()); fails.set(key, a); }
const scrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k)));
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
function newSession(u) {
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions[sha(token)] = { u, exp: now() + 30 * 86400000 }; dirty = true;
  return token;
}
async function register(c, d) {
  const name = String(d.u || '').trim(), pw = String(d.p || ''), email = String(d.e || '').trim().toLowerCase();
  if (!/^[A-Za-z0-9_]{3,14}$/.test(name)) return authFail(c, 'Username: 3-14 letters, numbers or _');
  if (pw.length < 6 || pw.length > 72) return authFail(c, 'Password must be 6-72 characters');
  if (!/^[^\s@]{1,64}@[^\s@]{1,63}\.[^\s@]{2,}$/.test(email) || email.length > 100) return authFail(c, 'Enter a valid email');
  if (tooMany('reg:' + c.ip, 5)) return authFail(c, 'Too many new accounts from here. Try later.');
  const key = name.toLowerCase();
  if (db.users[key]) return authFail(c, 'That username is taken');
  if (db.emails[email]) return authFail(c, 'That email already has an account');
  fail('reg:' + c.ip);
  const salt = crypto.randomBytes(16).toString('hex'), hash = (await scrypt(pw, salt)).toString('hex');
  if (db.users[key]) return authFail(c, 'That username is taken');
  db.users[key] = { name, email, salt, hash, created: now(), last: now(), state: L.fresh(name) };
  db.emails[email] = key; dirty = true;
  log('New account', name);
  login(c, key, newSession(key));
}
async function loginPw(c, d) {
  const id = String(d.u || '').trim().toLowerCase(), pw = String(d.p || '');
  if (tooMany('ip:' + c.ip, 10) || tooMany('u:' + id, 5)) return authFail(c, 'Too many tries. Wait a few minutes.');
  const key = db.users[id] ? id : db.emails[id];
  const u = key && db.users[key];
  const hash = await scrypt(pw, u ? u.salt : 'nosuchuser-salt');
  if (!u || !crypto.timingSafeEqual(hash, Buffer.from(u.hash, 'hex'))) {
    fail('ip:' + c.ip); fail('u:' + id);
    return authFail(c, 'Wrong username/email or password');
  }
  login(c, key, newSession(key));
}
function resume(c, d) {
  const sess = db.sessions[sha(String(d.token || ''))];
  if (!sess || sess.exp < now() || !db.users[sess.u]) return authFail(c, 'Session expired. Please log in.', true);
  sess.exp = now() + 30 * 86400000; dirty = true;
  login(c, sess.u, null);
}
function authFail(c, err, quiet) { send(c, { t: 'auth', ok: false, err, quiet: !!quiet }); }

function login(c, key, token) {
  for (const o of clients.values()) if (o !== c && o.user === key) { send(o, { t: 'kick', m: 'You logged in somewhere else.' }); o.ws.close(); leave(o); }
  const u = db.users[key]; u.last = now();
  c.user = key; c.name = u.name; c.guest = false; c.s = u.state; c.s.name = u.name;
  enter(c, token);
  const d = L.daily(c.s, now());
  if (d) send(c, { t: 'fx', k: 'daily', ...d });
  deliverPending(c);
  markSnap(c);
}
function guest(c, d) {
  let n = String(d.n || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || ('Guest' + (1000 + Math.random() * 9000 | 0));
  if (db.users[n.toLowerCase()]) n = n.slice(0, 12) + '_g';
  c.name = n; c.guest = true; c.s = null; c.guestRb = num(d.r, 0, 99) || 0;
  enter(c, null);
}
function enter(c, token) {
  c.ready = true;
  const others = [...clients.values()].filter(o => o.ready && o !== c).map(playerInfo);
  send(c, { t: 'welcome', id: c.id, name: c.name, guest: c.guest, token, s: c.s ? publicState(c.s) : null, time: now(), players: others, board: boardMsg(), boss: bossInfo() });
  broadcast({ t: 'j', p: playerInfo(c) }, c);
  log((c.guest ? 'Guest ' : 'Player ') + c.name + ' joined (' + clients.size + ' online)');
}
function deliverPending(c) {
  const p = db.pending[c.user]; if (!p || !p.length) return;
  for (const r of p) { L.give(c.s, 0, r.gems); send(c, { t: 'fx', k: 'msg', m: r.msg + ' +' + r.gems + ' gems!', c: '#7df9ff' }); }
  delete db.pending[c.user]; markSnap(c);
}

// ============================================================ BOSS
let boss = { active: false, hp: 0, max: C.BOSS_HP, end: 0, window: 0, hits: new Map(), lastBroadcast: 0 };
function bossInfo() { return boss.active ? { hp: boss.hp, max: boss.max, end: boss.end, n: boss.hits.size } : null; }
function startBoss(end) {
  boss = { active: true, hp: C.BOSS_HP, max: C.BOSS_HP, end, window: end, hits: new Map(), lastBroadcast: 0 };
  broadcast({ t: 'boss', a: 'start', b: bossInfo(), time: now() });
  sys('⚔️ The TAP TITAN has appeared in the lobby! Everyone tap it together: ' + C.BOSS_HP + ' hits in 3 minutes!', '#ff9a4d');
  log('Boss started');
}
function hitBoss(c, n) {
  if (!boss.active || n <= 0 || !L.nearBoss(c.pos.x, c.pos.z)) return 0;
  n = Math.min(n, boss.hp); boss.hp -= n;
  const key = c.user || ('g' + c.id);
  const h = boss.hits.get(key) || { n: 0, name: c.name, user: c.user, cid: c.id };
  h.n += n; h.cid = c.id; boss.hits.set(key, h);
  if (c.s) L.bossHits(c.s, n);
  if (boss.hp <= 0) endBoss(true);
  return n;
}
function endBoss(win) {
  if (!boss.active) return;
  boss.active = false;
  const top = [...boss.hits.values()].sort((a, b) => b.n - a.n).slice(0, 3).map(h => h.name + ' (' + h.n + ')').join(', ');
  sys(win ? '🏆 The Tap Titan was defeated! Top hitters: ' + (top || 'nobody') : '💨 The Tap Titan escaped with ' + boss.hp + ' HP left...', win ? '#7dff6a' : '#ff9a9a');
  const done = new Set();
  for (const [key, h] of boss.hits) {
    const c = clients.get(h.cid);
    if (h.user) {
      const u = db.users[h.user]; if (!u) continue;
      const live = c && c.user === h.user ? c : null;
      const r = L.bossReward(u.state, win, h.n, live ? ctxFor(live) : { now: now() });
      if (live) { send(live, { t: 'boss', a: 'end', win, hits: h.n, r }); markSnap(live); done.add(live); }
      dirty = true;
    } else if (c) { send(c, { t: 'boss', a: 'end', win, hits: h.n, guest: true }); done.add(c); }
  }
  for (const c of clients.values()) if (c.ready && !done.has(c)) send(c, { t: 'boss', a: 'end', win, hits: 0 });
  log('Boss ended', win ? 'WIN' : 'FAIL', 'players', boss.hits.size);
}

// ============================================================ TRADING
const trades = new Map(); let nextTrade = 1;
function tradeOf(c) { return c.trade ? trades.get(c.trade) : null; }
function tradeSend(T) {
  for (const id of [T.a, T.b]) {
    const c = clients.get(id); if (!c) continue;
    const other = clients.get(id === T.a ? T.b : T.a);
    send(c, { t: 'tr', a: 'state', id: T.id, with: other ? other.name : '?', mine: T.offer[id], theirs: T.offer[id === T.a ? T.b : T.a],
      ready: !!T.ready[id], theirReady: !!T.ready[id === T.a ? T.b : T.a], go: T.go || 0, time: now() });
  }
}
function tradeEnd(T, msg, color) {
  trades.delete(T.id);
  for (const id of [T.a, T.b]) { const c = clients.get(id); if (c) { c.trade = 0; send(c, { t: 'tr', a: 'end', m: msg, c: color }); } }
}
function validOffer(s, offer) {
  let kinds = 0;
  for (const id in offer) { kinds++; if (!(s.pets[id] >= offer[id])) return false; }
  return kinds <= 9;
}
function tradeExecute(T) {
  const A = clients.get(T.a), B = clients.get(T.b);
  if (!A || !B || !A.s || !B.s) return tradeEnd(T, 'Trade cancelled (player left)', '#ff9a9a');
  const oa = T.offer[T.a], ob = T.offer[T.b];
  if (!validOffer(A.s, oa) || !validOffer(B.s, ob)) return tradeEnd(T, 'Trade failed: pets changed. Nothing was swapped.', '#ff9a9a');
  if (!Object.keys(oa).length && !Object.keys(ob).length) return tradeEnd(T, 'Empty trade cancelled', '#ff9a9a');
  const move = (from, to, offer) => { for (const id in offer) { from.pets[id] -= offer[id]; if (from.pets[id] <= 0) delete from.pets[id]; to.pets[id] = (to.pets[id] || 0) + offer[id]; L.markIndex(to, id); } };
  move(A.s, B.s, oa); move(B.s, A.s, ob);
  for (const s of [A.s, B.s]) { const best = Object.keys(s.pets).map(Number).filter(id => L.pet(id)).sort((x, y) => L.pet(y).p - L.pet(x).p)[0]; s.best = best === undefined ? -1 : best; }
  markSnap(A); markSnap(B); dirty = true; saveDb(true);
  try { fs.appendFileSync(path.join(DATA_DIR, 'trades.log'), JSON.stringify({ t: new Date().toISOString(), a: A.name, b: B.name, aGave: oa, bGave: ob }) + '\n'); } catch (e) {}
  log('Trade', A.name, '<->', B.name);
  tradeEnd(T, 'Trade complete! 🤝', '#7dff6a');
}
function onTrade(c, d) {
  if (c.guest || !c.s) return send(c, { t: 'fx', k: 'msg', m: 'Log in to trade (guests cannot trade)', c: '#ff9a9a' });
  const T = tradeOf(c);
  if (d.a === 'req') {
    const o = clients.get(d.to);
    if (!o || !o.ready || o === c) return;
    if (o.guest) return send(c, { t: 'fx', k: 'msg', m: o.name + ' is a guest and cannot trade', c: '#ff9a9a' });
    if (T || o.trade) return send(c, { t: 'fx', k: 'msg', m: 'One of you is already trading', c: '#ff9a9a' });
    if (c.lastReq && now() - c.lastReq < 4000) return;
    c.lastReq = now(); o.reqFrom = { id: c.id, t: now() };
    send(o, { t: 'tr', a: 'req', from: c.id, name: c.name });
    send(c, { t: 'fx', k: 'msg', m: 'Trade request sent to ' + o.name, c: '#bfe8ff' });
  } else if (d.a === 'accept') {
    const o = clients.get(d.from);
    if (!o || !c.reqFrom || c.reqFrom.id !== o.id || now() - c.reqFrom.t > 30000 || T || o.trade || !o.s) return send(c, { t: 'fx', k: 'msg', m: 'That trade request expired', c: '#ff9a9a' });
    c.reqFrom = null;
    const NT = { id: nextTrade++, a: o.id, b: c.id, offer: { [o.id]: {}, [c.id]: {} }, ready: {}, go: 0 };
    trades.set(NT.id, NT); o.trade = c.trade = NT.id; tradeSend(NT);
  } else if (d.a === 'decline') {
    const o = clients.get(d.from); c.reqFrom = null;
    if (o) send(o, { t: 'fx', k: 'msg', m: c.name + ' declined the trade', c: '#ff9a9a' });
  } else if (!T) return;
  else if (d.a === 'offer') {
    const offer = {}; let kinds = 0;
    if (d.pets && typeof d.pets === 'object') for (const id in d.pets) {
      const n = Math.floor(num(d.pets[id], 0, 9999) || 0);
      if (!L.pet(id) || n <= 0) continue;
      if (++kinds > 9) break;
      offer[id] = Math.min(n, c.s.pets[id] || 0);
      if (!offer[id]) delete offer[id];
    }
    T.offer[c.id] = offer; T.ready = {}; T.go = 0; tradeSend(T);
  } else if (d.a === 'ready') {
    T.ready[c.id] = !!d.v;
    T.go = (T.ready[T.a] && T.ready[T.b]) ? now() + 3000 : 0;
    tradeSend(T);
  } else if (d.a === 'cancel') tradeEnd(T, c.name + ' cancelled the trade', '#ff9a9a');
}

// ============================================================ ACTIONS (account players)
const NEAR = 4; // leniency for lag
function act(c, d) {
  const s = c.s, t = now(), ctx = ctxFor(c), a = String(d.a || '');
  if (!s) return;
  if (c.lastAct && t - c.lastAct < 60) return; // max ~16 actions/sec
  c.lastAct = t;
  let r;
  const nearSt = k => L.near(c.pos.x, c.pos.z, k, NEAR);
  switch (a) {
    case 'hatch':
      if (c.lastHatch && t - c.lastHatch < 450) { r = { ok: false, err: 'Slow down!' }; break; }
      c.lastHatch = t; r = L.hatch(s, d.n === 3 ? 3 : 1, ctx, Math.random);
      if (r.ok) announcePets(c, r.pets);
      break;
    case 'area': r = L.setArea(s, num(d.k, 0, 9) | 0); break;
    case 'unlock': r = L.unlock(s, num(d.k, 0, 9) | 0); break;
    case 'rebirth':
      if (c.trade) { r = { ok: false, err: 'Finish your trade first' }; break; }
      r = L.rebirth(s); if (r.ok) sys(c.name + ' reached Rebirth ' + s.rb + '! ♻️', '#e0a0ff'); break;
    case 'buy': r = L.buy(s, String(d.id || ''), t); break;
    case 'spin': r = nearSt('wheel') ? L.spin(s, t, ctx, Math.random) : { ok: false, err: 'Walk to the Lucky Wheel' }; break;
    case 'chest': r = nearSt('chest') ? L.chest(s, t, ctx) : { ok: false, err: 'Walk to the chest' }; break;
    case 'gem': {
      const i = num(d.i, 0, 999) | 0, g = W.GEMS[i];
      if (!g || Math.hypot(c.pos.x - g[0], c.pos.z - g[1]) > Math.max(L.magnet(s), C.PET_FETCH_RANGE) + 2.5) { r = { ok: false, err: '', quiet: 1 }; break; }
      if (c.lastGem && t - c.lastGem < 700) { r = { ok: false, quiet: 1 }; break; }
      c.lastGem = t; r = L.gemPickup(s, i, t, Math.random); break;
    }
    case 'rock': {
      const i = num(d.i, 0, 99) | 0, k = W.ROCKS[i];
      r = (k && Math.hypot(c.pos.x - k[0], c.pos.z - k[1]) < 6) ? L.rock(s, i, t, ctx) : { ok: false, quiet: 1 }; break;
    }
    case 'lava':
      if (!L.inLava(c.pos.x, c.pos.z) || (c.lastLava && t - c.lastLava < 900)) { r = { ok: false, quiet: 1 }; break; }
      c.lastLava = t; r = L.lava(s, ctx); break;
    case 'obbyStart': c.obbyStart = t; r = { ok: true, quiet: 1 }; break;
    case 'obbyEnd': {
      const last = W.PL[W.PL.length - 1];
      if (Math.abs(c.pos.x - last.x) > 6) { r = { ok: false, err: 'Reach the finish platform first' }; break; }
      r = L.obbyEnd(s, t, c.obbyStart, ctx); c.obbyStart = 0; break;
    }
    case 'claim': r = L.claimQuest(s, num(d.i, 0, 9) | 0, ctx); break;
    case 'auto': r = L.setAuto(s, String(d.k), !!d.on); break;
    // ----- rocket + moon (positions are checked) -----
    case 'rocket': r = nearSt('rocket') ? L.buyRocket(s) : { ok: false, err: 'Go to the rocket in the Space Station hangar' }; break;
    case 'launch': r = s.rocket && (nearSt('rocket') || nearSt('rhome')) ? { ok: true, to: nearSt('rhome') ? 'home' : 'moon' } : { ok: false, err: s.rocket ? 'Stand on the rocket pad' : 'Buy the rocket first' }; break;
    case 'mhatch': { const e = num(d.e, 0, 1) | 0;
      if (c.lastHatch && t - c.lastHatch < 450) { r = { ok: false, err: 'Slow down!' }; break; }
      c.lastHatch = t; r = nearSt('megg' + e) ? L.mhatch(s, e, d.n === 3 ? 3 : 1, ctx, Math.random) : { ok: false, err: 'Walk to the egg on the moon' };
      if (r.ok) announcePets(c, r.pets); break; }
    case 'mbuy': r = nearSt('dshop') ? L.mbuy(s, String(d.id || '')) : { ok: false, err: 'Walk to the Stardust Shop' }; break;
    case 'meteor': r = L.onMoon(c.pos.x, c.pos.z) ? L.meteorCatch(s, num(d.slot, 0, 1e9) | 0, num(d.i, 0, 99) | 0, t, c.pos.x, c.pos.z) : { ok: false, quiet: 1 }; break;
    case 'dust': { const i = num(d.i, 0, 99) | 0, q = W.DUST[i];
      r = q && Math.hypot(c.pos.x - q[0], c.pos.z - q[1]) < 4 && Math.abs(c.pos.y + 1 - q[2]) < 4 ? L.dustPickup(s, i, t) : { ok: false, quiet: 1 }; break; }
    case 'mobbyStart': c.mobbyStart = L.onMoon(c.pos.x, c.pos.z) ? t : 0; r = { ok: true, quiet: 1 }; break;
    case 'mobbyEnd': { const last = W.MROCK[W.MROCK.length - 1];
      r = Math.hypot(c.pos.x - last.x, c.pos.z - last.z) < 5 && c.pos.y > last.y - 3 ? L.mobbyEnd(s, t, c.mobbyStart) : { ok: false, err: 'Reach the top rock first' }; c.mobbyStart = 0; break; }
    case 'fuse': r = nearSt('shiny') ? L.fuse(s, num(d.id, 0, 999) | 0) : { ok: false, err: 'Walk to the Shiny Machine on the moon' }; break;
    case 'title': r = L.setTitle(s, String(d.id || '')); if (r.ok) broadcast({ t: 'lk', id: c.id, lk: s.look, ti: s.title }); break;
    default: return;
  }
  send(c, { t: 'res', a, r, q: d.q });
  markSnap(c);
}
function announcePets(c, ids) {
  for (const id of ids) {
    const p = L.pet(id);
    if (p.r >= 5) sys('🌟 ' + c.name + ' hatched a ' + C.RARITIES[p.r].n.toUpperCase() + ' ' + p.n + '! ' + p.e, C.RARITIES[p.r].c);
  }
}

// ============================================================ LEADERBOARD
let boardCache = null, boardAt = 0;
function boardMsg() {
  if (boardCache && now() - boardAt < 4000) return boardCache;
  const users = Object.values(db.users);
  const all = users.map(u => [u.name, Math.floor(u.state.total), u.state.rb]).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const week = Object.entries(db.week.scores).map(([k, v]) => [db.users[k] ? db.users[k].name : k, Math.floor(v), db.users[k] ? db.users[k].state.rb : 0])
    .sort((a, b) => b[1] - a[1]).slice(0, 10);
  boardCache = { week, all, last: db.lastWeek, weekId: db.week.id, rewards: C.WEEKLY_REWARDS };
  boardAt = now();
  return boardCache;
}
function addWeek(c, v) { if (!c.user || !(v > 0)) return; db.week.scores[c.user] = (db.week.scores[c.user] || 0) + v; }
function weeklyCheck() {
  const wk = L.weekKey(now());
  if (db.week.id === wk) return;
  if (db.week.id) {
    const top = Object.entries(db.week.scores).sort((a, b) => b[1] - a[1]).slice(0, C.WEEKLY_REWARDS.length);
    db.lastWeek = { id: db.week.id, top: top.map(([k, v]) => [db.users[k] ? db.users[k].name : k, Math.floor(v)]) };
    top.forEach(([k], i) => {
      (db.pending[k] = db.pending[k] || []).push({ gems: C.WEEKLY_REWARDS[i], msg: 'Weekly leaderboard #' + (i + 1) + ' reward!' });
    });
    if (top.length) sys('📅 New week! Last week\'s winner: ' + db.lastWeek.top[0][0] + '. The weekly board has been reset.', '#ffd000');
    for (const c of clients.values()) if (c.user) deliverPending(c);
  }
  db.week = { id: wk, scores: {} }; dirty = true; boardCache = null;
  log('Weekly board is now week of', wk);
}

// ============================================================ CONNECTIONS
const wss = new WebSocketServer({ server, maxPayload: 16 * 1024 });
wss.on('connection', (ws, req) => {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const c = { ws, id: nextId++, ip: fwd || req.socket.remoteAddress || '?', ready: false, name: '', guest: true, s: null, user: null,
    pos: { x: 0, y: 0, z: 3, w: 0, m: 0 }, tokens: C.TAP_BURST, tokT: now(), tapLog: [], rate: 0, acc: {}, snapDirty: false, lastSnap: 0,
    ack: 0, alive: true, msgN: 0, msgT: now(), chatT: 0, trade: 0, obbyStart: 0 };
  clients.set(c.id, c);
  ws.on('pong', () => { c.alive = true; });
  ws.on('message', async raw => {
    const t = now();
    if (t - c.msgT > 1000) { c.msgT = t; c.msgN = 0; }
    if (++c.msgN > 80) return; // flood: drop
    let d; try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || typeof d.t !== 'string') return;
    try { await onMsg(c, d); } catch (e) { console.error('Message error:', e); }
  });
  ws.on('close', () => leave(c));
  ws.on('error', () => {});
});
async function onMsg(c, d) {
  if (!c.ready) {
    if (c.authBusy) return;
    c.authBusy = true;
    try {
      if (d.t === 'register') await register(c, d);
      else if (d.t === 'login') await loginPw(c, d);
      else if (d.t === 'resume') resume(c, d);
      else if (d.t === 'guest') guest(c, d);
    } finally { c.authBusy = false; }
    return;
  }
  switch (d.t) {
    case 'p': {
      const x = num(d.x, -1000, 1000), y = num(d.y, -100, 200), z = num(d.z, -1000, 1000);
      if (x === null || y === null || z === null) return;
      c.pos = { x, y, z, w: num(d.w, -10, 10) || 0, m: d.m ? 1 : 0 };
      if (c.guest) { c.guestRb = num(d.r, 0, 99) || 0; if (Array.isArray(d.e)) c.guestPets = d.e.slice(0, 3).filter(i => L.pet(i)).map(Number); }
      break;
    }
    case 'tap': {
      const t = now(); let n = Math.floor(num(d.n, 0, 40) || 0);
      c.tokens = Math.min(C.TAP_BURST, c.tokens + (t - c.tokT) / 1000 * C.MAX_TAPS_PER_SEC); c.tokT = t;
      while (c.tapLog.length && t - c.tapLog[0][0] >= 1000) c.tapLog.shift();
      const inWindow = c.tapLog.reduce((a, b) => a + b[1], 0);
      n = Math.max(0, Math.min(n, Math.floor(c.tokens), C.MAX_TAPS_PER_SEC - inWindow)); c.tokens -= n;
      c.tapLog.push([t, n]);
      c.rate = c.tapLog.reduce((a, b) => a + b[1], 0);
      if (n > 0) {
        if (c.s) { const v = L.tap(c.s, n, ctxFor(c)); addWeek(c, v); }
        hitBoss(c, n);
      }
      c.ack = num(d.seq, 0, 1e12) || c.ack;
      if (c.s) markSnap(c);
      break;
    }
    case 'act': act(c, d); break;
    case 'tr': onTrade(c, d); break;
    case 'c': {
      const t = now(); if (t - c.chatT < 1200) return; c.chatT = t;
      const m = cleanText(d.m); if (!m) return;
      broadcast({ t: 'c', id: c.id, n: c.name + (c.guest ? ' (guest)' : ''), m });
      break;
    }
    case 'look': {
      if (c.s) { const r = L.setLook(c.s, d.look); if (!r.ok) return send(c, { t: 'fx', k: 'msg', m: r.err, c: '#ff9a9a' }); markSnap(c); }
      else { const v = L.validLook(d.look, true); if (!v) return; c.guestLook = v; c.guestTitle = C.TITLES.some(x => x.id === d.title) ? d.title : ''; }
      broadcast({ t: 'lk', id: c.id, lk: lookOf(c), ti: titleOf(c) }); break;
    }
    case 'em': {
      const t = now(); if (c.emT && t - c.emT < 900) return; c.emT = t;
      if (!C.EMOTES.some(e => e.id === d.e)) return;
      broadcast({ t: 'em', id: c.id, e: d.e }, c); break;
    }
    case 'logout': if (c.user) for (const k in db.sessions) if (db.sessions[k].u === c.user && d.all) delete db.sessions[k]; break;
  }
}
function leave(c) {
  if (!clients.has(c.id)) return;
  clients.delete(c.id);
  const T = tradeOf(c); if (T) tradeEnd(T, c.name + ' left, trade cancelled', '#ff9a9a');
  if (c.ready) { broadcast({ t: 'l', id: c.id }); log(c.name + ' left (' + clients.size + ' online)'); }
  dirty = true;
}

// ============================================================ GAME LOOP
let lastEv = '', lastWeekCheck = 0;
setInterval(() => {
  const t = now(), ev = L.events(t);
  // boss schedule
  if (ev.boss && !boss.active && boss.window !== ev.boss) startBoss(ev.boss);
  if (boss.active && t >= boss.end) endBoss(false);
  if (boss.active && t - boss.lastBroadcast > 250) { boss.lastBroadcast = t; broadcast({ t: 'bh', b: bossInfo() }); }
  const evKey = (ev.frenzy ? 'F' : '') + (ev.lucky ? 'L' : '');
  if (evKey !== lastEv) {
    if (ev.frenzy && !lastEv.includes('F')) sys('⚡ FRENZY! 2x taps for 3 minutes!', '#ffe14d');
    if (ev.lucky && !lastEv.includes('L')) sys('🍀 LUCKY EGGS! Better hatch odds for 3 minutes!', '#7dff6a');
    lastEv = evKey; broadcast({ t: 'ev', time: t });
  }
  // trades countdown
  for (const T of trades.values()) if (T.go && t >= T.go) tradeExecute(T);
  // snapshots + positions
  const pos = [];
  for (const c of clients.values()) {
    if (!c.ready) continue;
    pos.push([c.id, +c.pos.x.toFixed(2), +c.pos.y.toFixed(2), +c.pos.z.toFixed(2), +c.pos.w.toFixed(2), c.pos.m, c.s ? c.s.rb : c.guestRb || 0, shownPets(c)]);
    if (c.s && c.snapDirty && t - c.lastSnap > 150) { c.snapDirty = false; c.lastSnap = t; send(c, { t: 'st', s: c.s, ack: c.ack, time: t }); }
  }
  if (pos.length) broadcast({ t: 'u', p: pos });
  if (t - lastWeekCheck > 30000) { lastWeekCheck = t; weeklyCheck(); }
}, 100);

// once a second: auto tapper / AFK pad / auto hatch, play time, daily reset
let boardTick = 0;
setInterval(() => {
  const t = now();
  for (const c of clients.values()) {
    if (!c.ready || !c.s) continue;
    const s = c.s; s.time += 1;
    const ctx = ctxFor(c); ctx.onPad = L.near(c.pos.x, c.pos.z, 'afk', 1.8);
    const out = L.autoTick(s, 1, ctx, c.acc, Math.random);
    if (out.taps) addWeek(c, out.taps);
    if (out.pets.length) { send(c, { t: 'fx', k: 'autohatch', pets: out.pets }); announcePets(c, out.pets); }
    if (out.taps || out.pets.length) markSnap(c);
    if (t % 60000 < 1000) { const d = L.daily(s, t); if (d) { send(c, { t: 'fx', k: 'daily', ...d }); markSnap(c); } }
  }
  if (++boardTick % 5 === 0) { boardCache = null; broadcast({ t: 'b', b: boardMsg() }); }
  for (const k in db.sessions) if (db.sessions[k].exp < t) { delete db.sessions[k]; dirty = true; }
}, 1000);

// heartbeat
setInterval(() => { for (const c of clients.values()) { if (!c.alive) { c.ws.terminate(); leave(c); continue; } c.alive = false; try { c.ws.ping(); } catch (e) {} } }, 20000);

weeklyCheck();
// test hook only: TL_TEST_BOSS=<hp> spawns a boss 1 second after start (used by tests/test-server.js)
if (process.env.TL_TEST_BOSS) setTimeout(() => { C.BOSS_HP = +process.env.TL_TEST_BOSS; startBoss(now() + 60000); }, 1000);
server.listen(PORT, () => log(`Tapping Legends running on http://localhost:${PORT}  (data in ${DATA_DIR})`));
module.exports = { server, db, clients, _boss: () => boss, _startBoss: startBoss, _endBoss: endBoss };
