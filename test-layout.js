// Checks the lobby layout: no building, decoration or tree on a footpath, nothing overlapping, all inside the island.
// Run: node tests/test-layout.js
const L = require('../public/logic.js'), W = L.W;
let bad = 0; const fail = m => { bad++; console.log('  FAIL', m); };
const MARGIN = 0.5, H = W.HUB;
for (const f of W.FOOT) {
  if (f.floor) continue;
  const d = L.pathDist(f.x, f.z) - f.r;
  if (d < MARGIN) fail(`${f.n} is ${d < 0 ? 'ON' : 'too close to'} a path (gap ${d.toFixed(2)}m)`);
  if (f.x - f.r < H.x1 + 1 || f.x + f.r > H.x2 - 1 || f.z - f.r < H.z1 + 0.3 || f.z + f.r > H.z2 - 1) fail(`${f.n} sticks out of the lobby`);
}
for (let i = 0; i < W.FOOT.length; i++) for (let j = i + 1; j < W.FOOT.length; j++) {
  const a = W.FOOT[i], b = W.FOOT[j]; if ((a.floor && b.n.startsWith('pillar')) || (b.floor && a.n.startsWith('pillar'))) continue; const d = Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r;
  if (d < 1) fail(`${a.n} and ${b.n} overlap (gap ${d.toFixed(2)}m)`);
}
// every station pad must be reachable (not inside another footprint)
for (const [k, s] of Object.entries(W.STN)) {
  if (k.startsWith('egg') || k.startsWith('gate')) continue;
  for (const f of W.FOOT) if (f.n !== k && Math.hypot(s.x - f.x, s.z - f.z) < f.r) fail(`${k} pad is inside ${f.n}`);
}
// every path is walkable end to end (sample points stay inside the lobby or the bridge mouth)
for (const p of W.PATHS) for (let t = 0; t <= 1; t += 0.02) {
  const x = p.x1 + (p.x2 - p.x1) * t, z = p.z1 + (p.z2 - p.z1) * t;
  for (const f of W.FOOT) if (Math.hypot(x - f.x, z - f.z) < f.r + p.w / 2 && !f.floor) fail(`path to (${p.x2},${p.z2}) runs into ${f.n}`);
}
// bridges start where the gates are
W.GP.forEach((g, k) => { const b = W.BRG[k]; if (Math.hypot(g[0] - b[0], g[1] - b[1]) > 5) fail('gate ' + k + ' is not at its bridge'); });
console.log(bad ? `\n${bad} layout problems` : `  ok   ${W.FOOT.length} buildings/decorations, ${W.PATHS.length} paths: nothing on a path, nothing overlapping\n\nlayout test passed`);
process.exitCode = bad ? 1 : 0;
module.exports = { MARGIN };
