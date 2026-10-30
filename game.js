/* Tapping Legends - game core: state, networking, controls, camera, main loop. */
(function () {
  'use strict';
  const L = TL, C = L.C, W = L.W, $ = q => document.querySelector(q), clamp = L.clamp, fmt = L.fmt;
  const canvas = $('#c'), ov = $('#ov'), og = ov.getContext('2d');
  const E = TLEngine(canvas);
  if (!E.ok) { document.body.innerHTML = '<div style="padding:40px;font:20px sans-serif;color:#fff">Sorry, this browser has WebGL turned off, so the 3D game cannot start. Try Chrome or Edge, or ask IT to enable hardware acceleration.</div>'; return; }
  const WD = TLWorld(E, L); WD.build();
  // signs are painted with the bundled font: repaint them once it has loaded
  try { Promise.all([document.fonts.load('800 40px Outfit'), document.fonts.load('400 40px Boldonse')]).then(() => WD.refreshSigns()).catch(() => {}); } catch (e) {}
  const AU = TLAudio;
  const store = { get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------- settings ----------
  const SET = Object.assign({ quality: 'auto', sfx: 0.7, music: 0.35, sens: 1, names: true, shiftKey: true, fps: false }, store.get('tl_settings', {}));
  const touch = 'ontouchstart' in window; if (touch) document.body.classList.add('touch');
  let autoQ = SET.quality === 'auto', extraScale = 1;
  E.setQuality(autoQ ? (touch ? 'low' : 'med') : SET.quality);
  AU.setVol(SET.sfx, SET.music);

  // ---------- app state ----------
  const P = { x: 0, y: 0, z: 3, vy: 0, yaw: Math.PI, mv: false, gr: true, coy: 0, kx: 0, kz: 0, ph: 0, spd: 0, land: 0, ox: 0, oz: 0, wasGr: true, airT: 0 };
  const cam = { x: 0, y: 0, z: 3, yaw: 0, pitch: 0.42, dist: 12 };
  const App = {
    E, settings: SET, s: null, mode: null, online: false, inGame: false, others: new Map(), board: null, boss: null, bossMine: 0,
    trade: null, tradeReq: null, myId: 0, myName: '', P, tOff: 0
  };
  window.App = App;
  App.now = () => Date.now() + App.tOff;
  App.audio = (n, a) => AU.play(n, a);
  let tapLog = [];
  const tapRate = () => { const n = performance.now(); tapLog = tapLog.filter(t => n - t < 1000); return tapLog.length; };
  App.ctx = () => { const now = App.now(), ev = L.events(now); return { now, frenzy: !!ev.frenzy, lucky: !!ev.lucky, vip: L.inGarden(P.x, P.z), rate: tapRate() }; };
  const isl = () => { for (let k = 0; k < 5; k++) { const c = W.CEN[k]; if (Math.abs(P.x - c[0]) <= W.IH && Math.abs(P.z - c[1]) <= W.IH) return k; } return -1; };
  App.island = isl;
  const inOb = () => P.x > W.OB - 30;
  const onMoon = () => L.onMoon(P.x, P.z);
  App.onMoon = onMoon;
  const MOONPL = W.MPL.concat(W.MROCK), MR0 = W.MPL.length; // MOONPL[MR0 + i] = moon obby rock i

  // ---------- walkable areas ----------
  const RG = [{ x1: W.HUB.x1, x2: W.HUB.x2, z1: W.HUB.z1, z2: W.HUB.z2, act: () => 1 },
    { x1: W.GARDEN.x2, x2: W.HUB.x1, z1: -2.2, z2: 2.2, act: () => App.s.clicks >= C.GARDEN_CLICKS },
    { x1: W.GARDEN.x1, x2: W.GARDEN.x2, z1: W.GARDEN.z1, z2: W.GARDEN.z2, act: () => App.s.clicks >= C.GARDEN_CLICKS }];
  const BRIDGE = [];
  W.CEN.forEach((c, k) => {
    const b = W.BRG[k], v = b[0] === b[2], op = () => App.s.open.includes(k);
    RG.push({ x1: c[0] - W.IH, x2: c[0] + W.IH, z1: c[1] - W.IH, z2: c[1] + W.IH, act: op });
    const r = v ? { x1: b[0] - 2, x2: b[0] + 2, z1: Math.min(b[1], b[3]), z2: Math.max(b[1], b[3]), act: op } : { x1: Math.min(b[0], b[2]), x2: Math.max(b[0], b[2]), z1: b[1] - 2, z2: b[1] + 2, act: op };
    RG.push(r); BRIDGE.push(Object.assign({ v }, r));
  });
  const walkOK = (x, z) => Math.hypot(x - W.MOON.x, z - W.MOON.z) < W.MOON.r - 0.8 || RG.some(r => r.act() && x >= r.x1 && x <= r.x2 && z >= r.z1 && z <= r.z2);
  const groundY = (x, z) => {
    for (const b of BRIDGE) if (x >= b.x1 && x <= b.x2 && z >= b.z1 && z <= b.z2) {
      const t = b.v ? (z - b.z1) / (b.z2 - b.z1) : (x - b.x1) / (b.x2 - b.x1);
      if (t > 0.03 && t < 0.97) return -0.01 - Math.sin(t * Math.PI) * 0.35;
    }
    return 0;
  };

  // ---------- network ----------
  let ws = null, wsReady = false, pendingAuth = null, seq = 0, unsent = 0, pend = [], srvS = null, reconnectT = 0, token = store.get('tl_token', null), savedName = store.get('tl_name', '');
  const send = o => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };
  App.send = send;
  function connect() {
    if (location.protocol === 'file:') { setOffline('Opened as a file: accounts need the server. Guest mode works offline.'); return; }
    try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host); } catch (e) { setOffline('Could not reach the server.'); return; }
    ws.onopen = () => { wsReady = true; if (pendingAuth) { send(pendingAuth); pendingAuth = null; } else if (App.inGame) reauth(); };
    ws.onmessage = ev => { let d; try { d = JSON.parse(ev.data); } catch (e) { return; } onMsg(d); };
    ws.onclose = () => {
      const was = App.online; wsReady = false; App.online = false; App.others.clear(); App.boss = null;
      if (was) UI.sys('Disconnected. Reconnecting...', '#ff9');
      if (!App.inGame && !was) setOffline('Server not reachable right now. You can still play as a guest.');
      clearTimeout(reconnectT); reconnectT = setTimeout(connect, 3000);
    };
    ws.onerror = () => {};
  }
  function setOffline(msg) {
    $('#authnote').textContent = msg; $('#authnote').style.color = '#ffcf8a';
    $('#authbtn').disabled = location.protocol === 'file:';
  }
  function reauth() {
    if (App.mode === 'account' && token) send({ t: 'resume', token });
    else if (App.mode === 'guest') send({ t: 'guest', n: App.myName, r: App.s.rb });
  }
  App.auth = function (msg) {
    AU.unlock();
    if (wsReady) send(msg); else { pendingAuth = msg; if (!ws || ws.readyState > 1) connect(); setTimeout(() => { if (pendingAuth) UI.authMsg('Cannot reach the server. Try guest mode.'); }, 5000); }
  };
  App.playGuest = function (name) {
    AU.unlock();
    name = String(name || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || ('Guest' + (1000 + Math.random() * 9000 | 0));
    App.mode = 'guest'; App.myName = name; store.set('tl_gname', name);
    App.s = L.migrate(store.get('tl_guest_v2', null)); App.s.name = name;
    const d = L.daily(App.s, App.now()); if (d) setTimeout(() => dailyToast(d), 1200);
    enterGame();
    if (wsReady) send({ t: 'guest', n: name, r: App.s.rb });
  };
  function dailyToast(d) { UI.toast('🔥 Day ' + d.streak + ' login streak! +' + d.gems + ' 💎', '#7df9ff'); AU.play('gem'); }
  function onMsg(d) {
    switch (d.t) {
      case 'auth':
        if (d.quiet) { token = null; store.set('tl_token', null); $('#resumebtn').classList.add('hidden'); if (App.inGame) location.reload(); return; }
        UI.authMsg(d.err); break;
      case 'welcome':
        App.myId = d.id; App.myName = d.name; App.online = true; App.tOff = d.time - Date.now();
        App.others.clear(); d.players.forEach(addOther); App.board = d.board; App.boss = d.boss; App.bossMine = 0;
        if (!d.guest) {
          App.mode = 'account'; if (d.token) { token = d.token; store.set('tl_token', token); }
          store.set('tl_name', d.name); srvS = d.s; App.s = L.migrate(JSON.parse(JSON.stringify(d.s))); unsent = 0; pend = [];
        }
        if (!App.inGame) enterGame(); else if (App.welcomed) UI.sys('Reconnected!', '#7dff6a');
        App.welcomed = true;
        if (d.guest) sendLook();
        UI.sys('Connected · ' + (d.players.length + 1) + ' online · press Enter to chat', '#7dff6a');
        break;
      case 'kick': alert(d.m); location.reload(); break;
      case 'st': {
        App.tOff = d.time - Date.now(); srvS = d.s;
        pend = pend.filter(p => p.seq > d.ack);
        const s = L.migrate(JSON.parse(JSON.stringify(d.s))), extra = unsent + pend.reduce((a, p) => a + p.n, 0);
        if (extra > 0) L.tap(s, extra, App.ctx());
        App.s = s; if (UI.cur && UI.cur !== 'trade' && UI.cur !== 'settings') throttledRender();
        break;
      }
      case 'res': handleRes(d.a, d.r); break;
      case 'fx':
        if (d.k === 'daily') dailyToast(d);
        else if (d.k === 'msg') UI.toast(d.m, d.c);
        else if (d.k === 'autohatch') autoHatched(d.pets);
        break;
      case 'u':
        for (const a of d.p) {
          if (a[0] === App.myId) continue; let o = App.others.get(a[0]);
          if (!o) continue;
          o.tx = a[1]; o.ty = a[2]; o.tz = a[3]; o.tyaw = a[4]; o.mv = a[5]; o.r = a[6]; o.e = a[7] || [];
        }
        break;
      case 'j': addOther(d.p); UI.sys(d.p.n + (d.p.g ? ' (guest)' : '') + ' joined'); break;
      case 'l': { const o = App.others.get(d.id); if (o) UI.sys(o.n + ' left'); App.others.delete(d.id); if (UI.cur === 'trade') UI.render(); break; }
      case 'c':
        UI.addChat(d.n, d.m, d.c);
        if (d.id === App.myId) bubble = { m: d.m, t: T }; else { const o = App.others.get(d.id); if (o) { o.bub = d.m; o.bt = T; } }
        break;
      case 'b': App.board = d.b; if (UI.cur === 'board') UI.render(); break;
      case 'lk': { const o = App.others.get(d.id); if (o) { o.lk = d.lk; o.ti = d.ti; } break; }
      case 'em': { const o = App.others.get(d.id); if (o) o.emote = { k: d.e, t0: T }; break; }
      case 'boss':
        if (d.a === 'start') { App.boss = d.b; App.bossMine = 0; AU.play('roar'); UI.toast('⚔️ THE TAP TITAN APPEARS! Go to the boss arena!', '#ff9a4d'); WD.boss.dieT = -1; }
        else { App.boss = null; WD.boss.dieT = d.win ? T : -1; WD.bossBurst(d.win); AU.play(d.win ? 'win' : 'whoosh');
          if (d.guest) { const r = L.bossReward(App.s, d.win, d.hits, App.ctx()); bossResult(d.win, d.hits, r); saveGuest(); }
          else bossResult(d.win, d.hits, d.r || { ok: false }); }
        break;
      case 'bh': if (d.b) { if (App.boss && d.b.hp < App.boss.hp) WD.boss.flash = Math.max(WD.boss.flash, 0.5); App.boss = d.b; } break;
      case 'ev': AU.play('horn'); break;
      case 'tr':
        if (d.a === 'req') { App.tradeReq = { from: d.from, name: d.name }; UI.toast('📨 ' + d.name + ' wants to trade! Open the Trade menu.', '#7dff6a'); UI.sys(d.name + ' sent you a trade request. Open 🤝 Trade.', '#7dff6a'); if (UI.cur === 'trade') UI.render(); }
        else if (d.a === 'state') { App.trade = d; App.tradeReq = null; App.tOff = d.time - Date.now(); if (UI.cur !== 'trade') UI.show('trade'); else UI.render(); }
        else if (d.a === 'end') { App.trade = null; UI.tradeSel = {}; UI.toast(d.m, d.c); if (UI.cur === 'trade') UI.render(); }
        break;
    }
  }
  let renderT = 0; function throttledRender() { const n = performance.now(); if (n - renderT > 300) { renderT = n; UI.render(); } }
  function addOther(p) { App.others.set(p.id, { id: p.id, n: p.n, g: p.g, r: p.r, lk: p.lk, ti: p.ti, x: p.x, y: p.y, z: p.z, tx: p.x, ty: p.y, tz: p.z, yaw: 0, tyaw: 0, mv: 0, e: p.e || [], bub: '', bt: 0, pets: [] }); }
  App.tradeSend = o => send(Object.assign({ t: 'tr' }, o));
  function bossResult(win, hits, r) {
    if (r && r.ok) { UI.toast((win ? '🏆 BOSS DEFEATED! ' : '💨 Boss escaped. ') + '+' + r.gems + ' 💎 +' + fmt(r.taps) + ' taps (' + hits + ' hits)', win ? '#7dff6a' : '#ffcf8a'); AU.play('gem'); if (win) App.confetti(4); }
    else if (hits > 0) UI.toast(r && r.err ? r.err : 'Boss fight over', '#ffcf8a');
  }
  function autoHatched(ids) {
    for (const id of ids) { const p = L.pet(id); if (p.r >= 3) { UI.toast('🥚 Auto-hatched ' + C.RARITIES[p.r].n + ' ' + p.n + '! ' + p.e, C.RARITIES[p.r].c); AU.play('reveal', p.r); if (p.r >= 4) App.confetti(p.r); } }
  }

  // ---------- actions ----------
  let mck = 0, mfalls = 0, mstand = -1, obbyStartLocal = 0, mobbyStartLocal = 0, wheelSpin = 0, ck = 0, ob = 0, falls = 0, myEmote = null, fetch = null;
  const dustPending = {}, meteorPending = {};
  const gemPending = {}, rockHp = W.ROCKS.map(() => 5), rockShake = W.ROCKS.map(() => 0), geysers = [];
  App.act = function (a, args) {
    args = args || {}; AU.unlock();
    if (App.mode === 'account') {
      if (!App.online) return UI.toast('Reconnecting to the server...', '#ffcf8a');
      if (a === 'area') App.s.area = args.k;
      send(Object.assign({ t: 'act', a }, args)); return;
    }
    const r = localAct(a, args); handleRes(a, r); saveGuest();
  };
  function localAct(a, g) {
    const s = App.s, ctx = App.ctx(), now = ctx.now, near = k => L.near(P.x, P.z, k, 4);
    switch (a) {
      case 'hatch': return L.hatch(s, g.n, ctx, Math.random);
      case 'area': return L.setArea(s, g.k);
      case 'unlock': return L.unlock(s, g.k);
      case 'rebirth': return L.rebirth(s);
      case 'buy': return L.buy(s, g.id, now);
      case 'spin': return near('wheel') ? L.spin(s, now, ctx, Math.random) : { ok: false, err: 'Walk to the Lucky Wheel' };
      case 'chest': return near('chest') ? L.chest(s, now, ctx) : { ok: false, err: 'Walk to the chest' };
      case 'gem': return L.gemPickup(s, g.i, now, Math.random);
      case 'rock': return L.rock(s, g.i, now, ctx);
      case 'lava': return L.lava(s, ctx);
      case 'obbyStart': obbyStartLocal = now; return { ok: true, quiet: 1 };
      case 'obbyEnd': { const r = L.obbyEnd(s, now, obbyStartLocal, ctx); obbyStartLocal = 0; return r; }
      case 'claim': return L.claimQuest(s, g.i, ctx);
      case 'auto': return L.setAuto(s, g.k, g.on);
      case 'rocket': return near('rocket') ? L.buyRocket(s) : { ok: false, err: 'Go to the rocket in the Space Station hangar' };
      case 'launch': return s.rocket && (near('rocket') || near('rhome')) ? { ok: true, to: near('rhome') ? 'home' : 'moon' } : { ok: false, err: s.rocket ? 'Stand on the rocket pad' : 'Buy the rocket first' };
      case 'mhatch': return near('megg' + g.e) ? L.mhatch(s, g.e, g.n, ctx, Math.random) : { ok: false, err: 'Walk to the egg' };
      case 'mbuy': return near('dshop') ? L.mbuy(s, g.id) : { ok: false, err: 'Walk to the Stardust Shop' };
      case 'meteor': return L.meteorCatch(s, g.slot, g.i, now, P.x, P.z);
      case 'dust': return L.dustPickup(s, g.i, now);
      case 'mobbyStart': mobbyStartLocal = now; return { ok: true, quiet: 1 };
      case 'mobbyEnd': { const r = L.mobbyEnd(s, now, mobbyStartLocal); mobbyStartLocal = 0; return r; }
      case 'fuse': return near('shiny') ? L.fuse(s, g.id) : { ok: false, err: 'Walk to the Shiny Machine' };
      case 'title': return L.setTitle(s, g.id);
    }
    return { ok: false };
  }
  function handleRes(a, r) {
    if (!r) return;
    if (!r.ok) { if (!r.quiet && r.err) { UI.toast(r.err, '#ff9a9a'); AU.play('error'); } if (a === 'obbyEnd') leaveObby(); if (a === 'mobbyEnd') App.mobbyRun = 0; return; }
    const s = App.s;
    switch (a) {
      case 'hatch': UI.hatchAnim(r.pets, s.area, () => UI.show('shop')); break;
      case 'unlock': if (!r.already) { UI.toast('🔓 Unlocked ' + C.AREAS[r.k].n + '!', '#7dff6a'); AU.play('unlock'); App.confetti(2); } break;
      case 'rebirth': UI.hide(); tp(W.SPAWN[0], W.SPAWN[1]); UI.toast('♻️ REBIRTH ' + r.rb + '! x' + L.rbMult({ rb: r.rb }).toFixed(1) + ' taps', '#e0a0ff'); AU.play('rebirth'); UI.flash('#e0a0ff', true); App.confetti(5); break;
      case 'buy': { const it = C.SHOP.find(i => i.id === r.id) || C.BOOSTS.find(i => i.id === r.id); UI.toast('✅ ' + it.n + (r.lvl ? ' level ' + r.lvl : ' activated') + '!', '#7df9ff'); AU.play('buy'); break; }
      case 'spin': wheelSpin = 2.5; setTimeout(() => { UI.toast('🎡 ' + (r.gems ? '+' + r.gems + ' 💎 GEMS!' : '+' + fmt(r.taps) + ' taps!') + (r.big ? ' JACKPOT!' : ''), '#ffd84a'); AU.play(r.big ? 'win' : 'coin'); if (r.big) App.confetti(3); }, 1500); break;
      case 'chest': UI.toast('💰 TREASURE! +' + fmt(r.taps) + ' taps +' + r.gems + ' 💎', '#ffd84a'); AU.play('win'); App.confetti(3); break;
      case 'gem': floatW('+' + r.gems + ' 💎', P.x, P.y + 3, P.z, '#7df9ff'); AU.play('gem'); burst3(W.GEMS[r.i][0], W.GEMS[r.i][2], W.GEMS[r.i][1], '#7df9ff', 14); break;
      case 'rock': UI.toast('⛏️ ROCK SMASHED! +' + fmt(r.taps) + ' taps', '#ffd84a'); AU.play('coin'); rockHp[r.i] = 5; break;
      case 'lava': floatW('+' + fmt(r.taps), P.x, P.y + 3, P.z, '#ff9a4d'); break;
      case 'obbyEnd': UI.toast('🏁 OBBY CLEARED in ' + fmtTime(r.secs) + (r.best ? ' 🏆 NEW BEST!' : '') + ' +' + fmt(r.taps) + ' taps' + (r.gems ? ' +' + r.gems + ' 💎' : '') + ' (' + falls + ' falls)', '#ffd84a'); AU.play('win'); App.confetti(4); leaveObby(); break;
      case 'claim': UI.toast('🎁 Quest complete! +' + r.gems + ' 💎' + (r.dust ? ' +' + r.dust + ' ✨' : '') + ' +' + fmt(r.taps) + ' taps', '#7dff6a'); AU.play('gem'); break;
      case 'rocket': if (!r.already) { UI.toast('🚀 ROCKET BOUGHT! Stand on the pad and press E to fly to Nebula Moon!', '#ffb070'); AU.play('rebirth'); App.confetti(5); } break;
      case 'launch': startLaunch(r.to); break;
      case 'mhatch': UI.hatchAnim(r.pets, 5 + r.egg, () => UI.show('megg')); break;
      case 'mbuy': { const it = C.MOON.SHOP.find(i => i.id === r.id); UI.toast('✅ ' + it.n + ' level ' + r.lvl + '!', '#ff9af0'); AU.play('buy'); break; }
      case 'meteor': floatW('+' + r.dust + ' ✨', P.x, P.y + 3, P.z, '#ff9af0'); AU.play('gem'); burst3(P.x, P.y + 1, P.z, '#ff9af0', 16); break;
      case 'dust': floatW('+' + r.dust + ' ✨', P.x, P.y + 3, P.z, '#ff9af0'); AU.play('coin'); burst3(W.DUST[r.i][0], W.DUST[r.i][2], W.DUST[r.i][1], '#ffb0ff', 10); break;
      case 'mobbyEnd': UI.toast('⭐ MOON OBBY CLEARED in ' + fmtTime(r.secs) + (r.best ? ' 🏆 NEW BEST!' : '') + ' +' + r.dust + ' ✨ (' + mfalls + ' falls)', '#ffd84a'); AU.play('win'); App.confetti(5); App.mobbyRun = 0; break;
      case 'fuse': { const p = L.pet(r.id); UI.toast('🌟 You made a ' + p.n + '! (2x power)', '#ffe680'); AU.play('reveal', 5); UI.flash('#ffe680'); App.confetti(4); break; }
      case 'title': UI.toast('🏷️ Title set: ' + L.titleName(r.title), '#ffe9a8'); break;
      case 'auto': UI.toast((r.k === 'tap' ? '⚙️ Auto Tap ' : '🥚 Auto Hatch ') + (r.on ? 'ON' : 'OFF'), r.on ? '#7dff6a' : '#ccc'); break;
    }
    UI.hud(); if (UI.cur && a !== 'hatch') UI.render();
  }
  function fmtTime(sec) { return Math.floor(sec / 60) + ':' + (sec % 60).toFixed(1).padStart(4, '0'); }
  App.fmtTime = fmtTime;
  function saveGuest() { if (App.mode === 'guest' && App.s) store.set('tl_guest_v2', App.s); }
  setInterval(saveGuest, 5000); addEventListener('beforeunload', saveGuest);
  function sendLook() { if (App.online && App.s) send({ t: 'look', look: App.s.look, title: App.s.title }); }
  App.setLook = function (look) {
    const s = App.s, v = L.validLook(look, s.mupg.helmet > 0); if (!v) return UI.toast('That hat is locked', '#ff9a9a');
    s.look = v; saveGuest(); if (App.online) send({ t: 'look', look: v, title: s.title }); UI.render();
  };
  App.setTitle = function (id) {
    if (App.mode === 'account') return App.act('title', { id });
    const r = L.setTitle(App.s, id); handleRes('title', r); if (r.ok) { saveGuest(); sendLook(); }
  };
  App.emote = function (id) { myEmote = { k: id, t0: T }; if (App.online) send({ t: 'em', e: id }); $('#emotes').classList.remove('on'); AU.play('click'); };
  App.mainMenu = () => { saveGuest(); location.reload(); };
  App.logout = () => { send({ t: 'logout', all: true }); store.set('tl_token', null); location.reload(); };
  App.resetGuest = () => { try { localStorage.removeItem('tl_guest_v2'); } catch (e) {} location.reload(); };
  App.setSetting = function (k, v) {
    SET[k] = v; store.set('tl_settings', SET);
    if (k === 'quality') { autoQ = v === 'auto'; extraScale = 1; E.setQuality(autoQ ? 'med' : v); UI.render(); }
    if (k === 'sfx' || k === 'music') AU.setVol(SET.sfx, SET.music);
    if (k === 'fps') $('#fps').style.display = v ? '' : 'none';
    if (k === 'shiftKey' && !v) setShiftLock(false);
  };

  // ---------- tapping ----------
  const floats = [], wfloats = [];
  function floatW(txt, x, y, z, c) { wfloats.push({ txt, x, y, z, t: 0, c }); }
  function burst3(x, y, z, col, n) { for (let i = 0; i < (n || 8); i++) E.particle({ x, y, z, vx: (Math.random() - 0.5) * 6, vy: Math.random() * 5 + 1, vz: (Math.random() - 0.5) * 6, life: 0.6, size: 0.25, g: 12, col, add: true }); }
  App.confetti = function (lvl) {
    const n = 30 + lvl * 25, cols = ['#ff3d9a', '#ffd84a', '#5ec8ff', '#7cf06a', '#c25cff', '#ffffff'];
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = 3 + Math.random() * 6;
      E.particle({ x: P.x, y: P.y + 2.5, z: P.z, vx: Math.cos(a) * sp, vy: 6 + Math.random() * 8, vz: Math.sin(a) * sp, life: 1.8 + Math.random(), size: 0.3, g: 12, drag: 1.2, col: cols[i % cols.length], fade: false }); }
  };
  let squash = 0, combo = 0;
  function tap(sx, sy) {
    if (!App.s || busy()) return;
    if (tapRate() >= C.MAX_TAPS_PER_SEC) { if (!tap.warnT || performance.now() - tap.warnT > 3000) { tap.warnT = performance.now(); UI.toast('Max ' + C.MAX_TAPS_PER_SEC + ' clicks per second!', '#ffcf8a'); } return; }
    tapLog.push(performance.now());
    const ctx = App.ctx(), v = L.tap(App.s, 1, ctx);
    if (App.online) unsent++;
    combo = L.combo(ctx.rate) / C.COMBO_MAX; squash = 1;
    floats.push({ x: sx, y: sy, t: 0, txt: '+' + fmt(v), c: ctx.frenzy ? '#ffae00' : ctx.vip && App.s.clicks >= C.GARDEN_CLICKS ? '#fff27a' : '#ffe14d' });
    burst3(P.x, P.y + 2.4, P.z, ctx.frenzy ? '#ffae00' : '#7fd8ff', SETparts() ? 6 : 2);
    AU.play('tap', combo);
    if (App.boss && L.nearBoss(P.x, P.z)) { App.bossMine++; const b = W.BOSS; WD.bossHit(b[0] + (Math.random() - 0.5) * 3, 5 + Math.random() * 3, b[2] + 2); if (Math.random() < 0.3) AU.play('hit'); }
    hitRock();
    if (App.s.clicks === C.GARDEN_CLICKS) { UI.toast('✨ GOLDEN GARDEN UNLOCKED! Head to the west gate.', '#ffd84a'); AU.play('unlock'); }
  }
  const SETparts = () => E.quality !== 'low';
  function hitRock() {
    if (isl() !== 2) return; let best = -1, bd = 3.6; const now = App.now();
    W.ROCKS.forEach((r, i) => { const d = Math.hypot(P.x - r[0], P.z - r[1]); if (d < bd && !((App.s.rockT[i] || 0) > now)) { bd = d; best = i; } });
    if (best < 0) return;
    rockHp[best]--; rockShake[best] = 0.15; AU.play('hit'); burst3(W.ROCKS[best][0], 1, W.ROCKS[best][1], '#d9b36a', 8);
    if (rockHp[best] <= 0) { rockHp[best] = 5; App.act('rock', { i: best }); }
  }
  setInterval(() => {
    if (!App.online || !unsent) return;
    const n = Math.min(unsent, 40); seq++; unsent -= n;
    if (App.mode === 'account') pend.push({ seq, n });
    send({ t: 'tap', n, seq });
  }, 150);

  // ---------- movement helpers ----------
  function tp(x, z, y) { P.x = x; P.z = z; P.y = y || 0; P.vy = 0; cam.x = x; cam.y = P.y; cam.z = z; myPets.forEach(o => { o.x = x; o.z = z; }); }
  App.travel = function (k) {
    if (inOb()) return UI.toast('Leave the obby first (press E)');
    if (!App.s.open.includes(k)) return;
    const c = W.CEN[k], b = W.BRG[k]; let x = c[0], z = c[1];
    if (b[0] === b[2]) z = c[1] + (c[1] < 0 ? 14 : -14); else x = c[0] - 14;
    tp(x, z); UI.hide(); AU.play('whoosh'); UI.toast('Welcome to ' + C.AREAS[k].n + '!', '#ffd84a');
  };
  App.travelHub = () => { if (inOb()) return UI.toast('Leave the obby first (press E)'); tp(W.SPAWN[0], W.SPAWN[1]); UI.hide(); AU.play('whoosh'); };
  function near() { for (const k in W.STN) if (L.near(P.x, P.z, k, 1.6)) return k; return null; }
  function use() {
    if (App.launch) return;
    if (inOb()) return leaveObby();
    if (App.mobbyRun) return leaveMoonObby();
    const n = near(); if (!n) return UI.toast('Stand on a glowing pad, then press E');
    if (n === 'rocket') return App.s.rocket ? App.act('launch') : UI.show('rocket');
    if (n === 'rhome') return App.act('launch');
    if (n === 'megg0' || n === 'megg1') { App.megg = +n.slice(4); return UI.show('megg'); }
    if (n === 'dshop') return UI.show('dshop');
    if (n === 'shiny') return UI.show('shiny');
    if (n === 'mobby') { if (!App.s.rocket) return UI.toast('Buy the rocket first', '#ff9a9a'); const q = W.MROCK[0]; tp(q.x, q.z, q.y + 0.05); mck = 0; mfalls = 0; App.mobbyCk = 0; App.mobbyFalls = 0; App.mobbyRun = performance.now(); App.act('mobbyStart'); AU.play('horn'); return UI.toast('🪨 MOON OBBY: 29 rocks to the top! Bounce rocks launch you, ⭐ star rings give a mid-air jump, red crystals send you back.', '#7ad7ff'); }
    if (n.startsWith('egg')) { App.act('area', { k: +n.slice(3) }); if (App.mode !== 'account') App.s.area = +n.slice(3); return UI.show('shop'); }
    if (n.startsWith('gate')) { const k = +n.slice(4); return App.s.open.includes(k) ? UI.toast('Open! Walk across the bridge to ' + C.AREAS[k].n, '#7dff6a') : App.act('unlock', { k }); }
    switch (n) {
      case 'map': return UI.show('map');
      case 'reb': return UI.show('rebirth');
      case 'wheel': return App.act('spin');
      case 'chest': return App.act('chest');
      case 'gems': return UI.show('gems');
      case 'quests': return UI.show('quests');
      case 'afk': return UI.toast(L.canAutoTap(App.s) ? 'Stand here to auto-tap!' : 'The Auto Tap Pad unlocks after your first rebirth', L.canAutoTap(App.s) ? '#2bff88' : '#ff9a9a');
      case 'obby': { const q = W.PL[0]; tp(q.x, q.z, q.y); ck = 0; ob = 0; falls = 0; App.obbyFalls = 0; App.obbyCk = 0; App.obbyRun = performance.now(); App.act('obbyStart'); AU.play('horn'); return UI.toast('🏁 OBBY: 50 platforms, checkpoint every 8. Dodge the red kill bricks and spinners!', '#ff9a4d'); }
    }
  }
  function leaveObby() { tp(W.STN.obby.x, W.STN.obby.z + 2.5); App.obbyRun = 0; P.kx = P.kz = 0; }
  function leaveMoonObby() { App.mobbyRun = 0; P.airJump = 0; tp(W.STN.mobby.x, W.STN.mobby.z + 2.5); }
  App.leaveMoonObby = leaveMoonObby;
  function mrespawn(msg) { const q = W.MROCK[mck]; tp(q.x, q.z, q.y + 0.05); P.airJump = 0; mstand = -1; mfalls++; App.mobbyFalls = mfalls; UI.toast(msg || 'You fell! Back to checkpoint', '#ff9a9a'); AU.play('error'); }
  function respawn(msg) { const q = W.PL[ck]; tp(q.x, q.z, q.y + 0.05); P.kx = P.kz = 0; stand = -1; falls++; App.obbyFalls = falls; UI.toast(msg || 'You fell! Back to checkpoint', '#ff9a9a'); AU.play('error'); }
  function jump() {
    if (P.fly) return;
    if (P.coy > 0) { P.vy = 9 * L.jumpMult(App.s, onMoon()); P.coy = 0; P.gr = false; AU.play('jump'); }
    else if (P.airJump > 0) { P.airJump--; P.vy = 9 * L.jumpMult(App.s, onMoon()); AU.play('bounce'); for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; E.particle({ x: P.x, y: P.y + 0.3, z: P.z, vx: Math.cos(a) * 4, vy: -1, vz: Math.sin(a) * 4, life: 0.5, size: 0.3, col: '#ffe680', add: true }); } }
  }
  // ---------- rocket launch ----------
  function startLaunch(to) {
    if (App.launch) return; UI.hide();
    App.launch = { to, from: to === 'moon' ? 'hub' : 'moon', t: 0, shown: -1 }; AU.play('horn');
  }
  function launchTick(dt) {
    const Lc = App.launch; if (!Lc) return; Lc.t += dt;
    const msgs = ['3', '2', '1', 'LIFT OFF!'], k = Math.min(3, Math.floor(Lc.t));
    if (k !== Lc.shown && Lc.t < 4) { Lc.shown = k; $('#launchT').textContent = msgs[k]; $('#launch').classList.add('on'); $('#launchT').style.animation = 'none'; void $('#launchT').offsetWidth; $('#launchT').style.animation = ''; AU.play(k < 3 ? 'click' : 'rebirth'); }
    if (Lc.t > 4.4 && !Lc.faded) { Lc.faded = 1; $('#fade').style.opacity = 1; }
    if (Lc.t > 5.2 && !Lc.moved) {
      Lc.moved = 1; $('#launch').classList.remove('on');
      if (Lc.to === 'moon') { tp(W.MOON_SPAWN[0], W.MOON_SPAWN[1]); cam.yaw = 0; UI.toast('🌙 Welcome to NEBULA MOON! Low gravity, meteors and Stardust!', '#e0b0ff'); }
      else if (App.s.open.includes(4)) { const H = W.HANGAR; tp(H.x, H.z - H.d / 2 - 3); cam.yaw = Math.PI; UI.toast('🚀 Back at the Space Station', '#bfe8ff'); }
      else { tp(W.SPAWN[0], W.SPAWN[1]); cam.yaw = 0; UI.toast('🚀 Landed in the lobby (unlock Space Station again to reach the hangar)', '#bfe8ff'); }
      $('#fade').style.opacity = 0;
    }
    if (Lc.t > 6) App.launch = null;
  }

  // ---------- input ----------
  const K = {}; let jx = 0, jy = 0, held = false, holdAcc = 0, mx = 0, my = 0, drag = null, shiftLock = false;
  const busy = () => !!UI.cur || !App.inGame || !!App.launch || $('#emotes').classList.contains('on') || $('#hatch').classList.contains('on') || document.activeElement === $('#cin');
  function setShiftLock(on) {
    if (on && !SET.shiftKey) return;
    if (on) { try { canvas.requestPointerLock(); } catch (e) {} } else if (document.pointerLockElement) document.exitPointerLock();
    shiftLock = on; $('#cross').style.display = on ? 'block' : 'none';
  }
  document.addEventListener('pointerlockchange', () => { const on = document.pointerLockElement === canvas; if (!on && shiftLock) { shiftLock = false; $('#cross').style.display = 'none'; } });
  addEventListener('keydown', e => {
    const tg = e.target;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT')) {
      if (tg.id === 'cin') { if (e.code === 'Enter') sendChat(); if (e.code === 'Escape') tg.blur(); }
      return;
    }
    if (!App.inGame) return;
    if (e.code === 'Enter' && !UI.cur) { e.preventDefault(); $('#cin').focus(); for (const k in K) K[k] = 0; if (shiftLock) setShiftLock(false); return; }
    if (e.code === 'KeyG' && !UI.cur && !App.launch) { $('#emotes').classList.toggle('on'); return; }
    if (e.code === 'Escape') { $('#emotes').classList.remove('on'); UI.hide(); if ($('#hatch').classList.contains('on')) $('#hok') && $('#hok').click(); }
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && !busy()) { setShiftLock(!shiftLock); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !UI.cur) e.preventDefault();
    K[e.code] = 1;
    if (busy()) return;
    if (e.code === 'KeyE') use(); if (e.code === 'Space') jump();
    if (e.code === 'KeyF') { const p = E.project(P.x, P.y + 2.6, P.z); tap(p ? p[0] : innerWidth / 2, p ? p[1] : innerHeight / 2); }
    if (e.code === 'KeyM') App.setSetting('sfx', SET.sfx > 0 ? 0 : 0.7);
  }, true);
  addEventListener('keyup', e => { K[e.code] = 0; }, true);
  addEventListener('blur', () => { for (const k in K) K[k] = 0; held = false; });
  function sendChat() {
    const i = $('#cin'), m = i.value.trim().slice(0, 120); i.value = ''; i.blur(); canvas.focus(); if (!m) return;
    if (App.online) send({ t: 'c', m }); else { UI.addChat(App.myName, m); bubble = { m, t: T }; }
  }
  canvas.addEventListener('pointerdown', e => {
    AU.unlock(); canvas.focus(); if (busy()) return;
    if (shiftLock) { if (e.button === 0) { tap(innerWidth / 2, innerHeight / 2); held = true; mx = innerWidth / 2; my = innerHeight / 2; } return; }
    if (e.pointerType === 'mouse') { if (e.button === 0) { tap(e.clientX, e.clientY); held = true; mx = e.clientX; my = e.clientY; } else drag = { x: e.clientX, y: e.clientY }; }
    else drag = { x: e.clientX, y: e.clientY, t: performance.now(), sx: e.clientX, sy: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
  });
  canvas.addEventListener('pointermove', e => {
    if (shiftLock) { cam.yaw -= e.movementX * 0.0035 * SET.sens; cam.pitch = clamp(cam.pitch + e.movementY * 0.003 * SET.sens, -0.2, 1.25); return; }
    mx = e.clientX; my = e.clientY; if (!drag) return;
    cam.yaw -= (e.clientX - drag.x) * 0.006 * SET.sens; cam.pitch = clamp(cam.pitch + (e.clientY - drag.y) * 0.005 * SET.sens, 0.05, 1.25); drag.x = e.clientX; drag.y = e.clientY;
  });
  canvas.addEventListener('pointerup', e => { held = false; if (drag && drag.t && performance.now() - drag.t < 250 && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 10) tap(e.clientX, e.clientY); drag = null; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { cam.dist = clamp(cam.dist + e.deltaY * 0.01, 5, 24); e.preventDefault(); }, { passive: false });
  $('#bj').onpointerdown = e => { e.preventDefault(); if (!busy()) jump(); };
  $('#bu').onpointerdown = e => { e.preventDefault(); if (!busy()) use(); };
  const joy = $('#joy'), knob = $('#knob');
  function jm(e) { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - 62) / 62, y = (e.clientY - r.top - 62) / 62; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } jx = x; jy = y; knob.style.left = 39 + x * 40 + 'px'; knob.style.top = 39 + y * 40 + 'px'; }
  joy.onpointerdown = e => { joy.setPointerCapture(e.pointerId); jm(e); }; joy.onpointermove = e => { if (e.buttons || e.pointerType === 'touch') jm(e); };
  joy.onpointerup = joy.onpointercancel = () => { jx = jy = 0; knob.style.left = knob.style.top = '39px'; };
  function resizeOv() { const d = Math.min(devicePixelRatio || 1, 2); ov.width = innerWidth * d; ov.height = innerHeight * d; og.setTransform(d, 0, 0, d, 0, 0); }
  addEventListener('resize', resizeOv); resizeOv();
  C.EMOTES.forEach((em, i) => { const a = i / C.EMOTES.length * 6.283 - Math.PI / 2, b = document.createElement('button');
    b.className = ['p', 'c', 'o', 'g'][i % 4]; b.innerHTML = '<span>' + em.ico + '</span>' + em.n;
    b.style.left = (150 + Math.cos(a) * 105 - 48) + 'px'; b.style.top = (150 + Math.sin(a) * 105 - 48) + 'px'; b.onclick = () => App.emote(em.id); $('#emring').appendChild(b); });
  $('#emotes').addEventListener('click', e => { if (e.target.id === 'emotes') $('#emotes').classList.remove('on'); });
  $('#obLobby').onclick = () => { if (App.mobbyRun) leaveMoonObby(); else leaveObby(); canvas.focus(); };
  $('#obMenu').onclick = () => App.mainMenu();
  App.inOb = inOb;

  // ---------- enter game ----------
  function enterGame() {
    App.inGame = true; $('#start').classList.add('hidden'); $('#hud').classList.remove('hidden');
    tp(W.SPAWN[0], W.SPAWN[1]); P.yaw = Math.PI; cam.yaw = 0; cam.pitch = 0.42; cam.dist = 12;
    canvas.focus(); AU.unlock(); AU.play('unlock'); AU.startMusic();
    UI.hud(); UI.sys('Welcome to Tapping Legends, ' + App.myName + '! Hold click to tap.', '#ffd84a');
    if (!App.s.hatched) setTimeout(() => UI.toast('Tap to earn ' + fmt(C.AREAS[0].ec) + ' taps, then cross the bridge to hatch your first pet!', '#fff'), 1500);
    $('#fps').style.display = SET.fps ? '' : 'none';
  }
  // start screen fields
  $('#gName').value = store.get('tl_gname', '');
  if (token && savedName) { const b = $('#resumebtn'); b.classList.remove('hidden'); b.textContent = '▶ Continue as ' + savedName; b.onclick = () => App.auth({ t: 'resume', token }); }
  connect();

  // ---------- update ----------
  let T = 0, bubble = null, lavaT = 0, gT = 0, guestAcc = {}, dailyT = 0, netT = 0, stand = -1, lastIsl = -2, rateT = 0;
  const myPets = [];
  function update(dt) {
    const s = App.s, now = App.now();
    if (!App.inGame || !s) { cam.yaw += dt * 0.06; return; }
    if (App.mode === 'guest') {
      s.time += dt;
      const out = L.autoTick(s, dt, Object.assign(App.ctx(), { onPad: L.near(P.x, P.z, 'afk', 1.8) }), guestAcc, Math.random);
      if (out.pets.length) autoHatched(out.pets);
      dailyT += dt; if (dailyT > 60) { dailyT = 0; const d = L.daily(s, now); if (d) dailyToast(d); }
    }
    launchTick(dt);
    if (myEmote && T - myEmote.t0 > 3.2) myEmote = null;
    // hold to tap
    if (held && !busy()) { holdAcc += dt; while (holdAcc > 1 / C.HOLD_RATE) { holdAcc -= 1 / C.HOLD_RATE; tap(mx, my); } } else holdAcc = 0;
    // camera keys
    if (K.KeyQ) cam.yaw += dt * 1.8; if (K.KeyR) cam.yaw -= dt * 1.8;
    // movement
    let dx = (K.KeyD || K.ArrowRight ? 1 : 0) - (K.KeyA || K.ArrowLeft ? 1 : 0) + jx, dz = (K.KeyS || K.ArrowDown ? 1 : 0) - (K.KeyW || K.ArrowUp ? 1 : 0) + jy;
    if (busy()) dx = dz = 0;
    const l = Math.hypot(dx, dz); if (l > 1) { dx /= l; dz /= l; } P.mv = l > 0.1;
    const sy = Math.sin(cam.yaw), cy = Math.cos(cam.yaw), mvx = dx * cy + dz * sy, mvz = -dx * sy + dz * cy, spd = 6 * L.speed(s, now);
    W.PL.forEach(q => {
      if (q.k === 1) { const nz = q.bz + q.amp * Math.sin(T * q.spd + q.ph); q.dz = nz - q.z; q.z = nz; }
      if (q.k === 3) { const ny = q.by + q.amp * Math.sin(T * q.spd * 0.8 + q.ph); q.dy = ny - q.y; q.y = ny; }
      if (q.gone > 0) { q.gone -= dt; if (q.gone <= 0) { q.gone = 0; q.t = 0; } }
    });
    W.KILL.forEach(b => { if (b.slide) b.z = W.PL[b.p].z + b.slide * Math.sin(T * b.spd + b.ph); else b.z = W.PL[b.p].z + (b.z0 === undefined ? (b.z0 = b.z - W.PL[b.p].z) : b.z0); b.y = W.PL[b.p].y + (b.y0 === undefined ? (b.y0 = b.y - W.PL[b.p].y) : b.y0); });
    if (stand >= 0 && !W.PL[stand].gone) { P.z += W.PL[stand].dz || 0; P.y += W.PL[stand].dy || 0; }
    if (onMoon()) {
      W.MROCK.forEach(q => {
        if (q.k === 1) { const o = q.amp * Math.sin(T * q.spd + q.ph), nx2 = q.bx - Math.sin(q.ang) * o, nz2 = q.bz + Math.cos(q.ang) * o; q.dx = nx2 - q.x; q.dz = nz2 - q.z; q.x = nx2; q.z = nz2; }
        if (q.gone > 0) { q.gone -= dt; if (q.gone <= 0) { q.gone = 0; q.t = 0; } }
      });
      W.MKILL.forEach(b => { if (b.slide) { const o = b.slide * Math.sin(T * b.spd + b.ph), r = W.MROCK[b.p]; b.x = r.x - Math.sin(b.ang) * o; b.z = r.z + Math.cos(b.ang) * o; } });
      if (mstand >= 0 && !W.MROCK[mstand].gone) { P.x += W.MROCK[mstand].dx || 0; P.z += W.MROCK[mstand].dz || 0; }
    }
    const nx = P.x + mvx * spd * dt, nz = P.z + mvz * spd * dt;
    if (P.fly) { // jetpack flight: scripted arc to a floating platform
      const f = P.fly; f.t += dt; const k = Math.min(1, f.t / f.dur);
      P.x = f.x0 + (f.x1 - f.x0) * k; P.z = f.z0 + (f.z1 - f.z0) * k; P.y = f.y0 + (f.y1 - f.y0) * k + Math.sin(k * Math.PI) * f.h; P.vy = 0;
      P.yaw = Math.atan2(f.x1 - f.x0, f.z1 - f.z0);
      if (Math.random() < 0.8) E.particle({ x: P.x, y: P.y + 0.6, z: P.z, vx: (Math.random() - 0.5), vy: -4, vz: (Math.random() - 0.5), life: 0.5, size: 0.4, col: ['#7ad7ff', '#ffffff', '#ffb000'][Math.random() * 3 | 0], add: true });
      if (k >= 1) { P.fly = null; P.gr = true; }
    }
    if (P.kx || P.kz) { P.x += P.kx * dt; P.z += P.kz * dt; const kd = Math.max(0, 1 - dt * (P.gr ? 6 : 1.2)); P.kx *= kd; P.kz *= kd; if (Math.abs(P.kx) + Math.abs(P.kz) < 0.05) P.kx = P.kz = 0; }
    if (!P.fly) { if (inOb() || walkOK(nx, nz)) { P.x = nx; P.z = nz; } else if (walkOK(nx, P.z)) P.x = nx; else if (walkOK(P.x, nz)) P.z = nz; }
    if (!inOb() && !P.fly) { const c2 = L.collide(WD.colGrid, P.x, P.z, P.y, 0.45); if (walkOK(c2[0], c2[1])) { P.x = c2[0]; P.z = c2[1]; } }
    if (shiftLock) P.yaw = cam.yaw + Math.PI;
    else if (P.mv) { const a = Math.atan2(mvx, mvz); let df = a - P.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); P.yaw += df * Math.min(1, dt * 14); }
    const oy = P.y, gy = inOb() ? -999 : groundY(P.x, P.z), moon = onMoon();
    if (!P.fly) { P.vy -= 24 * dt * (moon ? C.MOON.GRAVITY : isl() === 4 ? 0.38 : 1); P.y += P.vy * dt; P.gr = false; }
    let on = -1, mon = -1;
    const PLAT = inOb() ? W.PL : moon ? MOONPL : null;
    if (PLAT && !P.fly) for (let i = 0; i < PLAT.length; i++) { const q = PLAT[i]; if (q.gone) continue; const hh = q.s / 2 + 0.22; if (Math.abs(P.x - q.x) < hh && Math.abs(P.z - q.z) < hh && oy >= q.y - 0.25 && P.y <= q.y && P.vy <= 0) { P.y = q.y; P.vy = 0; P.gr = true; if (inOb()) on = i; else mon = i; break; } }
    if (on < 0 && mon < 0 && !inOb() && !P.fly && P.y <= gy) { P.y = gy; P.vy = 0; P.gr = true; }
    stand = on; mstand = mon >= MR0 ? mon - MR0 : -1;
    // ---- animation state: walk cycle from real speed, landing squash + dust
    { const hs = Math.hypot(P.x - P.ox, P.z - P.oz) / Math.max(dt, 1e-3); P.ox = P.x; P.oz = P.z;
      P.spd += (Math.min(hs, 14) - P.spd) * Math.min(1, dt * 10); if (P.gr) P.ph += P.spd * dt * 1.55;
      P.airT = P.gr ? 0 : P.airT + dt;
      if (P.gr && !P.wasGr && oy - P.y >= 0 && update.lastVy < -5) { P.land = Math.min(1, -update.lastVy / 16); if (update.lastVy < -9) { AU.play('bounce'); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; E.particle({ x: P.x + Math.cos(a) * 0.4, y: P.y + 0.1, z: P.z + Math.sin(a) * 0.4, vx: Math.cos(a) * 3, vy: 0.8, vz: Math.sin(a) * 3, life: 0.5, size: 0.45, drag: 3, col: onMoon() ? '#d8d0f0' : '#e8dcc0', a: 0.7 }); } } }
      P.land = Math.max(0, P.land - dt * 5); P.wasGr = P.gr; update.lastVy = P.vy; } P.coy = P.gr ? 0.09 : Math.max(0, P.coy - dt);
    if (moon && !P.fly) {
      if (P.gr && P.y < 0.3) {
        W.JETS.forEach(j => { if (Math.hypot(P.x - j.x, P.z - j.z) < 1.3) { const q = W.MPL[j.to]; P.fly = { x0: P.x, z0: P.z, y0: P.y, x1: q.x, z1: q.z, y1: q.y, h: 6, t: 0, dur: 1.8 }; AU.play('bounce'); } });
        W.BOUNCE.forEach(j => { if (Math.hypot(P.x - j.x, P.z - j.z) < 1.3) { P.vy = j.v; P.gr = false; P.coy = 0; AU.play('bounce'); } });
        if (App.mobbyRun && performance.now() - App.mobbyRun > 1500) mrespawn();
      }
      if (P.gr) P.airJump = 0;
      if (App.mobbyRun) {
        const rk = mstand >= 0 ? W.MROCK[mstand] : null;
        if (rk) {
          if (rk.k === 2) { rk.t += dt; if (rk.t > 0.8) rk.gone = 3.5; }
          if (rk.k === 3) { P.vy = W.MOBBY_BOUNCE; P.gr = false; P.coy = 0; mstand = -1; AU.play('bounce'); for (let i = 0; i < 12; i++) E.particle({ x: P.x, y: P.y, z: P.z, vx: (Math.random() - 0.5) * 5, vy: 2, vz: (Math.random() - 0.5) * 5, life: 0.6, size: 0.3, col: '#ff7ab8', add: true }); }
          if (rk.cp && rk.i > mck) { mck = rk.i; App.mobbyCk = rk.i / 7; UI.toast('✅ Moon checkpoint ' + (rk.i / 7) + ' / 4!', '#7dff6a'); AU.play('coin'); }
        }
        // star rings: fly through one for a mid-air jump
        for (const g of W.MRING) if (Math.hypot(P.x - g.x, P.z - g.z) < 1.9 && Math.abs(P.y + 1 - g.y) < 1.9 && !(P.airJump > 0) && !g.hit) { P.airJump = 1; g.hit = 1; setTimeout(() => g.hit = 0, 1500); AU.play('gem'); UI.toast('⭐ Mid-air jump ready! Press Space', '#ffe680'); }
        // red crystals + spinning bars send you back
        for (const b of W.MKILL) if (Math.abs(P.x - b.x) < b.w / 2 + 0.28 && Math.abs(P.z - b.z) < b.d / 2 + 0.28 && P.y < b.y + b.h / 2 && P.y + 2.3 > b.y - b.h / 2) { mrespawn('💥 Crystal spike! Back to checkpoint'); break; }
        for (const q of W.MROCK) if (q.bar && Math.hypot(P.x - q.x, P.z - q.z) < q.s / 2 + 0.4 && P.y < q.y + q.bar.h + 0.3 && P.y > q.y - 0.5) {
          const an = T * q.bar.spd + q.ph, dx = P.x - q.x, dz = P.z - q.z, along = dx * Math.cos(an) + dz * Math.sin(an), perp = -dx * Math.sin(an) + dz * Math.cos(an);
          if (Math.abs(along) < q.bar.r + 0.2 && Math.abs(perp) < 0.42) { mrespawn('💥 Hit a spinner! Back to checkpoint'); break; }
        }
        if (P.y < W.MROCK[mck].y - 14) mrespawn();
        if (mstand === W.MROCK.length - 1 && !update.mdone) { update.mdone = true; App.act('mobbyEnd'); setTimeout(() => update.mdone = false, 1500); }
      }
      // meteors: stand in the ring when it lands
      const mi = L.meteorInfo(now);
      if (!mi.active && mi.next - now < 20000 && update.warned !== mi.slot + 1) { update.warned = mi.slot + 1; UI.toast('☄️ Meteor shower in 20 seconds! Get ready to catch them!', '#ffb070'); AU.play('horn'); }
      if (mi.active && s.rocket) for (const m of L.meteors(mi.slot)) {
        const key = mi.slot + ':' + m.i;
        if (meteorPending[key] || (s.meteorC.slot === mi.slot && s.meteorC.ids.includes(m.i))) continue;
        if (now > m.land - 2500 && now < m.land + 500 && Math.hypot(P.x - m.x, P.z - m.z) < L.catchR(s) && P.y < 6) { meteorPending[key] = 1; App.act('meteor', { slot: mi.slot, i: m.i }); }
      }
      W.DUST.forEach((g, i) => { if ((s.dustT[i] || 0) > now || (dustPending[i] || 0) > now || !s.rocket) return;
        if (Math.hypot(P.x - g[0], P.z - g[1]) < 1.6 && Math.abs(P.y + 1 - g[2]) < 1.8) { dustPending[i] = now + 2500; App.act('dust', { i }); } });
    }
    if (P.gr && !inOb() && !moon) W.JP.forEach(j => { if (Math.hypot(P.x - j[0], P.z - j[1]) < 1.3) { P.vy = j[2]; P.gr = false; P.coy = 0; AU.play('bounce'); } });
    if (on >= 0) { const q = W.PL[on]; if (q.k === 2) { q.t = (q.t || 0) + dt; if (q.t > 0.65) q.gone = 3.5; } if (q.cp && on > ck) { ck = on; App.obbyCk = on / 8; UI.toast('✅ Checkpoint ' + (on / 8) + ' / 5 saved!', '#7dff6a'); AU.play('coin'); } ob = Math.max(ob, on); if (on === W.PL.length - 1 && !update.done) { update.done = true; App.act('obbyEnd'); setTimeout(() => update.done = false, 1500); } }
    if (inOb()) {
      // spinner bars and kill bricks send you back to your checkpoint
      for (const q of W.PL) if (q.bar && Math.abs(P.x - q.x) < q.s / 2 + 0.4 && Math.abs(P.z - q.z) < q.s / 2 + 0.4 && P.y < q.y + q.bar.h + 0.3 && P.y > q.y - 0.5) {
        const a = T * q.bar.spd + q.ph, dx = P.x - q.x, dz = P.z - q.z, along = dx * Math.cos(a) + dz * Math.sin(a), perp = -dx * Math.sin(a) + dz * Math.cos(a);
        if (Math.abs(along) < q.bar.r + 0.2 && Math.abs(perp) < 0.42) { respawn('💥 Hit a spinner! Back to checkpoint'); break; }
      }
      for (const b of W.KILL) if (Math.abs(P.x - b.x) < b.w / 2 + 0.28 && Math.abs(P.z - b.z) < b.d / 2 + 0.28 && P.y < b.y + b.h / 2 && P.y + 2.3 > b.y - b.h / 2) { respawn('💥 Kill brick! Back to checkpoint'); break; }
      if (P.y < W.OBBY_MINY - 9) respawn();
    }
    if (!inOb() && !P.fly && !walkOK(P.x, P.z)) tp(W.SPAWN[0], W.SPAWN[1]);
    const ci = isl(), zone = moon ? 9 : ci; if (zone !== lastIsl) { if (ci >= 0) UI.toast('Welcome to ' + C.AREAS[ci].n + '!', '#ffd84a'); lastIsl = zone; }
    // lava zone
    if (ci === 3 && L.inLava(P.x, P.z)) {
      lavaT += dt; if (lavaT >= 1.05) { lavaT = 0; App.act('lava'); }
      gT += dt; if (gT > 0.7) { gT = 0; const LV = W.LAVA; geysers.push({ x: clamp(P.x + (Math.random() - 0.5) * 7, LV.x1 + 1, LV.x2 - 1), z: clamp(P.z + (Math.random() - 0.5) * 7, LV.z1 + 1, LV.z2 - 1), t: 0 }); }
    } else lavaT = 0;
    for (let i = geysers.length - 1; i >= 0; i--) { const q = geysers[i]; q.t += dt; if (q.t > 1.9) { geysers.splice(i, 1); continue; }
      if (q.t > 1.2 && q.t < 1.8 && P.y < 0.8 && ci === 3 && Math.hypot(P.x - q.x, P.z - q.z) < 1.7) { tp(W.CEN[3][0] - 2, W.CEN[3][1]); P.vy = 12; UI.toast('Burned by lava! Back to safety', '#ff9a9a'); AU.play('error'); geysers.length = 0; lavaT = 0; break; } }
    // gems
    const mag = L.magnet(s);
    if (!inOb()) W.GEMS.forEach((g, i) => { if ((s.gemT[i] || 0) > now || (gemPending[i] || 0) > now) return;
      if (Math.hypot(P.x - g[0], P.z - g[1]) < mag && Math.abs(P.y + 1 - g[2]) < 1.8) { gemPending[i] = now + 2500; App.act('gem', { i }); } });
    if (!fetch && !inOb() && myPets[0]) {
      let bi = -1, bd = C.PET_FETCH_RANGE;
      W.GEMS.forEach((g, i) => { if ((s.gemT[i] || 0) > now || (gemPending[i] || 0) > now) return; const d = Math.hypot(P.x - g[0], P.z - g[1]); if (d < bd && d > mag && Math.abs(P.y + 1 - g[2]) < 3) { bd = d; bi = i; } });
      if (bi >= 0) { fetch = { i: bi, t: 0 }; gemPending[bi] = now + 4000; }
    }
    if (fetch) { fetch.t += dt; const g = W.GEMS[fetch.i], o = myPets[0];
      if (o) { const k = Math.min(1, dt * 6); o.x += (g[0] - o.x) * k; o.z += (g[1] - o.z) * k; o.y += (g[2] - 1 - o.y) * k;
        if (Math.hypot(o.x - g[0], o.z - g[1]) < 0.6 || fetch.t > 1.5) { gemPending[fetch.i] = 0; App.act('gem', { i: fetch.i }); gemPending[fetch.i] = now + 2500; fetch = null; } } else fetch = null; }
    rockShake.forEach((v, i) => rockShake[i] = Math.max(0, v - dt));
    // camera follow
    const k = Math.min(1, dt * 8); cam.x += (P.x - cam.x) * k; cam.y += (P.y - cam.y) * Math.min(1, dt * (P.fly || Math.abs(P.y - cam.y) > 3 ? 10 : 5)); cam.z += (P.z - cam.z) * k;
    combo = Math.max(0, combo - dt * 0.8); squash = Math.max(0, squash - dt * 4); wheelSpin = Math.max(0, wheelSpin - dt);
    // pets follow
    const eq = L.equipped(s); myPets.length = Math.min(myPets.length, eq.length);
    eq.forEach((q, i) => { const a = P.yaw + Math.PI + (i - (eq.length - 1) / 2) * 0.62, r = 2 + (i % 2) * 0.7, tx = P.x + Math.sin(a) * r, tz = P.z + Math.cos(a) * r;
      const o = myPets[i] || (myPets[i] = { x: tx, z: tz, y: P.y }); o.p = q; if (i === 0 && fetch) return; o.x += (tx - o.x) * Math.min(1, dt * 5); o.z += (tz - o.z) * Math.min(1, dt * 5); o.y += (P.y - o.y) * Math.min(1, dt * 6); o.p = q; });
    // others
    App.others.forEach(o => { const kk = Math.min(1, dt * 10), px = o.x, py = o.y, pz = o.z; o.x += (o.tx - o.x) * kk; o.y += (o.ty - o.y) * kk; o.z += (o.tz - o.z) * kk;
      const hs = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-3), vv = (o.y - py) / Math.max(dt, 1e-3); o.spd = (o.spd || 0) + (Math.min(hs, 14) - (o.spd || 0)) * Math.min(1, dt * 8); o.vy = (o.vy || 0) + (vv - (o.vy || 0)) * Math.min(1, dt * 8);
      o.air = Math.abs(o.vy) > 1.2; if (!o.air) o.ph = (o.ph || 0) + o.spd * dt * 1.55;
      let df = o.tyaw - o.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); o.yaw += df * kk;
      (o.e || []).forEach((id, i) => { const a = o.yaw + Math.PI + (i - 1) * 0.7, tx = o.x + Math.sin(a) * 2, tz = o.z + Math.cos(a) * 2; const q = o.pets[i] || (o.pets[i] = { x: tx, z: tz }); q.x += (tx - q.x) * kk * 0.5; q.z += (tz - q.z) * kk * 0.5; q.id = id; });
      o.pets.length = (o.e || []).length; });
    // network position
    netT += dt; if (App.online && netT > 0.1) { netT = 0; send({ t: 'p', x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), w: +P.yaw.toFixed(2), m: P.mv ? 1 : 0, r: s.rb, e: App.mode === 'guest' ? eq.slice(0, 3).map(p => p.id) : undefined }); }
  }

  // ---------- render ----------
  const THEME = C.AREAS.map(a => ({ top: E.M.hex(a.sky[0]), hor: E.M.hex(a.sky[1]), g: E.M.hex(a.g) }));
  const MOON_THEME = { top: E.M.hex('#12042a'), hor: E.M.hex('#5a2a86'), g: E.M.hex('#a8a0c8') };
  // the lobby gets its own softer light (a slightly deeper sky and a gentler sun)
  const LOBBY_THEME = { top: E.M.hex('#3f8fd4'), hor: E.M.hex('#a9c9e4'), g: E.M.hex('#5aa63f') };
  let fpsAcc = 0, fpsN = 0, fpsShow = 60, qT = 0, qBad = 0, bossLook = 0;
  function render(t, dt) {
    const moon = App.inGame && onMoon(), s = App.s || L.fresh('x'), th = Math.max(0, App.inGame ? isl() : -1), lobby = !moon && (!App.inGame || (isl() < 0 && !inOb())), tm = moon ? MOON_THEME : lobby ? LOBBY_THEME : THEME[th], space = th === 4 || moon, magma = th === 3 && !moon;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    let tx = cam.x, ty = cam.y + 1.9, tz = cam.z, dist = cam.dist;
    if (!App.inGame) { tx = 0; ty = 2; tz = 0; dist = 50; }
    bossLook += ((App.boss && L.nearBoss(P.x, P.z) ? 2.6 : 0) - bossLook) * Math.min(1, dt * 2); ty += bossLook;
    if (shiftLock) { tx += Math.cos(cam.yaw) * 1.4; tz -= Math.sin(cam.yaw) * 1.4; ty += 0.3; }
    let cyaw = cam.yaw, ccp = cp, csp = sp;
    if (UI.cur === 'avatar') { // live preview: camera swings round to the front of your character
      cyaw = P.yaw + Math.sin(t * 0.6) * 0.5; dist = 5.2; ccp = Math.cos(0.12); csp = Math.sin(0.12); ty = P.y + 1.7;
      tx = P.x + Math.cos(cyaw) * 1.3; tz = P.z - Math.sin(cyaw) * 1.3;
    }
    if (App.launch) { // follow the rocket up
      const Lc = App.launch, rp = Lc.from === 'hub' ? W.ROCKET : [W.STN.rhome.x + 5, W.STN.rhome.z], ry = Lc.t > 2 ? (Lc.t - 2) * (Lc.t - 2) * 5 : 0;
      tx = rp[0]; tz = rp[1]; ty = 4 + ry * 0.8; dist = 20; ccp = Math.cos(0.25); csp = Math.sin(0.25);
      if (Lc.t > 1 && Lc.t < 4.5) { tx += (Math.random() - 0.5) * 0.3; ty += (Math.random() - 0.5) * 0.3; }
    }
    const eye = [tx + Math.sin(cyaw) * ccp * dist, Math.max(ty + csp * dist, -8), tz + Math.cos(cyaw) * ccp * dist];
    const sun = (() => { const v = magma ? [0.3, 0.7, 0.5] : space ? [-0.4, 0.75, 0.3] : [0.42, 0.78, 0.36]; const l = Math.hypot(...v); return v.map(x => x / l); })();
    const env = {
      eye, target: [tx, ty, tz], fov: 1.05, sun, dt, time: t, focus: [P.x, P.y, P.z],
      sunCol: magma ? [1.1, 0.75, 0.55] : space ? [0.85, 0.9, 1.2] : lobby ? [0.94, 0.86, 0.76] : [1.12, 1.02, 0.88],
      skyCol: E.M.lerp(tm.top, [1, 1, 1], lobby ? 0.22 : 0.35), gndCol: E.M.lerp(tm.g, [0.2, 0.2, 0.25], 0.55),
      fog: tm.hor, skyTop: tm.top, skyHor: tm.hor, stars: space
    };
    // dynamic world
    const labels = [];
    const V = { s, P, cam: eye, dt, now: App.now(), near: App.inGame ? near() : null, labels, board: App.board && App.board.week && App.board.week.length ? App.board.week : (App.board ? App.board.all : null),
      boss: App.boss, parts: E.quality !== 'low', wheelSpin, gemPending, rockHp, rockShake, geysers, cloudCol: space ? '#8a8ab8' : magma ? '#ffb8a0' : '#ffffff',
      questDone: s.q.list.map(q => q.claimed), obbyCk: App.obbyCk || 0, mobbyCk: App.mobbyCk || 0, launch: App.launch, dustPending, meteorPending };
    WD.draw(V, t);
    // me
    if (App.inGame) {
      const hideMe = App.launch && App.launch.t > 0.8;
      if (!hideMe) WD.char(P.x, P.y, P.z, P.yaw, t, P.spd > 0.6 && P.gr && !P.fly, squash, s.look, { emote: myEmote ? { k: myEmote.k, t: T - myEmote.t0 } : null, phase: P.ph, speed: P.spd, air: (!P.gr && P.airT > 0.06) || !!P.fly, vy: P.fly ? 6 : P.vy, land: P.land });
      if (SET.names && !hideMe) { labels.push({ t: App.myName + (s.rb ? '  ♻️' + s.rb : ''), x: P.x, y: P.y + 3.35, z: P.z, sz: 13, bg: '#0009', ns: 1 });
        if (s.title && s.title !== 'rookie') labels.push({ t: '« ' + L.titleName(s.title) + ' »', x: P.x, y: P.y + 3.02, z: P.z, sz: 10, c: '#ffe9a8' }); }
      if (bubble && T - bubble.t < 6) labels.push({ t: bubble.m.length > 40 ? bubble.m.slice(0, 40) + '…' : bubble.m, x: P.x, y: P.y + 4, z: P.z, sz: 13, bg: '#fff', c: '#111', ns: 1 });
      // blob shadow when shadows are off
      if (E.quality === 'low' && !inOb()) { const hgt = Math.max(0, P.y - groundY(P.x, P.z)), k2 = Math.max(0.3, 1 - hgt / 12); E.draw(WD.ms.disc, E.M.trs(P.x, groundY(P.x, P.z) + 0.04, P.z, 0, 0, 0, 1.3 * k2, 1, 1.3 * k2), '#000000', { alpha: 0.28 * k2, mode: 3, noShadow: true }); }
      if (!hideMe) myPets.forEach((o, i) => { if (o.p) { WD.pet(o.p, o.x, o.y + 0.25 + Math.sin(t * 3 + i * 1.3) * 0.12, o.z, Math.atan2(P.x - o.x, P.z - o.z), t, V, i); labels.push({ t: o.p.e, x: o.x, y: o.y + 1.6, z: o.z, sz: 16, ns: 1 }); } });
      const nr = V.near; if (nr && !busy()) labels.push({ t: (touch ? 'USE' : 'E') + ' · ' + W.STN[nr].l, x: P.x, y: P.y + 3.9, z: P.z, sz: 15, c: '#ffe9a8' });

    }
    App.others.forEach(o => {
      const d2 = (o.x - eye[0]) ** 2 + (o.z - eye[2]) ** 2; if (d2 > (E.far + 10) ** 2) return;
      if (o.emote && T - o.emote.t0 > 3.2) o.emote = null;
      WD.char(o.x, o.y, o.z, o.yaw, t + o.id, (o.spd || 0) > 0.6 && !o.air, 0, L.validLook(o.lk, true) || WD.charCols(o.n, o.r), { emote: o.emote ? { k: o.emote.k, t: T - o.emote.t0 } : null, phase: o.ph || 0, speed: o.spd || 0, air: o.air, vy: o.vy || 0 });
      if (SET.names) { labels.push({ t: o.n + (o.g ? ' (guest)' : '') + (o.r ? '  ♻️' + o.r : ''), x: o.x, y: o.y + 3.35, z: o.z, sz: 12, bg: '#0008', ns: 1 });
        if (o.ti && o.ti !== 'rookie') labels.push({ t: '« ' + L.titleName(o.ti) + ' »', x: o.x, y: o.y + 3.02, z: o.z, sz: 10, c: '#ffe9a8' }); }
      if (o.bub && T - o.bt < 6) labels.push({ t: o.bub.length > 40 ? o.bub.slice(0, 40) + '…' : o.bub, x: o.x, y: o.y + 4, z: o.z, sz: 12, bg: '#fff', c: '#111', ns: 1 });
      if (d2 < 900) o.pets.forEach((q, i) => { const p = L.pet(q.id); if (p) WD.pet(p, q.x, o.y + 0.3, q.z, Math.atan2(o.x - q.x, o.z - q.z), t, V, i); });
    });
    E.frame(env);
    // ---------- overlay ----------
    og.clearRect(0, 0, innerWidth, innerHeight);
    og.textAlign = 'center'; og.lineJoin = 'round';
    for (const l of labels) {
      const p = E.project(l.x, l.y, l.z); if (!p || p[2] > E.far + 20) continue;
      if (l.bar !== undefined) { const w = clamp(1600 / p[2], 60, 260), h = clamp(160 / p[2], 6, 14); og.fillStyle = '#000b'; og.fillRect(p[0] - w / 2 - 2, p[1] - 2, w + 4, h + 4); og.fillStyle = '#ff3a2a'; og.fillRect(p[0] - w / 2, p[1], w * l.bar, h); continue; }
      const sz = clamp(l.sz * 13 / p[2], 9, 30); og.font = `900 ${sz}px "Outfit","Trebuchet MS","Segoe UI",sans-serif`;
      if (l.bg) { const w = og.measureText(l.t).width; og.fillStyle = l.bg; rrect(p[0] - w / 2 - 8, p[1] - sz, w + 16, sz * 1.35, sz * 0.45); og.fill(); }
      if (!l.ns) { og.lineWidth = Math.max(3, sz / 5); og.strokeStyle = '#000c'; og.strokeText(l.t, p[0], p[1]); }
      og.fillStyle = l.c || '#fff'; og.fillText(l.t, p[0], p[1]);
    }
    og.font = '900 26px "Outfit","Trebuchet MS","Segoe UI",sans-serif'; og.lineWidth = 5;
    for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.t += dt; if (f.t > 0.9) { floats.splice(i, 1); continue; } og.globalAlpha = 1 - f.t / 0.9; og.strokeStyle = '#000'; og.fillStyle = f.c; const y = f.y - f.t * 90; og.strokeText(f.txt, f.x, y); og.fillText(f.txt, f.x, y); }
    for (let i = wfloats.length - 1; i >= 0; i--) { const f = wfloats[i]; f.t += dt; if (f.t > 1.2) { wfloats.splice(i, 1); continue; } const p = E.project(f.x, f.y + f.t * 1.5, f.z); if (!p) continue; og.globalAlpha = 1 - f.t / 1.2; og.strokeStyle = '#000'; og.fillStyle = f.c; og.strokeText(f.txt, p[0], p[1]); og.fillText(f.txt, p[0], p[1]); }
    og.globalAlpha = 1;
    if (floats.length > 60) floats.splice(0, floats.length - 60);
    $('#combo i').style.width = (combo * 100) + '%';
    // fps + auto quality
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 1) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; if (SET.fps) $('#fps').textContent = fpsShow + ' fps · ' + E.quality + ' · ' + E.stats.draws + ' draws';
      if (autoQ && App.inGame && document.visibilityState === 'visible') {
        qT++; if (fpsShow < 48) qBad++;
        if (qT >= 3) { if (qBad >= 2) { if (E.quality === 'high') E.setQuality('med'); else if (E.quality === 'med') E.setQuality('low'); else if (extraScale > 0.6) { extraScale -= 0.15; E.setQuality('low', extraScale); } } qT = 0; qBad = 0; }
      } }
  }
  function rrect(x, y, w, h, r) { og.beginPath(); og.moveTo(x + r, y); og.arcTo(x + w, y, x + w, y + h, r); og.arcTo(x + w, y + h, x, y + h, r); og.arcTo(x, y + h, x, y, r); og.arcTo(x, y, x + w, y, r); og.closePath(); }

  // ---------- main loop ----------
  let last = 0, hudT = 0, errShown = false;
  function frame(ms) {
    const dt = Math.min(0.05, (ms - last) / 1000 || 0.016); last = ms; T = ms / 1000;
    try {
      update(dt); render(T, dt);
      hudT += dt; if (App.inGame && hudT > 0.2) { hudT = 0; UI.hud(); if (UI.cur === 'rebirth' || UI.cur === 'stats' || UI.cur === 'trade') throttledRender(); }
    } catch (e) { if (!errShown) { errShown = true; console.error(e); } }
    requestAnimationFrame(frame);
  }
  App._debug = { P, cam, tp, E, WD, near, use, tap };
  requestAnimationFrame(frame);
})();
