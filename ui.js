/* Tapping Legends - HUD, menus, hatch animations, start screen. */
(function (root) {
  'use strict';
  const L = root.TL, C = L.C, $ = q => document.querySelector(q), fmt = L.fmt;
  const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = { cur: null, boardTab: 'week', tradeSel: {} };
  root.UI = UI;
  const A = () => root.App;
  const rc = r => C.RARITIES[r].c;
  const icon = (p, sz) => `<div class="ico" style="background:${rc(p.r)}${sz ? ';width:' + sz + 'px;height:' + sz + 'px;font-size:' + (sz * 0.55) + 'px' : ''}">${p.e}</div>`;

  // ---------- toast / chat ----------
  UI.toast = function (t, c) { const e = $('#toast'); e.textContent = t; e.style.color = c || '#fff'; e.classList.add('on'); clearTimeout(UI.toast.t); UI.toast.t = setTimeout(() => e.classList.remove('on'), 2200); };
  UI.addChat = function (n, m, c) {
    const l = $('#clog'), d = document.createElement('div');
    if (n) { const b = document.createElement('b'); b.textContent = n + ': '; b.style.color = 'hsl(' + (L.hash(n) % 360) + ',90%,72%)'; d.appendChild(b); }
    d.appendChild(document.createTextNode(m)); if (!n) d.style.color = c || '#cfe';
    l.appendChild(d); while (l.children.length > 8) l.removeChild(l.firstChild);
  };
  UI.sys = (m, c) => UI.addChat(null, m, c);
  UI.flash = (col, strong) => { const f = $('#flash'); f.style.background = col || '#fff'; f.style.transition = 'none'; f.style.opacity = strong ? 0.9 : 0.5; requestAnimationFrame(() => { f.style.transition = 'opacity .7s'; f.style.opacity = 0; }); };

  // ---------- HUD ----------
  let lastTaps = 0;
  UI.hud = function () {
    const app = A(), s = app.s; if (!s) return;
    const ctx = app.ctx(), now = ctx.now;
    const el = $('#taps'); $('#tapsn').textContent = fmt(s.taps);
    if (s.taps > lastTaps + 0.5) { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); }
    lastTaps = s.taps;
    $('#gemsn').textContent = fmt(s.gems);
    $('#dustpill').style.display = s.rocket || s.dustTotal > 0 ? 'flex' : 'none'; $('#dustn').textContent = fmt(s.dust);
    $('#obbybar').style.display = (app.inOb && app.inOb()) || app.mobbyRun ? 'flex' : 'none';
    $('#obLobby').textContent = app.mobbyRun ? '🌙 Back to Moon Base' : '🏠 Back to Lobby';
    $('#sub').textContent = fmt(L.perTap(s, ctx)) + ' per tap  ·  ' + ctx.rate + '/' + C.MAX_TAPS_PER_SEC + ' CPS' + (app.online ? '  ·  ' + (app.others.size + 1) + ' online' : '  ·  offline');
    $('#vip').style.display = ctx.vip && s.clicks >= C.GARDEN_CLICKS ? 'block' : 'none';
    // events bar
    const ev = L.events(now), bar = $('#evbar'); bar.className = '';
    const mmss = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
    if (app.obbyRun) { bar.className = 'frenzy'; bar.textContent = '🏁 ' + app.fmtTime((performance.now() - app.obbyRun) / 1000) + '  ·  Best ' + (s.obbyBest ? app.fmtTime(s.obbyBest) : '--') + '  ·  ✅ ' + (app.obbyCk || 0) + '/5  ·  falls ' + (app.obbyFalls || 0); }
    else if (app.mobbyRun) { bar.className = 'lucky'; bar.textContent = '🪨 Moon obby ' + app.fmtTime((performance.now() - app.mobbyRun) / 1000) + '  ·  Best ' + (s.mobbyBest ? app.fmtTime(s.mobbyBest) : '--') + '  ·  ✅ ' + (app.mobbyCk || 0) + '/4  ·  falls ' + (app.mobbyFalls || 0); }
    else if (app.onMoon && app.onMoon()) { const mi = L.meteorInfo(now);
      if (mi.active) { bar.className = 'frenzy'; bar.textContent = '☄️ METEOR SHOWER! Stand in the rings · ' + mmss(mi.ends - now); }
      else bar.textContent = '☄️ Next meteor shower in ' + mmss(mi.next - now) + '  ·  ✨ ' + fmt(s.dust) + ' Stardust'; }
    else if (ev.frenzy) { bar.className = 'frenzy'; bar.textContent = '⚡ FRENZY 2x TAPS · ' + mmss(ev.frenzy - now); }
    else if (ev.lucky) { bar.className = 'lucky'; bar.textContent = '🍀 LUCKY EGGS · ' + mmss(ev.lucky - now); }
    else if (app.boss) bar.textContent = '⚔️ BOSS FIGHT IN THE LOBBY!';
    else { const n = ev.next, nm = { frenzy: '⚡ Frenzy', lucky: '🍀 Lucky Eggs', boss: '⚔️ Boss' }[n.k]; bar.textContent = 'Next: ' + nm + ' in ' + mmss(n.in) + (n.k === 'boss' && !app.online ? ' (online only)' : ''); }
    // boosts
    const bs = []; for (const b of C.BOOSTS) if (L.boostOn(s, b.id, now)) bs.push(`<span class="bst">${b.ico} ${b.n} ${mmss(s.boost[b.id] - now)}</span>`);
    $('#boosts').innerHTML = bs.join('');
    const r = $('#rb'); r.textContent = '♻️ Rebirth ' + s.rb + ' · ' + fmt(L.rbCost(s)); r.style.filter = s.taps >= L.rbCost(s) ? 'brightness(1.25)' : 'brightness(.8)';
    const at = $('#atap'), ah = $('#ahatch');
    at.style.display = L.canAutoTap(s) ? '' : 'none'; ah.style.display = L.canAutoHatch(s) ? '' : 'none';
    at.classList.toggle('on', s.auto.tap); ah.classList.toggle('on', s.auto.hatch);
    at.textContent = '⚙️ Auto Tap ' + (s.auto.tap ? 'ON' : 'OFF'); ah.textContent = '🥚 Auto Hatch ' + (s.auto.hatch ? 'ON' : 'OFF');
    // quest dot
    const q = $('#qbtn'), ready = s.q.list.some(x => x.prog >= x.goal && !x.claimed);
    if (ready && !q.querySelector('.dot')) q.insertAdjacentHTML('beforeend', '<i class="dot"></i>'); else if (!ready && q.querySelector('.dot')) q.querySelector('.dot').remove();
    // boss bar
    const bb = $('#bossbar');
    const away = (app.onMoon && app.onMoon()) || (app.inOb && app.inOb()) || app.mobbyRun;
    if (app.boss && !away) {
      bb.style.display = 'block'; const f = app.boss.hp / app.boss.max;
      bb.querySelector('i').style.width = (f * 100) + '%'; bb.querySelector('span').textContent = fmt(app.boss.hp) + ' / ' + fmt(app.boss.max) + ' HP';
      const near = L.nearBoss(app.P.x, app.P.z);
      bb.querySelector('.s').textContent = '⏱ ' + mmss(app.boss.end - now) + '  ·  your hits: ' + app.bossMine + (app.bossMine < C.BOSS_MIN_HITS ? ' (need ' + C.BOSS_MIN_HITS + ')' : ' ✔') + (near ? '' : '  ·  ⚠️ get closer to the boss!');
    } else bb.style.display = 'none';
  };

  // ---------- panels ----------
  UI.show = p => { UI.cur = p; $('#veil').classList.add('on'); $('#veil').classList.toggle('side', p === 'avatar'); UI.render(); A().audio('click'); };
  UI.hide = () => { UI.cur = null; $('#veil').classList.remove('on', 'side'); };
  $('#veil').addEventListener('click', e => { if (e.target.id === 'veil') UI.hide(); });
  document.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => UI.show(b.dataset.p)));
  $('#rb').addEventListener('click', () => UI.show('rebirth'));
  $('#atap').addEventListener('click', () => A().act('auto', { k: 'tap', on: !A().s.auto.tap }));
  $('#ahatch').addEventListener('click', () => A().act('auto', { k: 'hatch', on: !A().s.auto.hatch }));
  const head = (t) => `<h2 class="st">${t}<button class="r x" onclick="UI.hide()">✕</button></h2>`;

  function petCard(p, extra, cls) {
    const ab = p.ab ? `<div class="ab">✨ ${esc(p.ab.d)}</div>` : '';
    return `<div class="card r${p.r} ${p.shiny ? 'shiny' : ''} ${cls || ''}" style="--c:${rc(p.r)}" ${extra || ''}>${icon(p)}<b>${p.shiny ? '✨ ' : ''}${esc(p.n)}</b><span style="color:${rc(p.r)}">${C.RARITIES[p.r].n}</span>`;
  }
  UI.render = function () {
    const app = A(), s = app.s, cur = UI.cur; if (!cur || !s) return;
    const ctx = app.ctx(), now = ctx.now; let h = '';
    if (cur === 'shop') {
      const a = C.AREAS[s.area], luck = L.luck(s, ctx), odds = L.odds(luck);
      h = head('🥚 Egg Shop') + `<div class="eggbox"><div class="egg3" style="background:radial-gradient(circle at 35% 30%,#fff,${a.sky[0]} 60%,${a.g})"></div>
        <div><div style="font-size:24px">${esc(a.egg)}</div><div class="small">${esc(a.n)}</div><div class="small">You have <b style="color:var(--gold)">${fmt(s.taps)}</b> taps · luck x${luck.toFixed(2)}${ctx.lucky ? ' 🍀 LUCKY EGGS!' : ''}</div></div></div>
        <div class="sec">Possible pets</div><div class="grid">` +
        C.RARITIES.map((r, i) => { const p = L.pet(s.area * 7 + i), pc = odds[i] * 100, own = s.pets[p.id] > 0 || i < 5;
          const chance = pc >= 1 ? pc.toFixed(1) + '%' : pc >= 0.01 ? pc.toFixed(2) + '%' : '1 in ' + fmt(Math.round(1 / odds[i]));
          return own ? petCard(p) + `<small>${chance} · +${fmt(p.p)}/tap</small>${p.ab ? `<div class="ab">✨ ${esc(p.ab.d)}</div>` : ''}</div>`
            : `<div class="card r${i}" style="--c:${rc(i)}"><div class="ico" style="background:#222">❓</div><b>???</b><span style="color:${rc(i)}">${r.n}</span><small>${chance}</small></div>`;
        }).join('') + `</div>
        <div class="hb"><button class="g" ${s.taps < a.ec ? 'disabled' : ''} onclick="App.act('hatch',{n:1})">Hatch x1<br><small>${fmt(a.ec)} taps</small></button>
        <button class="o" ${s.taps < a.ec * 3 ? 'disabled' : ''} onclick="App.act('hatch',{n:3})">Hatch x3<br><small>${fmt(a.ec * 3)} taps</small></button></div>` +
        (L.canAutoHatch(s) ? `<button class="${s.auto.hatch ? 'g' : 'k'}" style="width:100%" onclick="App.act('auto',{k:'hatch',on:${!s.auto.hatch}})">🥚 Auto Hatch: ${s.auto.hatch ? 'ON' : 'OFF'} (keeps hatching this egg)</button>` :
          `<div class="row"><span>🥚 Auto Hatch</span><small>unlocks at rebirth ${C.AUTOHATCH_REBIRTH}</small></div>`);
    }
    if (cur === 'pets') {
      const eq = L.equipped(s), sl = L.slots(s), owned = Object.keys(s.pets).length, ab = L.abilities(s);
      const abl = Object.entries(ab).filter(([, v]) => v > 0).map(([k, v]) => ({ tap: '+' + Math.round(v * 100) + '% taps', luck: '+' + Math.round(v * 100) + '% luck', speed: '+' + Math.round(v * 100) + '% speed', gem: Math.round(v * 100) + '% bonus gem', frenzy: '+' + Math.round(v * 100) + '% frenzy', boss: '+' + v + ' boss gems', hatch: Math.round(v * 100) + '% faster auto-hatch' }[k]));
      h = head('🐾 Pets') + `<div class="small">Collection ${owned} / ${L.PETS.length} · Equipped ${eq.length} / ${sl} · your best pets equip automatically · Secret & Godly pets survive rebirth</div>
        <div class="slots">${Array.from({ length: sl }, (_, i) => eq[i] ? `<div class="sl r${eq[i].r}" style="--c:${rc(eq[i].r)}">${icon(eq[i])}+${fmt(eq[i].p)}</div>` : '<div class="sl empty">+</div>').join('')}</div>
        ${abl.length ? '<div class="row"><span>✨ Active abilities</span><b>' + abl.join(' · ') + '</b></div>' : ''}` +
        `<div class="sec">📖 Pet index: finish a world (own every Common to Legendary pet once) for +${Math.round(C.INDEX_BONUS * 100)}% taps forever</div><div class="row"><span>${L.WORLDS.map((w, k) => (L.worldsDone(s).includes(k) ? '✅ ' : '⬜ ') + esc(w)).join(' · ')}</span><b>+${Math.round(L.worldsDone(s).length * C.INDEX_BONUS * 100)}%</b></div>` +
        (Object.keys(s.pets).some(id => id >= 1000) ? `<div class="sec">✨ Shiny pets</div><div class="grid">` + Object.keys(s.pets).filter(id => id >= 1000).map(id => { const p = L.pet(id); return petCard(p) + `<small>x${s.pets[id]} · +${fmt(p.p)}/tap</small></div>`; }).join('') + '</div>' : '') +
        L.WORLDS.map((wn, k) => `<div class="sec">${esc(wn)}${k >= 5 ? ' 🌙' : ''} ${L.worldsDone(s).includes(k) ? '✅' : ''}</div><div class="grid">` + L.PETS.filter(p => p.a === k).map(p => {
          const n = s.pets[p.id] || 0, seen = s.index[p.id];
          return n ? petCard(p) + `<small>x${n} · +${fmt(p.p)}/tap</small>${p.ab ? `<div class="ab">✨ ${esc(p.ab.d)}</div>` : ''}</div>` : (seen ? `<div class="card" style="--c:${rc(p.r)};opacity:.55">${icon(p)}<b>${esc(p.n)}</b><small>in your index</small></div>` : `<div class="card lock" style="--c:${rc(p.r)}"><div class="ico" style="background:#333">❓</div><b>???</b><small>${C.RARITIES[p.r].n}</small></div>`);
        }).join('') + '</div>').join('');
    }
    if (cur === 'gems') {
      h = head('💎 Gem Shop') + `<div class="row"><span>Your gems</span><b style="color:var(--gem);font-size:20px">💎 ${fmt(s.gems)}</b></div>
        <div class="small">Earn gems from pickups around the map${C.GEM_PICKUP_CAP_HOUR > 0 ? ' (max ' + C.GEM_PICKUP_CAP_HOUR + '/hour)' : ''}, the boss (${C.BOSS_WIN_GEMS}), the obby (${C.OBBY_GEMS}), the chest (${C.CHEST_GEMS}), daily quests and your login streak.</div>
        <div class="sec">Permanent upgrades</div><div class="shop">` + C.SHOP.map(it => {
          const lvl = s.upg[it.id] || 0, cost = L.shopCost(s, it), locked = it.rb && s.rb < it.rb;
          return `<div class="si"><div class="h"><span>${it.ico}</span><div>${esc(it.n)}<br><small>${esc(it.d)}</small></div></div>
            <div class="lv">${Array.from({ length: it.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
            <button class="c" ${cost === Infinity || s.gems < cost || locked ? 'disabled' : ''} onclick="App.act('buy',{id:'${it.id}'})">${locked ? '🔒 Rebirth ' + it.rb : cost === Infinity ? 'MAXED' : '💎 ' + fmt(cost)}</button></div>`;
        }).join('') + `</div><div class="sec">Boosts (stack up to 60 min)</div><div class="shop">` + C.BOOSTS.map(b => {
          const on = L.boostOn(s, b.id, now);
          return `<div class="si"><div class="h"><span>${b.ico}</span><div>${esc(b.n)}<br><small>${esc(b.d)}</small></div></div>
            ${on ? `<small style="color:#7dff6a">Active: ${Math.ceil((s.boost[b.id] - now) / 60000)} min left</small>` : ''}
            <button class="p" ${s.gems < b.cost ? 'disabled' : ''} onclick="App.act('buy',{id:'${b.id}'})">💎 ${b.cost}</button></div>`;
        }).join('') + '</div>';
    }
    if (cur === 'quests') {
      const streakG = C.STREAK_GEMS[Math.min(s.daily.streak + 1, C.STREAK_GEMS.length) - 1];
      h = head('📜 Daily Quests') + `<div class="row"><span>🔥 Login streak</span><b>${s.daily.streak} day${s.daily.streak === 1 ? '' : 's'} · tomorrow: 💎 ${streakG}</b></div>` +
        s.q.list.map((q, i) => `<div class="q"><div style="font-size:30px">${q.claimed ? '✅' : q.prog >= q.goal ? '🎁' : '📜'}</div><div style="flex:1">${esc(L.questText(q))}<div class="small">${fmt(q.prog)} / ${fmt(q.goal)} · reward 💎 ${q.gems}${q.dust ? " + ✨ " + q.dust : ""} + taps</div><div class="bar"><i style="width:${q.prog / q.goal * 100}%"></i></div></div>
          <button class="g" ${q.claimed || q.prog < q.goal ? 'disabled' : ''} onclick="App.act('claim',{i:${i}})">${q.claimed ? 'Done' : 'Claim'}</button></div>`).join('') +
        `<div class="small">New quests every day at midnight (Sydney time).</div>`;
    }
    if (cur === 'map') {
      const here = app.island();
      h = head('🗺️ World Map') + `<div class="small">Walk across the bridges, or travel to islands you've unlocked. Unlock islands at their gate pads or here.</div>
        <div class="wd" style="background:linear-gradient(135deg,#4fb4ff,#6cc04a)"><span>🏠 Lobby<small>Boss arena, gem shop, quests, wheel, obby, chest, rebirth</small></span>${here < 0 ? '<b>You are here</b>' : '<button class="g" onclick="App.travelHub()">Go</button>'}</div>` +
        C.AREAS.map((a, k) => { const o = s.open.includes(k); let b;
          if (here === k) b = '<b>You are here</b>'; else if (o) b = `<button class="g" onclick="App.travel(${k})">Travel</button>`;
          else b = `<button class="o" ${s.rb < a.rb || s.taps < a.cost ? 'disabled' : ''} onclick="App.act('unlock',{k:${k}})">${s.rb < a.rb ? '🔒 Rebirth ' + a.rb : '🔓 ' + fmt(a.cost)}</button>`;
          return `<div class="wd" style="background:linear-gradient(135deg,${a.sky[0]},${a.g})"><span>${a.e[0]} ${esc(a.n)}<small>${esc(a.egg)} ${fmt(a.ec)} taps${!o && a.rb ? ' · needs ' + a.rb + ' rebirth' + (a.rb > 1 ? 's' : '') : ''}</small></span>${b}</div>`; }).join('') +
        `<div class="wd" style="background:linear-gradient(135deg,#2a0a5a,#7a3ab8)"><span>🌙 Nebula Moon<small>${s.rocket ? 'Fly there with the rocket in the Space Station hangar' : 'Buy the rocket in the Space Station hangar (' + C.ROCKET_RB + ' rebirths + ' + fmt(C.ROCKET_TAPS) + ' taps)'}</small></span>${app.onMoon() ? '<b>You are here</b>' : s.rocket ? '🚀' : '🔒'}</div>`;
    }
    if (cur === 'rebirth') {
      const c = L.rbCost(s), nextSl = C.BASE_SLOTS + Math.min((s.rb + 1) * C.SLOTS_PER_REBIRTH, C.MAX_REBIRTH_SLOTS) + s.upg.slot;
      const unl = []; if (s.rb + 1 === C.AUTOTAP_REBIRTH) unl.push('⚙️ Auto-tapper & AFK pad'); if (s.rb + 1 === C.AUTOHATCH_REBIRTH) unl.push('🥚 Auto-hatch');
      const nw = C.AREAS.find(a => a.rb === s.rb + 1); if (nw) unl.push(nw.e[0] + ' ' + nw.n);
      h = head('♻️ Rebirth') + `<div class="row">Cost<b>${fmt(c)} taps</b></div><div class="q"><div class="bar" style="margin:0"><i style="width:${Math.min(100, s.taps / c * 100)}%"></i></div></div>
        <div class="row">Tap multiplier<b>x${L.rbMult(s).toFixed(1)} → x${(L.rbMult(s) + C.REBIRTH_MULT).toFixed(1)}</b></div>
        <div class="row">Pet slots<b>${L.slots(s)} → ${nextSl}</b></div>
        ${unl.length ? `<div class="row">Unlocks<b>${unl.join(' · ')}</b></div>` : ''}
        <p class="small">Resets taps, normal pets and islands. Keeps gems, upgrades, Secret & Godly pets, stats and the Golden Garden.</p>
        <button class="p" style="width:100%;font-size:18px;padding:14px" ${s.taps < c ? 'disabled' : ''} onclick="App.act('rebirth')">♻️ Rebirth now</button>`;
    }
    if (cur === 'board') {
      const b = app.board || {}, rows = (UI.boardTab === 'week' ? b.week : b.all) || [];
      h = head('🏆 Leaderboard') + `<div class="tabs"><button class="k ${UI.boardTab === 'week' ? 'on' : ''}" onclick="UI.boardTab='week';UI.render()">This week</button><button class="k ${UI.boardTab === 'all' ? 'on' : ''}" onclick="UI.boardTab='all';UI.render()">All time</button></div>` +
        (app.online ? '' : '<div class="small">Offline: connect to a server to see the leaderboard.</div>') +
        (UI.boardTab === 'week' ? `<div class="small">Taps earned this week. Top 3 on Monday win 💎 ${C.WEEKLY_REWARDS.join(' / ')}. Accounts only.</div>` : '<div class="small">Total taps ever earned.</div>') +
        (rows.length ? rows.map((p, i) => `<div class="row" style="${p[0] === app.myName ? 'background:#ffd84a33;outline:2px solid #ffd84a' : ''}"><span>${['🥇', '🥈', '🥉'][i] || '#' + (i + 1)} ${esc(p[0])} <small>♻️${p[2]}</small></span><b>${fmt(p[1])}</b></div>`).join('') : '<div class="row">No scores yet. Be the first!</div>') +
        (b.last && b.last.top && b.last.top.length ? `<div class="sec">Last week's winners</div>` + b.last.top.map((p, i) => `<div class="row"><span>${['🥇', '🥈', '🥉'][i]} ${esc(p[0])}</span><b>${fmt(p[1])}</b></div>`).join('') : '');
    }
    if (cur === 'trade') h = head('🤝 Trading') + UI.tradeHtml();
    if (cur === 'stats') {
      const t = Math.floor(s.time), b = L.pet(s.best);
      const R = [['Taps now', fmt(s.taps)], ['Taps earned', fmt(s.total)], ['Per tap', fmt(L.perTap(s, ctx))], ['Clicks', fmt(s.clicks) + (s.clicks >= C.GARDEN_CLICKS ? ' (Garden open)' : ' / ' + fmt(C.GARDEN_CLICKS) + ' for Garden')],
        ['Gems now / earned', fmt(s.gems) + ' / ' + fmt(s.gemsTotal)], ['Rebirths', s.rb], ['Eggs hatched', fmt(s.hatched)], ['Legendary+', s.legend], ['Secrets / Godlies', s.secrets + ' / ' + s.godlies],
        ['Obbies cleared / best time', s.obbies + ' / ' + (s.obbyBest ? app.fmtTime(s.obbyBest) : '--')], ['Moon obby best time', s.mobbyBest ? app.fmtTime(s.mobbyBest) : '--'], ['Boss hits / wins', fmt(s.bossHits) + ' / ' + s.bossWins], ['Stardust now / earned', fmt(s.dust) + ' / ' + fmt(s.dustTotal)], ['Meteors caught', fmt(s.meteors)], ['Shiny pets made', s.shinies], ['Pet collections done', L.worldsDone(s).length + ' / ' + L.WORLDS.length], ['Best pet', b ? b.e + ' ' + b.n : 'None yet'], ['Play time', Math.floor(t / 3600) + 'h ' + Math.floor(t / 60) % 60 + 'm'],
        ['Account', app.mode === 'account' ? '☁️ ' + esc(app.myName) + ' (cloud save)' : '📱 Guest (saved on this device)']];
      h = head('📊 Stats') + R.map(r => `<div class="row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
    }
    if (cur === 'settings') {
      const st = app.settings;
      h = head('⚙️ Settings') + `<div class="set">
        <span>Graphics</span><select onchange="App.setSetting('quality',this.value)">${[['auto', 'Auto (recommended)'], ['low', 'Low (fastest)'], ['med', 'Medium'], ['high', 'High']].map(([v, n]) => `<option value="${v}" ${st.quality === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <span>Sound effects</span><input type="range" min="0" max="1" step="0.05" value="${st.sfx}" oninput="App.setSetting('sfx',+this.value)">
        <span>Music</span><input type="range" min="0" max="1" step="0.05" value="${st.music}" oninput="App.setSetting('music',+this.value)">
        <span>Camera speed</span><input type="range" min="0.3" max="2" step="0.1" value="${st.sens}" oninput="App.setSetting('sens',+this.value)">
        <span>Name tags</span><select onchange="App.setSetting('names',this.value==='1')"><option value="1" ${st.names ? 'selected' : ''}>Show</option><option value="0" ${!st.names ? 'selected' : ''}>Hide</option></select>
        <span>Shift lock</span><select onchange="App.setSetting('shiftKey',this.value==='1')"><option value="1" ${st.shiftKey ? 'selected' : ''}>Shift key toggles it</option><option value="0" ${!st.shiftKey ? 'selected' : ''}>Off</option></select>
        <span>FPS counter</span><select onchange="App.setSetting('fps',this.value==='1')"><option value="0" ${!st.fps ? 'selected' : ''}>Hide</option><option value="1" ${st.fps ? 'selected' : ''}>Show</option></select>
      </div><div class="hb"><button class="p" onclick="UI.show('avatar')">🎨 Customise character</button><button class="k" onclick="App.mainMenu()">📋 Main Menu</button></div><div class="small" style="margin-top:10px">Now running: ${app.E.quality.toUpperCase()} quality${app.E.canShadow ? '' : ' (shadows not supported here)'}.</div>
      <div class="hb">${app.mode === 'account' ? '<button class="r" onclick="App.logout()">Log out</button>' : '<button class="r" onclick="if(confirm(\'Delete your guest save on this device?\'))App.resetGuest()">Reset guest save</button>'}</div>`;
    }
    if (cur === 'avatar') {
      const lk = s.look, sw = (k, list) => `<div class="sw">${list.map(c => `<i style="background:${c}" class="${lk[k] === c ? 'on' : ''}" onclick="UI.look('${k}','${c}')"></i>`).join('')}</div>`;
      h = head('🎨 Character') + `<div class="small">Your look saves ${app.mode === 'account' ? 'to your account' : 'on this device'} and other players see it.</div>
        <div class="sec">Skin</div>${sw('skin', C.LOOK.skin)}<div class="sec">Shirt</div>${sw('shirt', C.LOOK.shirt)}<div class="sec">Pants</div>${sw('pants', C.LOOK.pants)}
        <div class="sec">Hat</div><div class="hats">${C.LOOK.hats.map(hh => { const locked = hh.moon && !(s.mupg.helmet > 0);
          return `<button class="${lk.hat === hh.id ? 'on' : ''} ${locked ? 'k' : 'c'}" ${locked ? 'disabled title="Buy it in the Stardust Shop"' : ''} onclick="UI.look('hat','${hh.id}')"><span>${locked ? '🔒' : hh.ico}</span>${esc(hh.n)}</button>`; }).join('')}</div>
        <div class="sec">Title (shown under your name)</div><div class="titles">${C.TITLES.map(tt => { const okk = L.titleOk(s, tt);
          return `<button class="${s.title === tt.id ? 'on' : ''} ${okk ? 'o' : 'k'}" ${okk ? '' : 'disabled'} onclick="App.setTitle('${tt.id}')"><span>${okk ? '🏷️' : '🔒'} ${esc(tt.n)}</span><small>${okk ? (s.title === tt.id ? 'equipped' : 'tap to use') : esc(tt.d) + ' (' + fmt(L.statVal(s, tt.stat)) + '/' + fmt(tt.need) + ')'}</small></button>`; }).join('')}</div>`;
    }
    if (cur === 'rocket') {
      const okRb = s.rb >= C.ROCKET_RB, okT = s.taps >= C.ROCKET_TAPS;
      h = head('🚀 Rocket') + `<div class="credit" style="padding:16px"><div style="font-size:60px">🚀</div><div style="font-size:22px">Fly to <b style="color:#e0b0ff">Nebula Moon</b></div>
        <div class="small">Low gravity · meteor showers · Stardust · 14 new moon pets that you keep forever · Shiny Machine · moon obby</div></div>
        <div class="row"><span>Rebirths</span><b style="color:${okRb ? '#7dff6a' : '#ff9a9a'}">${s.rb} / ${C.ROCKET_RB}</b></div>
        <div class="row"><span>Taps</span><b style="color:${okT ? '#7dff6a' : '#ff9a9a'}">${fmt(s.taps)} / ${fmt(C.ROCKET_TAPS)}</b></div>
        <p class="small">One-time purchase. The rocket stays yours through every rebirth.</p>
        <button class="o" style="width:100%;font-size:18px;padding:14px" ${okRb && okT ? '' : 'disabled'} onclick="App.act('rocket')">🚀 Buy the rocket</button>`;
    }
    if (cur === 'megg') {
      const e = app.megg || 0, g = C.MOON.EGGS[e], luck = L.luck(s, ctx), odds = L.odds(luck);
      h = head('🥚 ' + esc(g.n)) + `<div class="eggbox"><div class="egg3" style="background:radial-gradient(circle at 35% 30%,#fff,${e ? '#ff7af0' : '#8a7aff'} 60%,#3a1a6a)"></div>
        <div><div style="font-size:24px">${esc(g.n)}</div><div class="small">Moon pets stay with you through rebirths</div><div class="small">You have <b style="color:#ff9af0">✨ ${fmt(s.dust)}</b> Stardust</div></div></div><div class="grid">` +
        C.RARITIES.map((r, i) => { const p = L.pet(35 + e * 7 + i), pc = odds[i] * 100, chance = pc >= 1 ? pc.toFixed(1) + '%' : pc >= 0.01 ? pc.toFixed(2) + '%' : '1 in ' + fmt(Math.round(1 / odds[i]));
          return petCard(p) + `<small>${chance} · +${fmt(p.p)}/tap</small></div>`; }).join('') + `</div>
        <div class="hb"><button class="g" ${s.dust < g.cost ? 'disabled' : ''} onclick="App.act('mhatch',{e:${e},n:1})">Hatch x1<br><small>✨ ${g.cost}</small></button>
        <button class="o" ${s.dust < g.cost * 3 ? 'disabled' : ''} onclick="App.act('mhatch',{e:${e},n:3})">Hatch x3<br><small>✨ ${g.cost * 3}</small></button></div>`;
    }
    if (cur === 'dshop') {
      h = head('✨ Stardust Shop') + `<div class="row"><span>Your Stardust</span><b style="color:#ff9af0;font-size:20px">✨ ${fmt(s.dust)}</b></div>
        <div class="small">Catch meteors during showers, grab Stardust on the floating platforms (jetpack and bounce pads!) and climb the moon obby.</div><div class="shop">` +
        C.MOON.SHOP.map(it => { const lvl = s.mupg[it.id] || 0, cost = L.mshopCost(s, it);
          return `<div class="si"><div class="h"><span>${it.ico}</span><div>${esc(it.n)}<br><small>${esc(it.d)}</small></div></div><div class="lv">${Array.from({ length: it.max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}</div>
            <button class="p" ${cost === Infinity || s.dust < cost ? 'disabled' : ''} onclick="App.act('mbuy',{id:'${it.id}'})">${cost === Infinity ? (it.id === 'helmet' ? 'OWNED' : 'MAXED') : '✨ ' + fmt(cost)}</button></div>`; }).join('') + '</div>';
    }
    if (cur === 'shiny') {
      const can = Object.keys(s.pets).map(Number).filter(id => id < 1000 && s.pets[id] >= C.MOON.FUSE_COUNT);
      h = head('🌟 Shiny Machine') + `<div class="small">Put in ${C.MOON.FUSE_COUNT} of the same pet and get 1 Shiny version with ${C.MOON.SHINY_MULT}x power and a golden glow. Shinies can be traded.</div><div class="grid" style="margin-top:10px">` +
        (can.length ? can.sort((a, b) => L.pet(b).p - L.pet(a).p).map(id => { const p = L.pet(id), sp = L.pet(id + 1000);
          return petCard(p) + `<small>x${s.pets[id]} → ✨ +${fmt(sp.p)}/tap</small><button class="o" style="margin-top:4px;padding:6px" onclick="App.act('fuse',{id:${id}})">Fuse ${C.MOON.FUSE_COUNT}</button></div>`; }).join('')
          : '<div class="row">You need ' + C.MOON.FUSE_COUNT + ' of the same pet. Keep hatching!</div>') + '</div>';
    }
    if (cur === 'credits') {
      h = head('⭐ Credits & Recognition') + `<div class="credit"><div class="small">CREATED BY</div><div class="n st">Parker</div><div class="small">game design, ideas & testing</div></div>
        <div class="credit"><div class="small">CO-CREATOR</div><div class="n st">Wolfie</div><div class="small">ideas, testing & feedback</div></div>
        <div class="small" style="text-align:center">Thanks to everyone who plays at lunch! 👆</div>`;
    }
    $('#panel').innerHTML = h;
  };

  // ---------- trade UI ----------
  UI.tradeHtml = function () {
    const app = A(), s = app.s, T = app.trade;
    if (app.mode !== 'account') return '<div class="row">Log in with an account to trade. Guests cannot trade.</div>';
    if (!app.online) return '<div class="row">You are offline.</div>';
    let h = '';
    if (app.tradeReq) h += `<div class="row" style="background:#2bff8833"><span>📨 ${esc(app.tradeReq.name)} wants to trade!</span><span><button class="g" onclick="App.tradeSend({a:'accept',from:${app.tradeReq.from}})">Accept</button> <button class="r" onclick="App.tradeSend({a:'decline',from:${app.tradeReq.from}});App.tradeReq=null;UI.render()">No</button></span></div>`;
    if (!T) {
      const list = [...app.others.values()].filter(p => !p.g);
      h += '<div class="small">Pick a logged-in player to trade with. Trades are checked by the server, and both players must press Ready.</div>';
      h += list.length ? list.map(p => `<div class="row"><span>${esc(p.n)} <small>♻️${p.r}</small></span><button class="g" onclick="App.tradeSend({a:'req',to:${p.id}})">Request trade</button></div>`).join('') : '<div class="row">No other logged-in players online right now.</div>';
      return h;
    }
    const mine = T.mine || {}, theirs = T.theirs || {}, sel = UI.tradeSel;
    const offerList = o => Object.keys(o).length ? '<div class="grid">' + Object.entries(o).map(([id, n]) => { const p = L.pet(id); return petCard(p) + `<small>x${n}</small></div>`; }).join('') + '</div>' : '<div class="small">Nothing yet</div>';
    const cd = T.go ? Math.max(0, Math.ceil((T.go - app.now()) / 1000)) : 0;
    h += `<div class="small">Trading with <b>${esc(T.with)}</b>. Changing an offer un-readies both players.</div>
      <div class="tradecols"><div class="tradebox ${T.ready ? 'ready' : ''}"><div class="sec">You give</div>${offerList(mine)}</div><div class="tradebox ${T.theirReady ? 'ready' : ''}"><div class="sec">${esc(T.with)} gives</div>${offerList(theirs)}</div></div>
      ${cd ? `<div class="row" style="background:#2bff8844"><b>Trading in ${cd}...</b></div>` : ''}
      <div class="sec">Your pets (tap to add or remove, max 9 kinds)</div><div class="grid">` +
      Object.keys(s.pets).map(Number).sort((a, b) => L.pet(b).p - L.pet(a).p).map(id => { const p = L.pet(id), n = s.pets[id], k = sel[id] || 0;
        return petCard(p, `onclick="UI.tradeToggle(${id})"`, 'click ' + (k ? 'sel' : '')) + `<small>${k ? 'offering ' + k + ' / ' : ''}x${n}</small></div>`; }).join('') + `</div>
      <div class="hb"><button class="g" onclick="App.tradeSend({a:'ready',v:${!T.ready}})">${T.ready ? 'Not ready' : '✅ Ready'}</button><button class="r" onclick="App.tradeSend({a:'cancel'})">Cancel</button></div>`;
    return h;
  };
  UI.look = function (k, v) { const lk = Object.assign({}, A().s.look); lk[k] = v; A().setLook(lk); };
  UI.tradeToggle = function (id) {
    const s = A().s, sel = UI.tradeSel; sel[id] = (sel[id] || 0) + 1;
    if (sel[id] > s.pets[id]) delete sel[id];
    if (Object.keys(sel).length > 9) { delete sel[id]; UI.toast('Max 9 kinds of pets', '#ff9a9a'); }
    A().tradeSend({ a: 'offer', pets: sel }); UI.render();
  };

  // ---------- hatch animation ----------
  UI.hatchAnim = function (ids, area, done) {
    const app = A(), h = $('#hatch'), a = area >= 5 ? { sky: [area === 6 ? '#ff7af0' : '#8a7aff'], g: '#3a1a6a' } : C.AREAS[area], best = Math.max(...ids.map(id => L.pet(id).r)), col = rc(best);
    UI.hide(); h.className = 'on'; h.style.setProperty('--rc', col);
    const big = best >= 3, dur = best >= 5 ? 2600 : best >= 3 ? 1800 : 1100;
    h.innerHTML = `<div class="rays"></div><div class="egg ${big ? 'big' : ''}" style="background:radial-gradient(circle at 35% 30%,#fff,${a.sky[0]} 55%,${a.g})"></div>`;
    for (let i = 0, n = Math.floor(dur / 150); i < n; i++) setTimeout(() => app.audio('shake', i), i * 150);
    if (best >= 5) setTimeout(() => { document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 700); }, dur - 700);
    setTimeout(() => {
      h.classList.add('reveal'); UI.flash(best >= 3 ? col : '#fff', best >= 5);
      app.audio('reveal', best);
      h.innerHTML = '<div class="rays"></div>' + ids.map((id, i) => { const p = L.pet(id);
        return `<div class="res r${p.r} st" style="border-color:${rc(p.r)};animation-delay:${i * 0.15}s;box-shadow:0 0 ${p.r >= 3 ? 50 : 24}px ${rc(p.r)}">${icon(p)}${esc(p.n)}<div style="color:${rc(p.r)};font-size:${p.r >= 4 ? 18 : 13}px">${p.r >= 5 ? '🌟 ' : ''}${C.RARITIES[p.r].n.toUpperCase()}${p.r >= 5 ? ' 🌟' : ''}</div><div style="font-size:12px">+${fmt(p.p)} per tap</div>${p.ab ? `<div class="ab" style="font-size:11px;margin-top:4px">✨ ${esc(p.ab.d)}</div>` : ''}</div>`; }).join('') +
        '<div style="width:100%;text-align:center;z-index:1"><button class="g" id="hok" style="font-size:20px;padding:12px 40px">Nice!</button></div>';
      if (best >= 4) app.confetti(best);
      $('#hok').onclick = () => { h.className = ''; done && done(); };
      $('#hok').focus();
    }, dur);
  };

  // ---------- start screen ----------
  let regMode = false;
  const setTab = r => { regMode = r; $('#tabLogin').classList.toggle('on', !r); $('#tabReg').classList.toggle('on', r); $('#aEmail').classList.toggle('hidden', !r);
    $('#aUser').placeholder = r ? 'Username (3-14 letters/numbers)' : 'Username or email'; $('#authbtn').textContent = r ? 'Create account' : 'Log in'; $('#authmsg').textContent = '';
    $('#aPass').autocomplete = r ? 'new-password' : 'current-password'; };
  $('#tabLogin').onclick = () => setTab(false); $('#tabReg').onclick = () => setTab(true);
  $('#authbtn').onclick = () => {
    const u = $('#aUser').value.trim(), p = $('#aPass').value, e = $('#aEmail').value.trim();
    if (!u || !p) return UI.authMsg('Fill in your username and password');
    if (regMode && !e) return UI.authMsg('Enter your email');
    $('#authbtn').disabled = true; UI.authMsg('...', '#bfe8ff');
    A().auth(regMode ? { t: 'register', u, p, e } : { t: 'login', u, p });
  };
  for (const id of ['#aUser', '#aPass', '#aEmail']) $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $('#authbtn').click(); });
  $('#gName').addEventListener('keydown', e => { if (e.key === 'Enter') $('#guestbtn').click(); });
  $('#guestbtn').onclick = () => A().playGuest($('#gName').value);
  UI.authMsg = (m, c) => { const el = $('#authmsg'); el.textContent = m; el.style.color = c || '#ff9a9a'; if (c !== '#bfe8ff') $('#authbtn').disabled = false; };
  UI.esc = esc;
})(typeof self !== 'undefined' ? self : this);
