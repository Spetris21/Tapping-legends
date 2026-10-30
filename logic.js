/* Tapping Legends - game rules.
   The SAME code runs on the server (for logged-in players, so nobody can cheat)
   and in the browser (for guests, who save locally).  Pure functions on a state object. */
(function (root) {
  const C = (typeof module !== 'undefined' && module.exports) ? require('./config.js') : root.TL_CONFIG;
  const L = {};
  L.C = C;

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  L.clamp = clamp;
  L.mulberry = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  L.hash = function (str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp'];
  L.fmt = function (n) {
    n = Math.floor(n || 0); if (n < 1000) return '' + n;
    const i = Math.min(Math.floor(Math.log10(n) / 3), SUF.length - 1);
    return (n / Math.pow(1000, i)).toFixed(2).replace(/\.?0+$/, '') + SUF[i];
  };

  // ---------- dates (daily quests, streaks, weekly board) ----------
  let fmtDay = null;
  L.dayKey = function (now) {
    try {
      fmtDay = fmtDay || new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
      return fmtDay.format(new Date(now));
    } catch (e) { return new Date(now).toISOString().slice(0, 10); }
  };
  L.weekKey = function (now) {
    const k = L.dayKey(now), d = new Date(k + 'T00:00:00Z'), wd = (d.getUTCDay() + 6) % 7;
    return new Date(d.getTime() - wd * 86400000).toISOString().slice(0, 10);
  };

  // ---------- pets ----------
  const PETS = [];
  C.AREAS.forEach((a, k) => C.RARITIES.forEach((r, i) => {
    PETS.push({ id: k * 7 + i, n: a.pets[i], e: a.e[i], col: a.col[i], r: i, a: k,
      p: Math.max(1, Math.round(a.b * r.m)), ab: C.ABILITIES[a.pets[i]] || null });
  }));
  // moon pets (ids 35-48): Moon Egg = world 5, Nebula Egg = world 6. Kept through rebirths.
  C.MOON.EGGS.forEach((g, e) => C.RARITIES.forEach((r, i) => {
    PETS.push({ id: 35 + e * 7 + i, n: g.pets[i], e: g.e[i], col: g.col[i], r: i, a: 5 + e, moon: true,
      p: Math.max(1, Math.round(g.b * r.m)), ab: C.ABILITIES[g.pets[i]] || null });
  }));
  L.PETS = PETS;
  L.WORLDS = C.AREAS.map(a => a.n).concat(C.MOON.EGGS.map(g => g.n)); // 7 pet collections
  // Shiny pets use id + 1000 and are twice as strong
  const SHINY = {};
  L.pet = id => {
    id = +id; if (id >= 1000) { const b = PETS[id - 1000]; if (!b) return undefined;
      return SHINY[id] || (SHINY[id] = Object.assign({}, b, { id, base: b.id, shiny: true, n: 'Shiny ' + b.n, p: b.p * C.MOON.SHINY_MULT })); }
    return PETS[id];
  };
  L.keeps = p => !!(p && (C.RARITIES[p.r].keep || p.moon));

  // ---------- world layout (shared so the server can sanity-check positions) ----------
  const W = {
    HUB: { x1: -45, x2: 45, z1: -39, z2: 36 },
    GARDEN: { x1: -58, x2: -46, z1: -7, z2: 7 },
    GATE_X: -45,
    CEN: [[-36, -83], [36, -83], [-36, 80], [36, 80], [95, -6]],
    IH: 18,
    BRG: [[-36, -39, -36, -65], [36, -39, 36, -65], [-36, 36, -36, 62], [36, 36, 36, 62], [45, -6, 77, -6]],
    GP: [[-36, -35], [36, -35], [-36, 32], [36, 32], [41, -6]],
    OB: 300,
    SPAWN: [0, 4],
    PLAZA: { x: 0, z: 2, r: 8 },
    // stations: the glowing pad is at x,z; the building stands just north of the pad (z - 1.6)
    STN: {
      map:    { x: -8,  z: -16, c: '#4fc3ff', l: 'WORLD MAP',     ico: '🗺️', r: 2.6 },
      reb:    { x: 8,   z: -16, c: '#c25cff', l: 'REBIRTH',       ico: '♻️', r: 3.3 },
      wheel:  { x: -36, z: 18,  c: '#ffd000', l: 'LUCKY WHEEL',   ico: '🎡', r: 2.6 },
      obby:   { x: 26,  z: 7,   c: '#ff7a2a', l: 'OBBY',          ico: '🏁', r: 2.9 },
      chest:  { x: 34,  z: -18, c: '#ffb300', l: 'TREASURE CHEST', ico: '💰', r: 2.6 },
      afk:    { x: -36, z: -18, c: '#2bff88', l: 'AUTO TAP PAD',  ico: '⚙️', r: 2.2 },
      gems:   { x: -26, z: 14,  c: '#3df5ff', l: 'GEM SHOP',      ico: '💎', r: 2.8 },
      quests: { x: 36,  z: 14,  c: '#ffe14d', l: 'DAILY QUESTS',  ico: '📜', r: 2.6 }
    },
    // decorations (circle footprints)
    PODIUM: { x: 0, z: -11.5, r: 3.6 },
    FOUNTAIN: { x: 0, z: -27, r: 3.5 },
    POND: { x: -24, z: -8, r: 5 },
    CAROUSEL: { x: 20, z: -30, r: 3.6 },
    TITLE: { x: 0, z: -37.2, r: 1.5 },
    JP: [[-36, -77, 22], [36, -77, 22], [36, -73, 22]], // jump pads [x,z,power]
    ROCKS: [[8, 4], [12, -2], [10, 9], [-8, 6], [-12, -3], [-9, -8]],
    BOSS: C.BOSS_POS,
    ARENA_R: 9.8
  };
  // footpaths (segments from the spawn plaza). Nothing may be built on these.
  W.PATHS = W.GP.map(p => ({ x1: W.PLAZA.x, z1: W.PLAZA.z, x2: p[0], z2: p[1], w: 3 }))
    .concat([{ x1: W.PLAZA.x, z1: W.PLAZA.z, x2: W.GATE_X, z2: 0, w: 3 }, { x1: W.PLAZA.x, z1: W.PLAZA.z, x2: W.BOSS[0], z2: W.BOSS[2], w: 4 }]);
  W.FOOT = Object.entries(W.STN).map(([k, s]) => ({ n: k, x: s.x, z: s.z - 1.6, r: s.r }))
    .concat(['PODIUM', 'FOUNTAIN', 'POND', 'CAROUSEL', 'TITLE'].map(k => Object.assign({ n: k.toLowerCase() }, W[k])));
  W.FOOT.push({ n: 'arena', x: W.BOSS[0], z: W.BOSS[2], r: W.ARENA_R, floor: true }); // walkable floor, the boss path leads onto it
  W.PILLARS = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; W.PILLARS.push([W.BOSS[0] + Math.cos(a) * 8.6, W.BOSS[2] + Math.sin(a) * 8.6]); }
  W.PILLARS.forEach((p, i) => W.FOOT.push({ n: 'pillar' + i, x: p[0], z: p[1], r: 0.75 }));
  L.pathDist = function (x, z) { // distance from a point to the nearest path edge (negative = on the path)
    let best = 1e9;
    for (const p of W.PATHS) {
      const dx = p.x2 - p.x1, dz = p.z2 - p.z1, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((x - p.x1) * dx + (z - p.z1) * dz) / l2));
      best = Math.min(best, Math.hypot(x - p.x1 - t * dx, z - p.z1 - t * dz) - p.w / 2);
    }
    return Math.min(best, Math.hypot(x - W.PLAZA.x, z - W.PLAZA.z) - W.PLAZA.r);
  };
  W.ROCKS = W.ROCKS.map(o => [W.CEN[2][0] + o[0], W.CEN[2][1] + o[1]]);
  W.LAVA = { x1: W.CEN[3][0] + 4, x2: W.CEN[3][0] + 16, z1: W.CEN[3][1] - 8, z2: W.CEN[3][1] + 8 };
  W.CEN.forEach((c, k) => {
    W.STN['egg' + k] = { x: c[0], z: c[1], c: '#4fe36b', l: C.AREAS[k].egg.toUpperCase(), ico: '🥚' };
    W.STN['gate' + k] = { x: W.GP[k][0], z: W.GP[k][1], c: '#ffd000', l: 'GATE: ' + C.AREAS[k].n.toUpperCase(), ico: '🔒' };
  });
  // gem pickup spots (same on server and client)
  {
    const r = L.mulberry(7), G = [];
    const free = (x, z) => W.FOOT.every(f => Math.hypot(x - f.x, z - f.z) > f.r + 1.5);
    for (let n = 0; n < 9;) { const x = W.HUB.x1 + 4 + r() * (W.HUB.x2 - W.HUB.x1 - 8), z = W.HUB.z1 + 4 + r() * (W.HUB.z2 - W.HUB.z1 - 8); if (free(x, z)) { G.push([x, z, 1.1]); n++; } }
    for (let i = 0; i < 10; i++) G.push([W.CEN[0][0] - 14 + r() * 28, W.CEN[0][1] - 12 + r() * 22, 1.1]);
    [[-4, 6], [4, 6], [-4, 10], [4, 10]].forEach(o => G.push([W.CEN[1][0] + o[0], W.CEN[1][1] + o[1], 8]));
    G.push([W.CEN[1][0], W.CEN[1][1] + 8, 10.5]);
    for (let i = 0; i < 8; i++) { const a = i * 0.785; G.push([W.CEN[4][0] + Math.cos(a) * 7, W.CEN[4][1] - 6 + Math.sin(a) * 6.5, 5 + (i % 2) * 1.5]); }
    W.GEMS = G;
  }
  // obby: 50 platforms in 6 sections, a checkpoint every 8 platforms.
  // types: 0 static, 1 slides sideways, 2 disappears after you stand on it, 3 moves up and down, 4 spinner (sweeping bar)
  // kill: 'h' kill brick covers half the platform, 'w' kill wall across the middle (jump it), 'm' sliding kill brick
  {
    const PL = [], KB = []; let X0 = W.OB, Z0 = 0, Y0 = 0, S0 = 3;
    const ROWS = [
      [2.4, 0, 0, 2.2, 0], [2.6, 1.6, 0.4, 2.0, 0], [2.8, -1.6, 0, 1.8, 0], [2.6, 0, 0.4, 2.4, 0, 'h'], [2.8, 1.2, 0, 1.8, 1], [2.6, -1.2, 0.4, 1.8, 0], [3.0, 0, 0, 1.6, 0], [2.6, 0, 0, 3.2, 0],
      [2.4, 0, 0.3, 1.8, 2], [2.4, 1.4, 0, 1.8, 2], [2.4, -1.4, 0.3, 1.8, 2], [2.6, 0, 0, 2.0, 3], [2.8, 0, 0.2, 2.0, 3], [2.6, 1.5, 0, 1.6, 2], [2.8, -1.5, 0.3, 2.6, 0, 'w'], [2.6, 0, 0, 3.2, 0],
      [2.4, 0, 0, 3.6, 4], [2.8, 1.5, 0.4, 1.4, 0], [3.0, -1.5, 0, 1.3, 0], [2.6, 0, 0.4, 3.0, 0, 'm'], [2.4, 0, 0, 3.6, 4], [3.0, 1.6, 0.3, 1.3, 0], [3.2, -1.6, -0.3, 1.3, 0], [2.6, 0, 0.2, 3.2, 0],
      [4.1, 0, -0.4, 1.8, 0], [3.9, 1.4, 0, 1.8, 1], [4.2, -1.4, -0.4, 1.6, 0], [3.5, 0, 0.4, 1.8, 1], [4.3, 0, -0.5, 1.6, 0], [3.4, 1.6, 0.3, 2.6, 0, 'h'], [4.1, -1.6, 0, 1.5, 0], [2.6, 0, 0, 3.2, 0],
      [2.6, 0, 0.3, 2.0, 3], [2.6, 0, 0.2, 1.8, 2], [2.6, 1.4, 0.2, 2.6, 0, 'm'], [2.8, -1.4, 0, 1.6, 2], [2.6, 0, 0.3, 2.0, 3], [3.0, 0, 0, 2.6, 0, 'w'], [3.2, 1.5, 0, 1.4, 2], [2.6, 0, 0.2, 3.2, 0],
      [3.6, 0, 0, 1.2, 0], [3.5, 1.6, 0.3, 1.2, 0], [2.4, 0, 0, 3.6, 4], [3.9, -1.6, -0.3, 1.2, 0], [3.3, 0, 0.3, 2.8, 0, 'm'], [3.9, 1.5, 0, 1.3, 1], [3.4, -1.5, 0.3, 1.2, 2], [4.1, 0, -0.3, 1.3, 0],
      [2.6, 0, 0.3, 2.0, 3], [3.0, 0, 0.3, 3.6, 0]
    ];
    const mk = (x, z, y, sz, k, i) => PL.push({ bx: x, bz: z, by: y, x, z, y, s: sz, k, cp: i % 8 === 0 && i < 48 ? 1 : 0, i,
      amp: k === 1 ? 2.2 : k === 3 ? 1.2 : 0, spd: 1 + (i % 3) * 0.3, ph: i * 1.7, dz: 0, dy: 0, t: 0, gone: 0,
      bar: k === 4 ? { r: sz / 2 - 0.05, h: 0.45, spd: (i % 2 ? 1.7 : -1.9) } : null });
    mk(X0, Z0, Y0, S0, 0, 0);
    ROWS.forEach((q, n) => {
      const i = n + 1; X0 += S0 / 2 + q[0] + q[3] / 2; Z0 += q[1]; Y0 += q[2]; S0 = q[3]; mk(X0, Z0, Y0, S0, q[4], i);
      const kind = q[5], P = PL[i];
      if (kind === 'h') { const side = (i % 2 ? 1 : -1); KB.push({ x: P.x, z: P.z + side * P.s / 4, y: P.y + 0.12, w: P.s, h: 0.3, d: P.s / 2, p: i }); }
      if (kind === 'w') KB.push({ x: P.x, z: P.z, y: P.y + 0.3, w: 0.3, h: 0.6, d: P.s, p: i });
      if (kind === 'm') KB.push({ x: P.x, z: P.z, y: P.y + 0.35, w: 0.7, h: 0.7, d: 0.7, p: i, slide: P.s / 2 - 0.4, spd: 2.2 + (i % 3) * 0.4, ph: i });
    });
    PL[PL.length - 1].cp = 1; PL[PL.length - 1].finish = 1;
    W.PL = PL; W.KILL = KB;
    W.OBBY_MINY = Math.min(...PL.map(p => p.by - p.amp));
    W.OBBY_LEN = PL.reduce((a, p, i) => i ? a + Math.hypot(p.x - PL[i - 1].x, p.z - PL[i - 1].z) : 0, 0);
  }
  // rocket hangar on the Space Station island: open-top building, door faces the island centre
  {
    const c = W.CEN[4];
    W.HANGAR = { x: c[0], z: c[1] + 12, w: 12, d: 10, h: 6, door: 4.4 };
    W.ROCKET = [c[0], c[1] + 14];
    W.STN.rocket = { x: c[0], z: c[1] + 9.2, c: '#ff7a2a', l: 'ROCKET', ico: '🚀' };
  }
  // ---------- NEBULA MOON (far away, reached by rocket) ----------
  {
    const MX = 0, MZ = -420;
    W.MOON = { x: MX, z: MZ, r: 38 };
    W.MOON_SPAWN = [MX, MZ + 29];
    Object.assign(W.STN, {
      rhome: { x: MX, z: MZ + 33, c: '#ff7a2a', l: 'ROCKET HOME', ico: '🚀' },
      megg0: { x: MX - 12, z: MZ + 19, c: '#b8a0ff', l: 'MOON EGG', ico: '🥚' },
      megg1: { x: MX + 12, z: MZ + 19, c: '#ff7af0', l: 'NEBULA EGG', ico: '🥚' },
      dshop: { x: MX - 24, z: MZ + 5, c: '#c08aff', l: 'STARDUST SHOP', ico: '✨' },
      shiny: { x: MX + 24, z: MZ + 5, c: '#ffd84a', l: 'SHINY MACHINE', ico: '🌟' },
      mobby: { x: MX, z: MZ - 4, c: '#7ad7ff', l: 'MOON OBBY', ico: '🪨' }
    });
    // floating platforms (reached by jetpack pads and bounce pads), each with stardust and a gem
    W.MPL = [{ x: MX - 26, z: MZ - 14, y: 9, s: 6 }, { x: MX + 26, z: MZ - 14, y: 11, s: 6 }, { x: MX - 29, z: MZ + 12, y: 15, s: 5 }, { x: MX + 29, z: MZ + 12, y: 15, s: 5 }];
    W.JETS = [{ x: MX - 15, z: MZ - 8, to: 0 }, { x: MX + 15, z: MZ - 8, to: 1 }];
    W.BOUNCE = [{ x: MX - 27, z: MZ + 19, v: 20 }, { x: MX + 27, z: MZ + 19, v: 20 }];
    W.DUST = [];
    W.MPL.forEach(q => { W.DUST.push([q.x - 1.4, q.z, q.y + 1.1], [q.x + 1.4, q.z, q.y + 1.1]); W.GEMS.push([q.x, q.z + 1.6, q.y + 1.2]); });
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.3; W.DUST.push([MX + Math.cos(a) * 17, MZ + Math.sin(a) * 17, 1.1]); }
    // moon obby: 29 floating rocks spiralling up around a giant crystal, 4 sections, checkpoint every 7.
    // rock kinds: 0 still, 1 slides back and forth, 2 vanishes after you stand on it, 3 bounce rock (launches you up)
    // extras: 'k' crystal kill spike on half the rock, 'm' sliding kill crystal, 's' spinning kill bar, 'r' a star ring before this rock
    //         (fly through a star ring to get one mid-air jump: you need it for the long gaps)
    const R = [], RINGS = [], MK = [], cx = MX, cz = MZ - 22; let a = Math.PI / 2, y = 1.2;
    W.MCRYSTAL = [cx, cz];
    const ROWS = [
      [0.62, 2.4, 2.4, 0], [0.64, 3.0, 2.0, 0], [0.66, 3.4, 1.9, 2], [0.62, 2.6, 2.6, 0, 'k'], [0.70, 3.2, 1.8, 0], [0.66, 3.6, 1.8, 2], [0.62, 2.0, 3.4, 0],
      [0.70, 2.6, 2.0, 1], [0.70, 2.8, 2.0, 1], [0.62, 2.4, 3.6, 0, 's'], [0.72, 3.0, 1.8, 1], [0.68, 3.2, 1.7, 2], [0.66, 2.6, 2.8, 0, 'm'], [0.62, 2.0, 3.4, 0],
      [0.62, 2.0, 2.4, 3], [0.80, 9.0, 2.0, 0], [1.80, 1.0, 1.8, 0, 'r'], [0.66, 3.0, 1.7, 2], [0.62, 2.0, 2.4, 3], [0.85, 9.5, 1.8, 1], [0.62, 2.0, 3.4, 0],
      [1.85, 0.5, 1.6, 0, 'r'], [0.70, 3.4, 1.5, 2], [0.62, 2.4, 3.6, 0, 's'], [0.74, 3.6, 1.4, 1], [1.90, 0.6, 1.5, 0, 'r'], [0.70, 3.2, 1.4, 2], [0.62, 2.6, 3.6, 0]
    ];
    const rad = i => i % 2 ? 12 : 10.5;
    const mk = (i, ang, yy, sz, k) => R.push({ i, ang, bx: cx + Math.cos(ang) * rad(i), bz: cz + Math.sin(ang) * rad(i), by: yy, x: cx + Math.cos(ang) * rad(i), z: cz + Math.sin(ang) * rad(i), y: yy, s: sz, k,
      amp: k === 1 ? 1.7 : 0, spd: 0.9 + (i % 3) * 0.25, ph: i * 1.3, dx: 0, dz: 0, t: 0, gone: 0, cp: i > 0 && i % 7 === 0 ? 1 : 0 });
    mk(0, a, y, 3.2, 0);
    ROWS.forEach((q, n) => {
      const i = n + 1, pa = a, py = y; a += q[0]; y += q[1]; mk(i, a, y, q[2], q[3]);
      const P = R[i], ex = q[4];
      if (ex === 'r') { const A = R[i - 1], m = 0.5; RINGS.push({ x: A.bx + (P.bx - A.bx) * m, z: A.bz + (P.bz - A.bz) * m, y: Math.max(A.by, P.by) + 2.2, before: i }); }
      if (ex === 'k') { const tx = -Math.sin(a), tz = Math.cos(a); MK.push({ x: P.x + tx * P.s / 4, z: P.z + tz * P.s / 4, y: P.y + 0.3, w: P.s / 2, h: 0.6, d: P.s / 2, p: i }); }
      if (ex === 'm') MK.push({ x: P.x, z: P.z, y: P.y + 0.4, w: 0.8, h: 0.8, d: 0.8, p: i, slide: P.s / 2 - 0.45, spd: 2 + (i % 3) * 0.4, ph: i, ang: a });
      if (ex === 's') P.bar = { r: P.s / 2 - 0.05, h: 0.5, spd: i % 2 ? 1.5 : -1.7 };
    });
    R[R.length - 1].finish = 1; R[R.length - 1].cp = 1;
    W.MROCK = R; W.MRING = RINGS; W.MKILL = MK;
    W.MOBBY_BOUNCE = 16; // launch speed of bounce rocks
  }
  L.W = W;
  L.near = (x, z, k, r) => { const s = W.STN[k]; return s && Math.hypot(x - s.x, z - s.z) < (r || 1.6); };
  L.inGarden = (x, z) => x >= W.GARDEN.x1 && x <= W.GARDEN.x2 && z >= W.GARDEN.z1 && z <= W.GARDEN.z2;
  L.inLava = (x, z) => x >= W.LAVA.x1 && x <= W.LAVA.x2 && z >= W.LAVA.z1 && z <= W.LAVA.z2;
  L.nearBoss = (x, z) => Math.hypot(x - W.BOSS[0], z - W.BOSS[2]) < C.BOSS_RANGE;
  L.onMoon = (x, z) => Math.hypot(x - W.MOON.x, z - W.MOON.z) < W.MOON.r + 4;

  // ---------- solid hitboxes (shared so tests can walk the paths) ----------
  // collider: {x,z,r,h} circle or {x,z,hw,hd,yaw,h} box. Pushes a player of radius pr out of anything shorter than... taller than their feet.
  L.colGrid = function (cols, cell) {
    cell = cell || 8; const g = { cell, m: {} };
    for (const c of cols) {
      const ext = c.r !== undefined ? c.r : Math.hypot(c.hw, c.hd);
      for (let i = Math.floor((c.x - ext) / cell); i <= Math.floor((c.x + ext) / cell); i++)
        for (let j = Math.floor((c.z - ext) / cell); j <= Math.floor((c.z + ext) / cell); j++) (g.m[i + ',' + j] = g.m[i + ',' + j] || []).push(c);
    }
    return g;
  };
  L.collide = function (g, x, z, y, pr) {
    const list = g.m[Math.floor(x / g.cell) + ',' + Math.floor(z / g.cell)]; if (!list) return [x, z];
    for (let pass = 0; pass < 2; pass++) for (const c of list) {
      if (y >= (c.h || 3) || y + 2.4 < (c.y0 || 0)) continue;
      if (c.r !== undefined) {
        const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz), m = c.r + pr;
        if (d < m) { if (d < 1e-4) { x += m; continue; } x = c.x + dx / d * m; z = c.z + dz / d * m; }
      } else {
        const cy = Math.cos(c.yaw || 0), sy = Math.sin(c.yaw || 0), dx = x - c.x, dz = z - c.z;
        let lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;           // into the box's local frame
        const ex = c.hw + pr, ez = c.hd + pr;
        if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
          if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = Math.sign(lx || 1) * ex; else lz = Math.sign(lz || 1) * ez;
          x = c.x + lx * cy + lz * sy; z = c.z - lx * sy + lz * cy;
        }
      }
    }
    return [x, z];
  };

  // ---------- state ----------
  L.fresh = function (name) {
    return {
      v: C.VERSION, name: name || 'Player', taps: 0, total: 0, clicks: 0, gems: 0, gemsTotal: 0,
      pets: {}, rb: 0, area: 0, open: [0], hatched: 0, time: 0, best: -1, legend: 0, secrets: 0, godlies: 0,
      obbies: 0, obbyBest: 0, bossHits: 0, bossWins: 0,
      look: { skin: C.LOOK.skin[0], shirt: C.LOOK.shirt[L.hash(name || 'Player') % C.LOOK.shirt.length], pants: C.LOOK.pants[0], hat: 'none' }, title: 'rookie',
      dust: 0, dustTotal: 0, rocket: false, rocketN: 0, mupg: { jump: 0, magnet: 0, dust: 0, helmet: 0 },
      index: {}, shinies: 0, meteors: 0, dustT: {}, meteorC: { slot: 0, ids: [] }, mobbyBest: 0, mobbyT: 0,
      upg: { tap: 0, luck: 0, speed: 0, magnet: 0, autotap: 0, slot: 0 },
      boost: { x2: 0, luck: 0, speed: 0 },
      wheel: 0, chest: 0, obbyGem: 0, gemT: {}, rockT: {}, gemHour: { h: 0, n: 0 },
      auto: { tap: false, hatch: false },
      daily: { last: '', streak: 0 }, q: { day: '', list: [] }
    };
  };
  L.migrate = function (s) {
    const f = L.fresh(s && s.name);
    if (!s || typeof s !== 'object' || s.v !== C.VERSION) return f;
    for (const k in f) if (s[k] === undefined || typeof s[k] !== typeof f[k]) s[k] = f[k];
    for (const k of ['upg', 'boost', 'auto', 'daily', 'q', 'gemHour', 'look', 'mupg', 'meteorC']) for (const j in f[k]) if (s[k][j] === undefined) s[k][j] = f[k][j];
    for (const id in s.pets) if (!L.pet(id) || !(s.pets[id] > 0)) delete s.pets[id];
    for (const id in s.pets) L.markIndex(s, id);
    if (!L.validLook(s.look, true)) s.look = f.look;
    s.open = s.open.filter(k => k >= 0 && k < C.AREAS.length); if (!s.open.includes(0)) s.open.unshift(0);
    if (!s.open.includes(s.area)) s.area = 0;
    return s;
  };

  // ---------- stats ----------
  L.slots = s => C.BASE_SLOTS + Math.min(s.rb * C.SLOTS_PER_REBIRTH, C.MAX_REBIRTH_SLOTS) + s.upg.slot;
  L.rbMult = s => 1 + C.REBIRTH_MULT * s.rb;
  L.rbCost = s => {
    if (s.rb === 0 && C.REBIRTH_FIRST) return C.REBIRTH_FIRST;
    const late = C.REBIRTH_LATE_FROM || 99, early = Math.min(s.rb, late);
    return C.REBIRTH_BASE * Math.pow(C.REBIRTH_GROWTH, early) * Math.pow(C.REBIRTH_LATE_GROWTH || C.REBIRTH_GROWTH, Math.max(0, s.rb - late));
  };
  L.equipped = function (s) {
    const ids = Object.keys(s.pets).map(Number).filter(id => s.pets[id] > 0 && L.pet(id)).sort((a, b) => L.pet(b).p - L.pet(a).p || b - a);
    const out = [], n = L.slots(s);
    for (const id of ids) { const p = L.pet(id); for (let i = 0; i < s.pets[id] && out.length < n; i++) out.push(p); if (out.length >= n) break; }
    return out;
  };
  L.abilities = function (s) {
    const a = { tap: 0, luck: 0, speed: 0, gem: 0, frenzy: 0, boss: 0, hatch: 0 };
    for (const p of L.equipped(s)) if (p.ab) a[p.ab.k] = Math.max(a[p.ab.k], p.ab.v);
    return a;
  };
  L.boostOn = (s, k, now) => (s.boost[k] || 0) > now;
  // ctx = { now, frenzy, lucky, vip, rate }
  L.perTap = function (s, ctx) {
    ctx = ctx || {}; const now = ctx.now || Date.now(), ab = L.abilities(s);
    let v = C.BASE_TAP + L.equipped(s).reduce((t, p) => t + p.p, 0);
    v *= L.rbMult(s) * (1 + 0.1 * s.upg.tap) * (1 + ab.tap) * (1 + C.INDEX_BONUS * L.worldsDone(s).length);
    if (L.boostOn(s, 'x2', now)) v *= 2;
    if (ctx.frenzy) v *= C.FRENZY_MULT * (1 + ab.frenzy);
    if (ctx.vip && s.clicks >= C.GARDEN_CLICKS) v *= C.GARDEN_MULT;
    return v;
  };
  L.combo = rate => C.COMBO_MAX * clamp(((rate || 0) - 3) / 7, 0, 1);
  L.luck = function (s, ctx) {
    ctx = ctx || {}; const now = ctx.now || Date.now();
    let l = 1 + 0.06 * s.upg.luck + (L.boostOn(s, 'luck', now) ? 0.5 : 0) + L.abilities(s).luck;
    if (ctx.lucky) l *= C.LUCKY_MULT;
    return Math.min(l, C.LUCK_CAP);
  };
  L.odds = function (luck) {
    const w = C.RARITIES.map((r, i) => r.w * (i >= C.LUCK_FROM ? luck : 1)), t = w.reduce((a, b) => a + b, 0);
    return w.map(x => x / t);
  };
  L.speed = (s, now) => 1 + 0.06 * s.upg.speed + (L.boostOn(s, 'speed', now || Date.now()) ? 0.3 : 0) + L.abilities(s).speed;
  L.magnet = s => 1.1 + 0.6 * s.upg.magnet;
  L.jumpMult = (s, moon) => moon ? 1 + 0.1 * s.mupg.jump : 1;
  L.markIndex = (s, id) => { id = +id; s.index[id >= 1000 ? id - 1000 : id] = 1; };
  // pet collections: a world is done when you have owned all of its Common..Legendary pets (ever, so rebirths don't undo it)
  L.worldsDone = function (s) {
    const out = [];
    for (let w = 0; w < L.WORLDS.length; w++) { let all = true; for (let i = 0; i <= 4; i++) if (!s.index[w * 7 + i]) { all = false; break; } if (all) out.push(w); }
    return out;
  };
  L.canAutoTap = s => s.rb >= C.AUTOTAP_REBIRTH;
  L.canAutoHatch = s => s.rb >= C.AUTOHATCH_REBIRTH;

  // ---------- quests ----------
  function qProg(s, id, n) {
    for (const q of s.q.list) if (q.id === id && !q.claimed) q.prog = Math.min(q.goal, q.prog + n);
  }
  L.qProg = qProg;

  // ---------- actions (all return {ok, err?, ...}) ----------
  const ok = (o) => Object.assign({ ok: true }, o || {});
  const no = (err) => ({ ok: false, err });
  L.give = function (s, taps, gems) {
    if (taps) { s.taps += taps; s.total += taps; }
    if (gems) { s.gems += gems; s.gemsTotal += gems; }
  };

  L.tap = function (s, n, ctx, auto) {
    const v = L.perTap(s, ctx) * (1 + (auto ? 0 : L.combo(ctx && ctx.rate))) * n;
    L.give(s, v, 0);
    if (!auto) { s.clicks += n; qProg(s, 'tap', n); }
    return v;
  };

  L.roll = function (area, luck, rng) {
    const o = L.odds(luck); let t = rng(), i = 0;
    for (; i < o.length - 1; i++) { t -= o[i]; if (t < 0) break; }
    return PETS[area * 7 + i];
  };

  L.hatch = function (s, n, ctx, rng) {
    n = n === 3 ? 3 : 1;
    const a = C.AREAS[s.area]; if (!a || !s.open.includes(s.area)) return no('That egg is locked');
    const cost = a.ec * n; if (s.taps < cost) return no('Not enough taps!');
    s.taps -= cost;
    const luck = L.luck(s, ctx), got = [];
    for (let i = 0; i < n; i++) {
      const p = L.roll(s.area, luck, rng);
      s.pets[p.id] = (s.pets[p.id] || 0) + 1; s.hatched++;
      if (p.r >= 4) s.legend++; if (p.r === 5) s.secrets++; if (p.r === 6) s.godlies++;
      if (s.best < 0 || !L.pet(s.best) || p.p > L.pet(s.best).p) s.best = p.id;
      L.markIndex(s, p.id); got.push(p.id);
    }
    qProg(s, 'hatch', n);
    return ok({ pets: got });
  };

  L.setArea = function (s, k) { if (!s.open.includes(k)) return no('Locked'); s.area = k; return ok(); };

  L.unlock = function (s, k) {
    const a = C.AREAS[k]; if (!a) return no('Unknown island');
    if (s.open.includes(k)) return ok({ already: true });
    if (s.rb < a.rb) return no('Needs ' + a.rb + ' rebirth' + (a.rb > 1 ? 's' : ''));
    if (s.taps < a.cost) return no('Not enough taps!');
    s.taps -= a.cost; s.open.push(k); s.area = k;
    return ok({ k });
  };

  L.rebirth = function (s) {
    const c = L.rbCost(s); if (s.taps < c) return no('Not enough taps!');
    const kept = {};
    for (const id in s.pets) if (L.keeps(L.pet(id))) kept[id] = s.pets[id];
    s.taps = 0; s.pets = kept; s.area = 0; s.open = [0]; s.rb++;
    if (s.best >= 0 && !kept[s.best]) s.best = -1;
    return ok({ rb: s.rb });
  };

  L.shopCost = function (s, item) {
    const l = s.upg[item.id] || 0;
    if (l >= item.max) return Infinity;
    return item.costs ? item.costs[l] : Math.round(item.cost * Math.pow(item.grow, l));
  };
  L.buy = function (s, id, now) {
    const item = C.SHOP.find(i => i.id === id);
    if (item) {
      if (item.rb && s.rb < item.rb) return no('Unlocks after ' + item.rb + ' rebirth');
      const c = L.shopCost(s, item); if (c === Infinity) return no('Maxed out!');
      if (s.gems < c) return no('Not enough gems');
      s.gems -= c; s.upg[id] = (s.upg[id] || 0) + 1;
      return ok({ id, lvl: s.upg[id] });
    }
    const b = C.BOOSTS.find(i => i.id === id); if (!b) return no('Unknown item');
    if (s.gems < b.cost) return no('Not enough gems');
    const cur = Math.max(now, s.boost[id] || 0);
    if (cur + b.secs * 1000 > now + C.BOOST_MAX_SECS * 1000) return no('Boost is already at the 60 minute max');
    s.gems -= b.cost; s.boost[id] = cur + b.secs * 1000;
    return ok({ id, until: s.boost[id] });
  };

  L.spin = function (s, now, ctx, rng) {
    if (s.wheel > now) return no('Wheel ready in ' + Math.ceil((s.wheel - now) / 1000) + 's');
    let t = rng() * 100, prize = C.WHEEL[0][1];
    for (const [w, p] of C.WHEEL) { t -= w; if (t < 0) { prize = p; break; } }
    const taps = prize.t ? prize.t * L.perTap(s, ctx) : 0, gems = prize.g || 0;
    L.give(s, taps, gems); s.wheel = now + C.WHEEL_COOLDOWN * 1000; qProg(s, 'wheel', 1);
    return ok({ taps, gems, big: (prize.t || 0) >= 400 || gems > 0 });
  };

  L.chest = function (s, now, ctx) {
    if (s.chest > now) return no('Chest opens in ' + Math.ceil((s.chest - now) / 1000) + 's');
    const taps = C.CHEST_TAP_REWARD * L.perTap(s, ctx);
    L.give(s, taps, C.CHEST_GEMS); s.chest = now + C.CHEST_COOLDOWN * 1000; qProg(s, 'chest', 1);
    return ok({ taps, gems: C.CHEST_GEMS });
  };

  L.gemPickup = function (s, i, now, rng) {
    if (!W.GEMS[i]) return no('No gem');
    if ((s.gemT[i] || 0) > now) return no('Gem respawning');
    const h = Math.floor(now / 3600000);
    if (s.gemHour.h !== h) s.gemHour = { h, n: 0 };
    s.gemT[i] = now + C.GEM_RESPAWN * 1000;
    if (C.GEM_PICKUP_CAP_HOUR > 0 && s.gemHour.n >= C.GEM_PICKUP_CAP_HOUR) return no('Gem limit reached for this hour');
    let g = C.GEM_PICKUP; const ab = L.abilities(s);
    if (ab.gem && rng() < ab.gem) g++;
    s.gemHour.n += g; L.give(s, 0, g); qProg(s, 'gem', 1);
    return ok({ gems: g, i });
  };

  L.rock = function (s, i, now, ctx) {
    if (!W.ROCKS[i]) return no('No rock');
    if ((s.rockT[i] || 0) > now) return no('Rock regrowing');
    s.rockT[i] = now + C.ROCK_COOLDOWN * 1000;
    const taps = C.ROCK_TAP_REWARD * L.perTap(s, ctx); L.give(s, taps, 0);
    return ok({ taps, i });
  };

  L.lava = function (s, ctx) { const taps = C.LAVA_TAP_REWARD * L.perTap(s, ctx); L.give(s, taps, 0); return ok({ taps }); };

  L.obbyEnd = function (s, now, startedAt, ctx) {
    if (!startedAt) return no('Start the obby first');
    if (now - startedAt < C.OBBY_MIN_SECONDS * 1000) return no('Too fast! Run it properly.');
    const taps = C.OBBY_TAP_REWARD * L.perTap(s, ctx); let gems = 0;
    if (s.obbyGem <= now) { gems = C.OBBY_GEMS; s.obbyGem = now + C.OBBY_GEM_COOLDOWN * 1000; }
    const secs = Math.round((now - startedAt) / 100) / 10, best = !s.obbyBest || secs < s.obbyBest;
    if (best) s.obbyBest = secs;
    L.give(s, taps, gems); s.obbies++; qProg(s, 'obby', 1);
    return ok({ taps, gems, secs, best });
  };

  L.bossHits = function (s, n) { s.bossHits += n; qProg(s, 'boss', n); };
  L.bossReward = function (s, win, hits, ctx) {
    if (win && hits >= C.BOSS_MIN_HITS) {
      const gems = C.BOSS_WIN_GEMS + L.abilities(s).boss, taps = C.BOSS_WIN_TAPS * L.perTap(s, ctx);
      L.give(s, taps, gems); s.bossWins++; return ok({ win: true, gems, taps, hits });
    }
    if (!win && hits >= C.BOSS_FAIL_MIN_HITS) {
      const taps = C.BOSS_FAIL_TAPS * L.perTap(s, ctx); L.give(s, taps, C.BOSS_FAIL_GEMS);
      return ok({ win: false, gems: C.BOSS_FAIL_GEMS, taps, hits });
    }
    return no(win ? 'Hit the boss at least ' + C.BOSS_MIN_HITS + ' times to earn the reward' : 'The boss escaped!');
  };

  // daily streak + quest refresh. Returns reward info when a new day starts.
  L.daily = function (s, now) {
    const key = L.dayKey(now); let res = null;
    if (s.daily.last !== key) {
      const y = L.dayKey(now - 86400000);
      s.daily.streak = s.daily.last === y ? s.daily.streak + 1 : 1;
      s.daily.last = key;
      const gems = C.STREAK_GEMS[Math.min(s.daily.streak, C.STREAK_GEMS.length) - 1];
      const taps = gems * 100 * L.perTap(s, { now });
      L.give(s, taps, gems); res = { streak: s.daily.streak, gems, taps };
    }
    if (s.q.day !== key) {
      const r = L.mulberry(L.hash(s.name + key)), pool = C.QUESTS.slice(), tier = Math.min(s.rb, 2), list = [];
      while (list.length < C.QUESTS_PER_DAY && pool.length) {
        const q = pool.splice(Math.floor(r() * pool.length), 1)[0];
        list.push({ id: q.id, goal: q.g[tier], prog: 0, claimed: false, gems: q.gems });
      }
      s.q = { day: key, list };
      ensureFuel(s);
    }
    return res;
  };
  function ensureFuel(s) {
    if (!s.rocket || !s.q.day || s.q.list.some(q => q.id === 'fuel')) return;
    const F = C.MOON.FUEL_QUEST; s.q.list.push({ id: 'fuel', goal: F.goal, prog: 0, claimed: false, gems: F.gems, dust: F.dust });
  }
  L.questText = q => {
    if (q.id === 'fuel') return 'Collect ' + q.goal + ' Stardust (rocket fuel) 🚀'; const d = C.QUESTS.find(x => x.id === q.id); return d ? d.n.replace('{g}', L.fmt(q.goal)) : q.id; };
  L.claimQuest = function (s, i, ctx) {
    const q = s.q.list[i]; if (!q) return no('No quest');
    if (q.claimed) return no('Already claimed');
    if (q.prog < q.goal) return no('Not finished yet');
    q.claimed = true; const taps = C.QUEST_TAP_REWARD * L.perTap(s, ctx);
    L.give(s, taps, q.gems); if (q.dust) L.giveDust(s, q.dust); return ok({ gems: q.gems, taps, dust: q.dust || 0 });
  };

  L.setAuto = function (s, k, on) {
    if (k === 'tap' && on && !L.canAutoTap(s)) return no('Auto-tapper unlocks after ' + C.AUTOTAP_REBIRTH + ' rebirth');
    if (k === 'hatch' && on && !L.canAutoHatch(s)) return no('Auto-hatch unlocks after ' + C.AUTOHATCH_REBIRTH + ' rebirths');
    if (k !== 'tap' && k !== 'hatch') return no('?');
    s.auto[k] = !!on; return ok({ k, on: !!on });
  };

  // auto tapper / AFK pad / auto hatch. acc is a runtime object {t,h} (not saved).
  L.autoTick = function (s, dt, ctx, acc, rng) {
    const out = { taps: 0, pets: [] };
    if (L.canAutoTap(s)) {
      let rate = 0;
      if (ctx.onPad) rate = C.AFK_PAD_RATE + s.upg.autotap;
      else if (s.auto.tap) rate = C.AUTOTAP_RATE + s.upg.autotap;
      acc.t = (acc.t || 0) + rate * dt;
      const n = Math.floor(acc.t);
      if (n > 0) { acc.t -= n; out.taps = L.tap(s, n, ctx, true); out.n = n; }
    } else acc.t = 0;
    if (L.canAutoHatch(s) && s.auto.hatch) {
      acc.h = (acc.h || 0) + dt * (1 + L.abilities(s).hatch);
      if (acc.h >= C.AUTOHATCH_EVERY) {
        acc.h = 0;
        const r = L.hatch(s, 1, ctx, rng);
        if (r.ok) out.pets = r.pets;
      }
    }
    return out;
  };

  // ---------- rocket, stardust, moon ----------
  L.giveDust = function (s, n) { if (n > 0) { s.dust += n; s.dustTotal += n; qProg(s, 'fuel', n); } };
  L.buyRocket = function (s) {
    if (s.rocket) return ok({ already: true });
    if (s.rb < C.ROCKET_RB) return no('The rocket needs ' + C.ROCKET_RB + ' rebirths');
    if (s.taps < C.ROCKET_TAPS) return no('Not enough taps! The rocket costs ' + L.fmt(C.ROCKET_TAPS));
    s.taps -= C.ROCKET_TAPS; s.rocket = true; s.rocketN = 1; ensureFuel(s);
    return ok({ bought: true });
  };
  L.mhatch = function (s, e, n, ctx, rng) {
    if (!s.rocket) return no('Buy the rocket first');
    const egg = C.MOON.EGGS[e]; if (!egg) return no('No such egg');
    n = n === 3 ? 3 : 1; const cost = egg.cost * n; if (s.dust < cost) return no('Not enough Stardust!');
    s.dust -= cost; const luck = L.luck(s, ctx), got = [];
    for (let i = 0; i < n; i++) {
      const p = L.roll(5 + e, luck, rng); s.pets[p.id] = (s.pets[p.id] || 0) + 1; s.hatched++;
      if (p.r >= 4) s.legend++; if (p.r === 5) s.secrets++; if (p.r === 6) s.godlies++;
      if (s.best < 0 || !L.pet(s.best) || p.p > L.pet(s.best).p) s.best = p.id;
      L.markIndex(s, p.id); got.push(p.id);
    }
    qProg(s, 'hatch', n);
    return ok({ pets: got, egg: e });
  };
  L.mshopCost = (s, it) => { const l = s.mupg[it.id] || 0; return l >= it.max ? Infinity : Math.round(it.cost * Math.pow(it.grow, l)); };
  L.mbuy = function (s, id) {
    const it = C.MOON.SHOP.find(x => x.id === id); if (!it) return no('Unknown item');
    if (!s.rocket) return no('Buy the rocket first');
    const c = L.mshopCost(s, it); if (c === Infinity) return no('Maxed out!');
    if (s.dust < c) return no('Not enough Stardust');
    s.dust -= c; s.mupg[id] = (s.mupg[id] || 0) + 1; return ok({ id, lvl: s.mupg[id] });
  };
  // meteor showers: every client and the server work out the same meteors from the clock
  L.meteorSlot = now => Math.floor(now / 1000 / C.MOON.METEOR_EVERY);
  L.meteorInfo = function (now) {
    const slot = L.meteorSlot(now), start = slot * C.MOON.METEOR_EVERY * 1000, t = (now - start) / 1000;
    return { slot, start, active: t < C.MOON.METEOR_SECS + C.MOON.METEOR_FALL, next: start + C.MOON.METEOR_EVERY * 1000, ends: start + (C.MOON.METEOR_SECS + C.MOON.METEOR_FALL) * 1000 };
  };
  const meteorCache = {};
  L.meteors = function (slot) {
    if (meteorCache[slot]) return meteorCache[slot];
    const r = L.mulberry(slot * 7919 + 11), M = C.MOON, start = slot * M.METEOR_EVERY * 1000, out = [];
    for (let i = 0; i < M.METEORS; i++) {
      const t0 = r() * (M.METEOR_SECS - M.METEOR_FALL), a = r() * 6.283, d = Math.sqrt(r()) * 29;
      out.push({ i, spawn: start + t0 * 1000, land: start + (t0 + M.METEOR_FALL) * 1000, x: W.MOON.x + Math.cos(a) * d, z: W.MOON.z + Math.sin(a) * d });
    }
    const keys = Object.keys(meteorCache); if (keys.length > 6) delete meteorCache[keys[0]];
    return (meteorCache[slot] = out);
  };
  L.catchR = s => C.MOON.CATCH_R + 0.6 * s.mupg.magnet;
  L.meteorCatch = function (s, slot, i, now, px, pz) {
    if (!s.rocket) return no('Buy the rocket first');
    const m = L.meteors(slot)[i]; if (!m) return { ok: false, quiet: 1 };
    if (now < m.land - 2500 || now > m.land + 600) return { ok: false, quiet: 1 };
    if (Math.hypot(px - m.x, pz - m.z) > L.catchR(s) + 0.6) return { ok: false, quiet: 1 };
    if (s.meteorC.slot !== slot) s.meteorC = { slot, ids: [] };
    if (s.meteorC.ids.includes(i)) return { ok: false, quiet: 1 };
    s.meteorC.ids.push(i); const n = C.MOON.METEOR_DUST + s.mupg.dust;
    L.giveDust(s, n); s.meteors++;
    return ok({ dust: n, i });
  };
  L.dustPickup = function (s, i, now) {
    if (!W.DUST[i] || !s.rocket) return { ok: false, quiet: 1 };
    if ((s.dustT[i] || 0) > now) return { ok: false, quiet: 1 };
    s.dustT[i] = now + C.MOON.DUST_RESPAWN * 1000; L.giveDust(s, C.MOON.DUST_PICKUP);
    return ok({ dust: C.MOON.DUST_PICKUP, i });
  };
  L.mobbyEnd = function (s, now, startedAt) {
    if (!startedAt) return no('Start the moon obby first');
    if (now - startedAt < C.MOON.OBBY_MIN_SECONDS * 1000) return no('Too fast! Run it properly.');
    const secs = Math.round((now - startedAt) / 100) / 10, best = !s.mobbyBest || secs < s.mobbyBest; if (best) s.mobbyBest = secs;
    let dust = C.MOON.OBBY_REPEAT_DUST; if (s.mobbyT <= now) { dust = C.MOON.OBBY_DUST; s.mobbyT = now + C.MOON.OBBY_COOLDOWN * 1000; }
    L.giveDust(s, dust); return ok({ dust, secs, best });
  };
  L.fuse = function (s, id) {
    id = +id; const p = PETS[id]; if (!p || id >= 1000) return no('That pet cannot be fused');
    if ((s.pets[id] || 0) < C.MOON.FUSE_COUNT) return no('You need ' + C.MOON.FUSE_COUNT + ' of the same pet');
    s.pets[id] -= C.MOON.FUSE_COUNT; if (s.pets[id] <= 0) delete s.pets[id];
    const sid = id + 1000; s.pets[sid] = (s.pets[sid] || 0) + 1; s.shinies++;
    if (s.best < 0 || !L.pet(s.best) || L.pet(sid).p > L.pet(s.best).p) s.best = sid;
    return ok({ id: sid });
  };
  // ---------- looks + titles ----------
  L.validLook = function (look, helmet) {
    if (!look || typeof look !== 'object') return null; const P = C.LOOK;
    if (!P.skin.includes(look.skin) || !P.shirt.includes(look.shirt) || !P.pants.includes(look.pants)) return null;
    const h = P.hats.find(x => x.id === look.hat); if (!h || (h.moon && !helmet)) return null;
    return { skin: look.skin, shirt: look.shirt, pants: look.pants, hat: look.hat };
  };
  L.setLook = function (s, look) { const v = L.validLook(look, s.mupg.helmet > 0); if (!v) return no('That look is locked'); s.look = v; return ok({ look: v }); };
  L.statVal = (s, k) => k === 'worlds' ? L.worldsDone(s).length : k === 'rocketN' ? (s.rocket ? 1 : 0) : (s[k] || 0);
  L.titleOk = (s, t) => !!t && L.statVal(s, t.stat) >= t.need;
  L.setTitle = function (s, id) { const t = C.TITLES.find(x => x.id === id); if (!L.titleOk(s, t)) return no('Earn that title first'); s.title = id; return ok({ title: id }); };
  L.titleName = id => { const t = C.TITLES.find(x => x.id === id); return t ? t.n : ''; };

  // ---------- events schedule (minute of the hour) ----------
  L.events = function (now) {
    const hs = (now / 1000) % 3600, res = { frenzy: 0, lucky: 0, boss: 0, next: null };
    const check = (mins, key) => {
      for (const m of mins) {
        const st = m * 60;
        if (hs >= st && hs < st + C.EVENT_SECS) res[key] = now + (st + C.EVENT_SECS - hs) * 1000;
        let until = st - hs; if (until <= 0) until += 3600;
        if (!res.next || until * 1000 < res.next.in) res.next = { k: key, in: until * 1000, at: now + until * 1000 };
      }
    };
    check(C.FRENZY_MINUTES, 'frenzy'); check(C.LUCKY_MINUTES, 'lucky'); check(C.BOSS_MINUTES, 'boss');
    return res;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = L;
  else root.TL = L;
})(typeof self !== 'undefined' ? self : this);
