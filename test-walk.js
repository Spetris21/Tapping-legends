// Builds the real 3D world in Node (with a fake renderer) and walks a player along every path,
// using the same hitboxes as the game. Fails if anything solid blocks the way.
// Run: node tests/test-walk.js
global.self = global;
const noop = () => {};
const ctx2d = new Proxy({}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop: noop }) : noop, set: () => true });
global.document = { createElement: () => ({ getContext: () => ctx2d, width: 0, height: 0 }) };
require('../public/engine.js');
const L = require('../public/logic.js'), W = L.W;
global.TL = L;
require('../public/world.js');
const E = { M: self.TLEngine.M, G: self.TLEngine.G, addStatic: noop, buildStatic: noop, mesh: () => ({}), canvasTex: () => ({}), tex: () => ({}), draw: noop, particle: noop, far: 100 };
const WD = self.TLWorld(E, L); WD.build();
const grid = WD.colGrid, PR = 0.45;
let bad = 0, walks = 0; const fail = m => { bad++; console.log('  FAIL', m); };

// walk in a straight line from A to B the way the game moves a player, sliding along hitboxes
function walk(ax, az, bx, bz, label) {
  let x = ax, z = az; walks++;
  [x, z] = L.collide(grid, x, z, 0, PR);
  if (Math.hypot(x - ax, z - az) > 0.3) return fail(`${label}: the start point is inside something`);
  const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1);
  for (let i = 0; i < steps + 40; i++) {
    const dx = bx - x, dz = bz - z, d = Math.hypot(dx, dz); if (d < 0.15) return;
    const st = Math.min(0.1, d); [x, z] = L.collide(grid, x + dx / d * st, z + dz / d * st, 0, PR);
  }
  if (Math.hypot(bx - x, bz - z) > 0.6) fail(`${label}: got stuck at (${x.toFixed(1)}, ${z.toFixed(1)}), ${Math.hypot(bx - x, bz - z).toFixed(1)}m short`);
}
const near = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
// 1) every lobby path from spawn
for (const p of W.PATHS) walk(p.x1, p.z1, p.x2, p.z2, `path to (${p.x2}, ${p.z2})`);
walk(W.SPAWN[0], W.SPAWN[1], W.PLAZA.x, W.PLAZA.z, 'spawn to plaza');
// 2) every lobby station pad from the nearest point of the nearest path
for (const [k, st] of Object.entries(W.STN)) {
  if (k.startsWith('egg') || k.startsWith('gate') || ['rocket', 'rhome', 'megg0', 'megg1', 'dshop', 'shiny', 'mobby'].includes(k)) continue;
  let best = null, bd = 1e9;
  for (const p of W.PATHS) { const dx = p.x2 - p.x1, dz = p.z2 - p.z1, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((st.x - p.x1) * dx + (st.z - p.z1) * dz) / l2)), x = p.x1 + t * dx, z = p.z1 + t * dz, d = Math.hypot(st.x - x, st.z - z); if (d < bd) { bd = d; best = [x, z]; } }
  walk(best[0], best[1], st.x, st.z, `path to the ${k} pad`);
}
// 3) across every bridge to the island's egg pad
W.CEN.forEach((c, k) => { const b = W.BRG[k], v = b[0] === b[2]; const arrive = v ? [c[0], c[1] + (c[1] < 0 ? 14 : -14)] : [c[0] - 14, c[1]];
  walk(b[0], b[1], arrive[0], arrive[1], `bridge ${k}`); walk(arrive[0], arrive[1], W.STN['egg' + k].x, W.STN['egg' + k].z, `island ${k} egg pad`); });
// 4) into the rocket hangar
{ const H = W.HANGAR, door = [H.x, H.z - H.d / 2 - 3]; walk(W.CEN[4][0] - 14, W.CEN[4][1], door[0], door[1], 'space arrival to hangar door'); walk(door[0], door[1], W.STN.rocket.x, W.STN.rocket.z, 'hangar door to rocket pad'); }
// 5) on the moon: spawn to every moon station, jetpack and bounce pad
for (const k of ['rhome', 'megg0', 'megg1', 'dshop', 'shiny', 'mobby']) walk(W.MOON_SPAWN[0], W.MOON_SPAWN[1], W.STN[k].x, W.STN[k].z, `moon spawn to ${k}`);
for (const j of W.JETS.concat(W.BOUNCE)) walk(W.MOON_SPAWN[0], W.MOON_SPAWN[1], j.x, j.z, `moon spawn to pad (${j.x}, ${j.z})`);
// 6) the hitboxes really are solid: walking into the fountain stops you
{ const f = W.FOUNTAIN; let x = f.x - 8, z = f.z; for (let i = 0; i < 200; i++) [x, z] = L.collide(grid, x + 0.1, z, 0, PR); if (Math.hypot(x - f.x, z - f.z) < 3.3) fail('walked into the fountain'); }
console.log(bad ? `\n${bad} walk problems` : `  ok   ${walks} walks, ${WD.cols.length} hitboxes: every path, pad, bridge, the hangar and the moon are reachable; buildings are solid\n\nwalk test passed`);
process.exitCode = bad ? 1 : 0;
