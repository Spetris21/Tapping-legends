// Pacing simulation: a bot plays with realistic tapping and prints when milestones happen.
// Run: node tests/sim.js   (change numbers in public/config.js, re-run, compare)
const L = require('../public/logic.js'), C = L.C;
const TPS = +(process.argv[2] || 5);   // average taps per second while playing (hold-to-tap is 6/s)
const HOURS = +(process.argv[3] || 6);
const rng = L.mulberry(+(process.argv[4] || 123));
const s = L.fresh('Sim');
let t0 = Date.UTC(2026, 9, 26, 0, 0, 0), now = t0, acc = {};
const marks = [], mark = (m) => marks.push([(now - t0) / 60000, m, L.fmt(L.perTap(s, { now }))]);
let firstEgg = false, hatchedHere = {};
s.daily.last = L.dayKey(now); s.q.day = L.dayKey(now);
for (let sec = 0; sec < HOURS * 3600; sec++) {
  now += 1000;
  const ev = L.events(now), ctx = { now, frenzy: !!ev.frenzy, lucky: !!ev.lucky, rate: TPS };
  L.tap(s, TPS, ctx);
  if (sec > 120 && sec % (C.WHEEL_COOLDOWN + 30) === 0) L.spin(s, now, ctx, rng);
  if (sec > 120 && sec % (C.CHEST_COOLDOWN + 60) === 0) L.chest(s, now, ctx);
  L.autoTick(s, 1, { now, onPad: false }, acc, rng);
  if (s.rb >= 1) s.auto.tap = true;
  // decisions
  if (s.taps >= L.rbCost(s)) { L.rebirth(s); hatchedHere = {}; mark('REBIRTH ' + s.rb); continue; }
  const best = Math.max(...s.open), next = C.AREAS[best + 1];
  if (next && s.rb >= next.rb && s.taps >= next.cost) { L.unlock(s, best + 1); mark('Unlocked ' + next.n); continue; }
  s.area = best;
  const a = C.AREAS[best], n = hatchedHere[best] || 0, limit = 30;
  if (n < limit && s.taps >= a.ec) {
    const r = L.hatch(s, 1, ctx, rng);
    if (r.ok) { hatchedHere[best] = n + 1; if (!firstEgg) { firstEgg = true; mark('First egg'); } }
  }
}
console.log(`Pacing sim: ${TPS} taps/sec, events on. Minutes of PLAY time (not real days).`);
console.log('min'.padStart(7), ' milestone'.padEnd(28), 'per tap');
for (const [m, txt, pt] of marks) console.log(m.toFixed(1).padStart(7), ' ' + txt.padEnd(27), pt);
console.log(`After ${HOURS}h: rebirths ${s.rb}, taps ${L.fmt(s.taps)}, hatched ${s.hatched}, legendaries ${s.legend}, per tap ${L.fmt(L.perTap(s, { now }))}`);

// ---------- NEBULA MOON: how long until the first Moon Egg after arriving? ----------
// Assumes a normal player catches 40% of meteors, grabs 30% of the Stardust pickups as they respawn,
// and does the moon obby once (it takes them about 2.5 minutes). Arrival time is random.
{
  const M = C.MOON, res = [];
  for (let run = 0; run < 200; run++) {
    const r = L.mulberry(1000 + run), m = L.fresh('Moon'); m.rocket = true;
    let now = t0 + Math.floor(r() * 3600) * 1000; const start = now, caught = {};
    let obbyDone = false, sec = 0;
    while (m.dust < M.EGGS[0].cost && sec < 3600) {
      now += 1000; sec++;
      const mi = L.meteorInfo(now);
      if (mi.active) for (const mt of L.meteors(mi.slot)) { const k = mi.slot + ':' + mt.i;
        if (caught[k] === undefined && now >= mt.land - 1000) { caught[k] = r() < 0.4; if (caught[k]) L.meteorCatch(m, mi.slot, mt.i, mt.land - 500, mt.x, mt.z); } }
      if (sec % 20 === 0) L.W.DUST.forEach((g, i) => { if (r() < 0.3 * 20 / M.DUST_RESPAWN * 1.5) L.dustPickup(m, i, now); });
      if (!obbyDone && sec === 150) { L.mobbyEnd(m, now, now - 150000); obbyDone = true; }
    }
    res.push((now - start) / 60000);
  }
  res.sort((a, b) => a - b);
  console.log(`\nNebula Moon: first ${M.EGGS[0].n} (${M.EGGS[0].cost} Stardust) after arriving: median ${res[100].toFixed(1)} min (fastest 10%: ${res[20].toFixed(1)}, slowest 10%: ${res[180].toFixed(1)})`);
}
