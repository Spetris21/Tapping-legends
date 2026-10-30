// Unit tests for the shared game rules. Run: node tests/test-logic.js
const assert = require('assert');
const L = require('../public/logic.js'), C = L.C;
let passed = 0; const t = (name, fn) => { try { fn(); passed++; console.log('  ok  ', name); } catch (e) { console.log('  FAIL', name, '\n      ', e.message); process.exitCode = 1; } };
const rng = L.mulberry(42), NOW = Date.UTC(2026, 9, 28, 1, 5, 0);

t('fresh state taps 1 per click', () => { const s = L.fresh('a'); assert.equal(L.perTap(s, { now: NOW }), 1); });
t('odds always sum to 1 and luck boosts rare', () => {
  const a = L.odds(1), b = L.odds(2);
  assert(Math.abs(a.reduce((x, y) => x + y) - 1) < 1e-9);
  assert(b[4] > a[4] && b[0] < a[0]);
});
t('secret is 1 in 10,000 and godly 1 in 100,000 at base luck', () => { const o = L.odds(1); assert(Math.abs(o[5] - 1e-4) < 1e-9); assert(Math.abs(o[6] - 1e-5) < 1e-9); });
t('hatch costs taps and refuses when poor', () => {
  const s = L.fresh('a'); assert.equal(L.hatch(s, 1, { now: NOW }, rng).ok, false);
  s.taps = 700 * 3; const r = L.hatch(s, 3, { now: NOW }, rng); assert(r.ok); assert.equal(r.pets.length, 3); assert.equal(s.taps, 0); assert.equal(s.hatched, 3);
});
t('hatch roll distribution roughly matches odds (200k rolls)', () => {
  const r = L.mulberry(9), n = 200000, cnt = new Array(7).fill(0);
  for (let i = 0; i < n; i++) cnt[L.roll(0, 1, r).r]++;
  assert(Math.abs(cnt[0] / n - 0.58) < 0.01, 'common ' + cnt[0] / n);
  assert(Math.abs(cnt[4] / n - 0.00989) < 0.002, 'legendary ' + cnt[4] / n);
});
t('equipped picks the best pets up to the slot count', () => {
  const s = L.fresh('a'); s.pets = { 0: 10, 4: 1, 3: 2 }; const e = L.equipped(s);
  assert.equal(e.length, 3); assert.deepEqual(e.map(p => p.id), [4, 3, 3]);
});
t('rebirth resets but keeps Secret and Godly pets', () => {
  const s = L.fresh('a'); s.pets = { 0: 5, 5: 1, 6: 2, 12: 1 }; s.open = [0, 1]; s.taps = L.rbCost(s);
  assert(L.rebirth(s).ok); assert.equal(s.rb, 1); assert.deepEqual(s.pets, { 5: 1, 6: 2, 12: 1 }); assert.deepEqual(s.open, [0]); assert.equal(s.taps, 0);
});
t('rebirth too expensive is refused', () => { const s = L.fresh('a'); assert.equal(L.rebirth(s).ok, false); });
t('island needs rebirths and taps', () => {
  const s = L.fresh('a'); s.taps = 1e12; assert.equal(L.unlock(s, 2).ok, false); s.rb = 1; assert(L.unlock(s, 2).ok); assert(s.open.includes(2));
});
t('gem shop: costs grow, max level, +1 slot is expensive', () => {
  const s = L.fresh('a'); s.gems = 10000; const item = C.SHOP.find(i => i.id === 'tap');
  const c0 = L.shopCost(s, item); assert(L.buy(s, 'tap', NOW).ok); assert(L.shopCost(s, item) > c0);
  for (let i = 0; i < 20; i++) L.buy(s, 'tap', NOW); assert.equal(s.upg.tap, item.max); assert.equal(L.buy(s, 'tap', NOW).ok, false);
  const before = s.gems; assert(L.buy(s, 'slot', NOW).ok); assert.equal(before - s.gems, 750); assert.equal(L.slots(s), 4);
});
t('auto-tap upgrade locked before first rebirth', () => { const s = L.fresh('a'); s.gems = 999; assert.equal(L.buy(s, 'autotap', NOW).ok, false); s.rb = 1; assert(L.buy(s, 'autotap', NOW).ok); });
t('boosts extend but cap at 60 minutes', () => {
  const s = L.fresh('a'); s.gems = 1000;
  for (let i = 0; i < 6; i++) assert(L.buy(s, 'x2', NOW).ok);
  assert.equal(L.buy(s, 'x2', NOW).ok, false);
  assert.equal(L.perTap(s, { now: NOW }), 2);
});
t('frenzy doubles taps, golden garden needs 1500 clicks', () => {
  const s = L.fresh('a'); assert.equal(L.perTap(s, { now: NOW, frenzy: true }), 2);
  assert.equal(L.perTap(s, { now: NOW, vip: true }), 1); s.clicks = 1500; assert.equal(L.perTap(s, { now: NOW, vip: true }), 2);
});
t('abilities of the same type do not stack', () => {
  const s = L.fresh('a'); s.pets = { 6: 1, 34: 1 }; // Celestial Lion (+12%) and Galaxy Emperor (+15%), both "tap"
  assert.equal(L.abilities(s).tap, 0.15);
});
t('auto-tapper only after rebirth 1; auto-hatch only after rebirth 3', () => {
  const s = L.fresh('a'); assert.equal(L.setAuto(s, 'tap', true).ok, false); s.rb = 1; assert(L.setAuto(s, 'tap', true).ok);
  assert.equal(L.setAuto(s, 'hatch', true).ok, false); s.rb = 3; assert(L.setAuto(s, 'hatch', true).ok);
  const acc = {}; s.taps = 1e9; const out = L.autoTick(s, 3, { now: NOW }, acc, rng); assert(out.taps > 0); assert.equal(out.pets.length, 1);
});
t('events never overlap and each lasts 3 minutes', () => {
  const base = Date.UTC(2026, 9, 28, 3, 0, 0); const secs = { frenzy: 0, lucky: 0, boss: 0 };
  for (let i = 0; i < 3600; i++) {
    const e = L.events(base + i * 1000), on = ['frenzy', 'lucky', 'boss'].filter(k => e[k]);
    assert(on.length <= 1, 'overlap at second ' + i + ': ' + on); on.forEach(k => secs[k]++);
  }
  assert.equal(secs.frenzy, 540); assert.equal(secs.boss, 540); assert.equal(secs.lucky, 360);
});
t('daily streak counts up and resets after a missed day', () => {
  const s = L.fresh('a'), d1 = Date.UTC(2026, 9, 28, 2), day = 86400000;
  assert.equal(L.daily(s, d1).streak, 1); assert.equal(L.daily(s, d1 + 1000), null);
  assert.equal(L.daily(s, d1 + day).streak, 2); assert.equal(L.daily(s, d1 + 3 * day).streak, 1);
  assert.equal(s.q.list.length, C.QUESTS_PER_DAY);
});
t('quests progress and can be claimed once', () => {
  const s = L.fresh('a'); L.daily(s, NOW); s.q.list = [{ id: 'tap', goal: 5, prog: 0, claimed: false, gems: 3 }];
  L.tap(s, 3, { now: NOW }); assert.equal(L.claimQuest(s, 0, { now: NOW }).ok, false);
  L.tap(s, 3, { now: NOW }); const g = s.gems; assert(L.claimQuest(s, 0, { now: NOW }).ok); assert.equal(s.gems, g + 3);
  assert.equal(L.claimQuest(s, 0, { now: NOW }).ok, false);
});
t('gem pickups respawn (and respect the hourly cap if one is set)', () => {
  const s = L.fresh('a'); assert(L.gemPickup(s, 0, NOW, rng).ok); assert.equal(L.gemPickup(s, 0, NOW + 1000, rng).ok, false);
  let got = 0; for (let k = 0; k < 40; k++) { const r = L.gemPickup(s, 1 + (k % 30), NOW + 2000 + k * 200000 % 3000000, rng); if (r.ok) got += r.gems; }
  if (C.GEM_PICKUP_CAP_HOUR > 0) assert(s.gemHour.n <= C.GEM_PICKUP_CAP_HOUR + 1); else assert(got > 25, 'no cap: got ' + got);
});
t('obby must take a minimum time', () => {
  const s = L.fresh('a'); assert.equal(L.obbyEnd(s, NOW, NOW - 5000, { now: NOW }).ok, false);
  const r = L.obbyEnd(s, NOW, NOW - 60000, { now: NOW }); assert(r.ok); assert.equal(r.gems, C.OBBY_GEMS);
  assert.equal(L.obbyEnd(s, NOW + 1000, NOW - 60000, { now: NOW }).gems, 0); // gem cooldown
});
t('boss rewards need a minimum contribution', () => {
  const s = L.fresh('a'); assert.equal(L.bossReward(s, true, 3, { now: NOW }).ok, false);
  assert.equal(L.bossReward(s, true, 30, { now: NOW }).gems, C.BOSS_WIN_GEMS);
  assert.equal(L.bossReward(s, false, 12, { now: NOW }).gems, C.BOSS_FAIL_GEMS);
});
t('migrate repairs broken saves', () => {
  const s = L.migrate({ v: C.VERSION, name: 'x', taps: 5, pets: { 999: 3, 1: -2, 2: 1 }, open: [7], upg: {} });
  assert.deepEqual(s.pets, { 2: 1 }); assert.deepEqual(s.open, [0]); assert.equal(s.upg.tap, 0); assert.equal(s.taps, 5);
  assert.equal(L.migrate({ v: 1, taps: 9e99 }).taps, 0); // old save versions start fresh
});
t('obby: every jump is possible at base speed (with a safety margin), checkpoints every 8', () => {
  const PL = L.W.PL, SPEED = 6, VJ = 9, G = 24, worst = [];
  for (let i = 1; i < PL.length; i++) {
    const a = PL[i - 1], b = PL[i];
    let dy = b.by - a.by; if (a.k === 3) dy -= a.amp; if (b.k === 3) dy -= b.amp;  // you can wait for the best moment on up/down platforms
    const gx = Math.max(0, Math.abs(b.bx - a.bx) - (a.s + b.s) / 2), gz = a.k === 1 || b.k === 1 ? 0 : Math.max(0, Math.abs(b.bz - a.bz) - (a.s + b.s) / 2);
    const gap = Math.hypot(gx, gz), disc = VJ * VJ - 2 * G * Math.max(dy, -5);
    assert(disc > 0, 'platform ' + i + ' is too high to reach');
    const reach = SPEED * (VJ + Math.sqrt(disc)) / G + 0.44;
    worst.push([reach - gap, i]);
    assert(gap <= reach - 0.35, `jump to platform ${i} needs ${gap.toFixed(2)}m but max is ${reach.toFixed(2)}m`);
  }
  worst.sort((x, y) => x[0] - y[0]);
  console.log('        tightest jumps (spare metres → platform):', worst.slice(0, 4).map(w => w[0].toFixed(2) + '→#' + w[1]).join(', '));
  assert.deepEqual(PL.filter(p => p.cp).map(p => p.i), [0, 8, 16, 24, 32, 40, 50]);
  assert.equal(PL.length, 51); assert(L.W.KILL.length >= 6); assert(PL.filter(p => p.bar).length >= 3);
});
t('rocket needs 5 rebirths and taps, and is kept through rebirth', () => {
  const s = L.fresh('a'); s.taps = 1e12; assert.equal(L.buyRocket(s).ok, false); s.rb = 5; s.taps = C.ROCKET_TAPS;
  assert(L.buyRocket(s).ok); assert.equal(s.taps, 0); assert(s.rocket); s.taps = L.rbCost(s); L.rebirth(s); assert(s.rocket);
});
t('moon eggs cost stardust; moon pets survive rebirth', () => {
  const s = L.fresh('a'); s.rocket = true; assert.equal(L.mhatch(s, 0, 1, { now: NOW }, rng).ok, false);
  s.dust = 5000; const r = L.mhatch(s, 1, 3, { now: NOW }, rng); assert(r.ok); assert.equal(s.dust, 5000 - 3 * C.MOON.EGGS[1].cost);
  assert(r.pets.every(id => id >= 42 && id <= 48)); s.pets[0] = 9; s.taps = L.rbCost(s); L.rebirth(s);
  assert(!s.pets[0]); assert(r.pets.every(id => s.pets[id] > 0));
});
t('moon pets are stronger than Space Station pets of the same rarity', () => { for (let i = 0; i < 7; i++) assert(L.pet(35 + i).p > L.pet(28 + i).p && L.pet(42 + i).p > L.pet(35 + i).p); });
t('meteors: same list for everyone, catch once, only near the landing spot in time', () => {
  const s = L.fresh('a'); s.rocket = true; const slot = L.meteorSlot(NOW), m = L.meteors(slot)[3];
  assert.deepEqual(L.meteors(slot)[3], m); assert.equal(L.meteors(slot).length, C.MOON.METEORS);
  assert.equal(L.meteorCatch(s, slot, 3, m.land - 5000, m.x, m.z).ok, false, 'too early');
  assert.equal(L.meteorCatch(s, slot, 3, m.land - 500, m.x + 9, m.z).ok, false, 'too far');
  assert(L.meteorCatch(s, slot, 3, m.land - 500, m.x, m.z).ok); assert.equal(L.meteorCatch(s, slot, 3, m.land, m.x, m.z).ok, false, 'twice');
  assert.equal(s.dust, C.MOON.METEOR_DUST); s.mupg.dust = 2; const m2 = L.meteors(slot)[4]; L.meteorCatch(s, slot, 4, m2.land, m2.x, m2.z); assert.equal(s.dust, C.MOON.METEOR_DUST * 2 + 2);
});
t('stardust shop + helmet unlocks the space helmet hat', () => {
  const s = L.fresh('a'); s.rocket = true; s.dust = 1000; const look = Object.assign({}, s.look, { hat: 'helmet' });
  assert.equal(L.setLook(s, look).ok, false); assert(L.mbuy(s, 'helmet').ok); assert(L.setLook(s, look).ok); assert.equal(L.mbuy(s, 'helmet').ok, false);
});
t('fusing 5 pets makes one Shiny with 2x power', () => {
  const s = L.fresh('a'); s.pets = { 2: 6 }; assert(L.fuse(s, 2).ok); assert.deepEqual(s.pets, { 2: 1, 1002: 1 });
  assert.equal(L.pet(1002).p, L.pet(2).p * 2); assert.equal(L.fuse(s, 2).ok, false); assert.equal(L.equipped(s)[0].id, 1002);
});
t('looks: only palette colours and unlocked hats are accepted', () => {
  const s = L.fresh('a'); assert.equal(L.setLook(s, { skin: '#123456', shirt: C.LOOK.shirt[0], pants: C.LOOK.pants[0], hat: 'cap' }).ok, false);
  assert(L.setLook(s, { skin: C.LOOK.skin[3], shirt: C.LOOK.shirt[5], pants: C.LOOK.pants[2], hat: 'tophat' }).ok); assert.equal(s.look.hat, 'tophat');
});
t('titles unlock from stats', () => { const s = L.fresh('a'); assert.equal(L.setTitle(s, 'titan').ok, false); s.bossWins = 5; assert(L.setTitle(s, 'titan').ok); assert(L.setTitle(s, 'rookie').ok); });
t('pet index: finishing a world (survives rebirth) gives a permanent bonus', () => {
  const s = L.fresh('a'), base = L.perTap(s, { now: NOW }); s.taps = 700 * 1000;
  for (let i = 0; i <= 4; i++) L.markIndex(s, i); assert.deepEqual(L.worldsDone(s), [0]);
  assert(Math.abs(L.perTap(s, { now: NOW }) - base * (1 + C.INDEX_BONUS)) < 1e-9); s.taps = L.rbCost(s); L.rebirth(s); assert.deepEqual(L.worldsDone(s), [0]);
});
t('daily rocket fuel quest appears once you own the rocket', () => {
  const s = L.fresh('a'); L.daily(s, NOW); assert(!s.q.list.some(q => q.id === 'fuel'));
  s.rb = 5; s.taps = C.ROCKET_TAPS; L.buyRocket(s); const q = s.q.list.find(q => q.id === 'fuel'); assert(q);
  L.giveDust(s, C.MOON.FUEL_QUEST.goal); const i = s.q.list.indexOf(q), d0 = s.dust; const r = L.claimQuest(s, i, { now: NOW }); assert(r.ok); assert.equal(s.dust, d0 + C.MOON.FUEL_QUEST.dust);
});
t('moon obby: every jump is possible (bounce rocks + star rings), checkpoints every 7, min time', () => {
  const R = L.W.MROCK, RING = L.W.MRING, g = 24 * C.MOON.GRAVITY, SPD = 6, V = 9, worst = [];
  const reach = (v, dy) => { const disc = v * v - 2 * g * dy; return disc < 0 ? -1 : SPD * (v + Math.sqrt(disc)) / g + 0.44; };
  const gapB = (a, b) => Math.max(0, Math.hypot(b.bx - a.bx, b.bz - a.bz) - (a.s + b.s) / 2 - (a.amp + b.amp));
  for (let i = 1; i < R.length; i++) {
    const a = R[i - 1], b = R[i], dy = b.by - a.by, v = a.k === 3 ? L.W.MOBBY_BOUNCE : V, ring = RING.find(r => r.before === i);
    if (ring) { // jump to the ring, then a fresh mid-air jump from the ring to the rock
      const d1 = Math.max(0, Math.hypot(ring.x - a.bx, ring.z - a.bz) - a.s / 2 - 1.2), r1 = reach(v, ring.y - 1 - a.by);
      const d2 = Math.max(0, Math.hypot(b.bx - ring.x, b.bz - ring.z) - b.s / 2), r2 = reach(V, b.by - (ring.y - 1));
      assert(r1 > d1 + 0.5, `ring before rock ${i} out of reach (${d1.toFixed(1)} vs ${r1.toFixed(1)})`); assert(r2 > d2 + 0.5, `rock ${i} out of reach from its ring`);
      assert(gapB(a, b) > reach(V, dy), `ring gap before rock ${i} can be done without the ring, make it longer`);
      worst.push([Math.min(r1 - d1, r2 - d2), i]);
    } else { const r = reach(v, dy), gp = gapB(a, b); assert(r > gp + 0.5, `rock ${i}: needs ${gp.toFixed(1)}m, max ${r.toFixed(1)}m`); worst.push([r - gp, i]); }
  }
  worst.sort((x, y) => x[0] - y[0]);
  console.log('        tightest moon jumps (spare metres → rock):', worst.slice(0, 4).map(w => w[0].toFixed(1) + '→#' + w[1]).join(', '));
  assert.deepEqual(R.filter(q => q.cp).map(q => q.i), [7, 14, 21, 28]);
  assert(R.filter(q => q.k === 3).length >= 2 && RING.length >= 3 && L.W.MKILL.length >= 2 && R.filter(q => q.bar).length >= 2);
  const s = L.fresh('a'); assert.equal(L.mobbyEnd(s, NOW, NOW - 20000).ok, false); assert.equal(L.mobbyEnd(s, NOW, NOW - 90000).dust, C.MOON.OBBY_DUST);
  assert.equal(L.mobbyEnd(s, NOW + 1000, NOW - 90000).dust, C.MOON.OBBY_REPEAT_DUST);
});
t('world data is valid (35 pets, gems, obby, stations)', () => {
  assert.equal(L.PETS.length, 49); assert(L.W.GEMS.length > 20); assert.equal(L.W.PL.length, 51); assert(L.W.STN.gems && L.W.STN.quests);
});
console.log(`\n${passed} logic tests passed` + (process.exitCode ? ' (with failures)' : ''));
