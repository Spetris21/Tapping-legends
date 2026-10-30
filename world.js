/* Tapping Legends - the 3D world: islands, stations, signs, characters, pets and the Tap Titan boss. */
(function (root) {
  'use strict';
  root.TLWorld = function (E, L) {
    const M = E.M, G = E.G, C = L.C, W = L.W, T = M.trs, mul = M.mul;
    const S = (geo, m, col, tex, ck) => E.addStatic(geo, m, col, tex, ck);
    const WD = {};
    let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const shade = (hex, k) => { const c = M.col(hex); return c.map(v => Math.max(0, Math.min(1, v * k))); };

    // ---------- shared meshes ----------
    const geo = {
      rb: G.box(1, 1, 1, 0.16), rb2: G.box(1, 1, 1, 0.3), box: G.box(1, 1, 1, 0), sph: G.sphere(0.5, 16, 10), sphLo: G.sphere(0.5, 10, 7),
      cyl: G.cyl(0.5, 0.5, 1, 14), cone: G.cyl(0, 0.5, 1, 12), quad: G.quad(1, 1), disc: G.disc(0.5, 24),
      torus: G.torus(1, 0.12, 32, 8), egg: G.egg(0.5, 1.2, 18), gem: G.lathe([[0, -0.55], [0.38, 0], [0.24, 0.22], [0, 0.32]], 6, false),
      ico: G.ico(0.5, 0.25, 3), ring: G.torus(1, 0.05, 40, 6)
    };
    const ms = {}; for (const k in geo) ms[k] = E.mesh(geo[k]);
    WD.ms = ms;
    const D = (mesh, m, col, o) => E.draw(mesh, m, col, o);

    // ---------- canvas textures ----------
    function canvas(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function signTex(text, sub, col, ico) {
      return E.canvasTex(canvas(512, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff'); gr.addColorStop(0.08, col); gr.addColorStop(1, shadeHex(col, 0.55));
        rr(g, 8, 8, w - 16, h - 16, 34); g.fillStyle = '#2a1a0a'; g.fill();
        rr(g, 18, 18, w - 36, h - 36, 28); g.fillStyle = gr; g.fill();
        g.globalAlpha = 0.18; g.fillStyle = '#fff'; for (let i = -4; i < 14; i++) { g.beginPath(); g.moveTo(i * 50, 18); g.lineTo(i * 50 + 25, 18); g.lineTo(i * 50 - 60, h); g.lineTo(i * 50 - 85, h); g.fill(); } g.globalAlpha = 1;
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
        let fs = 74; g.font = `900 ${fs}px "Outfit","Trebuchet MS",Arial Black,sans-serif`;
        const full = (ico ? ico + ' ' : '') + text; while (g.measureText(full).width > w - 70 && fs > 30) { fs -= 4; g.font = `900 ${fs}px "Outfit","Trebuchet MS",Arial Black,sans-serif`; }
        const y = sub ? h * 0.42 : h * 0.52;
        g.lineWidth = 12; g.strokeStyle = '#1a0d00'; g.strokeText(full, w / 2, y); g.fillStyle = '#fff'; g.fillText(full, w / 2, y);
        if (sub) { g.font = `800 34px "Outfit","Trebuchet MS",Arial,sans-serif`; g.lineWidth = 7; g.strokeText(sub, w / 2, h * 0.74); g.fillStyle = '#fff6c0'; g.fillText(sub, w / 2, h * 0.74); }
      }));
    }
    function shadeHex(h, k) { const c = shade(h, k); return 'rgb(' + c.map(v => v * 255 | 0).join(',') + ')'; }
    function padTex(col, ico) {
      return E.canvasTex(canvas(256, 256, (g, w) => {
        const gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, col + 'ee'); gr.addColorStop(0.62, col + 'aa'); gr.addColorStop(0.8, col + 'ff'); gr.addColorStop(0.86, '#ffffffff'); gr.addColorStop(0.92, col + 'cc'); gr.addColorStop(1, col + '00');
        g.fillStyle = gr; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
        g.strokeStyle = '#ffffffaa'; g.lineWidth = 5; g.setLineDash([16, 12]); g.beginPath(); g.arc(128, 128, 88, 0, 7); g.stroke(); g.setLineDash([]);
        g.font = '92px "Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ico, 128, 136);
      }));
    }
    const clampN = (v, a, b) => v < a ? a : v > b ? b : v;
    const faceTexO = E.canvasTex(canvas(128, 128, (g) => {
      g.fillStyle = '#1a1a1a'; for (const x of [42, 86]) { g.beginPath(); g.ellipse(x, 52, 10, 17, 0, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; for (const x of [45, 89]) { g.beginPath(); g.arc(x, 45, 4, 0, 7); g.fill(); }
      g.fillStyle = '#1a1a1a'; g.beginPath(); g.ellipse(64, 86, 11, 14, 0, 0, 7); g.fill();
    }));
    const faceTex = E.canvasTex(canvas(128, 128, (g) => {
      g.fillStyle = '#1a1a1a'; for (const x of [42, 86]) { g.beginPath(); g.ellipse(x, 56, 9, 15, 0, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; for (const x of [45, 89]) { g.beginPath(); g.arc(x, 50, 4, 0, 7); g.fill(); }
      g.strokeStyle = '#1a1a1a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.arc(64, 74, 20, 0.25, Math.PI - 0.25); g.stroke();
    }));
    const petFaceTex = E.canvasTex(canvas(128, 128, (g) => {
      g.fillStyle = '#ff7aa8aa'; for (const x of [28, 100]) { g.beginPath(); g.ellipse(x, 80, 12, 8, 0, 0, 7); g.fill(); }
      g.fillStyle = '#111'; for (const x of [42, 86]) { g.beginPath(); g.ellipse(x, 62, 13, 16, 0, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; for (const x of [47, 91]) { g.beginPath(); g.arc(x, 55, 6, 0, 7); g.fill(); g.beginPath(); g.arc(x - 9, 69, 3, 0, 7); g.fill(); }
      g.strokeStyle = '#111'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(56, 82); g.quadraticCurveTo(60, 88, 64, 82); g.quadraticCurveTo(68, 88, 72, 82); g.stroke();
    }));
    const wheelTex = E.canvasTex(canvas(256, 256, (g) => {
      for (let i = 0; i < 12; i++) { g.fillStyle = `hsl(${i * 30},90%,58%)`; g.beginPath(); g.moveTo(128, 128); g.arc(128, 128, 124, i / 12 * 6.283, (i + 1) / 12 * 6.283); g.fill(); }
      g.strokeStyle = '#fff'; g.lineWidth = 3; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(i / 12 * 6.283) * 124, 128 + Math.sin(i / 12 * 6.283) * 124); g.stroke(); }
      g.lineWidth = 10; g.strokeStyle = '#ffd84a'; g.beginPath(); g.arc(128, 128, 120, 0, 7); g.stroke();
      g.fillStyle = '#ffd84a'; g.beginPath(); g.arc(128, 128, 22, 0, 7); g.fill(); g.fillStyle = '#b07800'; g.font = '900 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 128, 129);
    }));
    const globeTex = E.canvasTex(canvas(256, 128, (g) => {
      g.fillStyle = '#2e8fe8'; g.fillRect(0, 0, 256, 128); g.fillStyle = '#5ad15a';
      for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(rnd() * 256, 20 + rnd() * 88, 8 + rnd() * 22, 5 + rnd() * 12, rnd() * 3, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 8); g.fillRect(0, 120, 256, 8);
    }), true);
    const runeTex = E.canvasTex(canvas(256, 256, (g) => {
      g.strokeStyle = '#ff5ad1'; g.lineWidth = 6; g.shadowColor = '#ff5ad1'; g.shadowBlur = 14;
      g.beginPath(); g.arc(128, 128, 116, 0, 7); g.stroke(); g.beginPath(); g.arc(128, 128, 84, 0, 7); g.stroke();
      for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; g.beginPath(); g.moveTo(128 + Math.cos(a) * 84, 128 + Math.sin(a) * 84); g.lineTo(128 + Math.cos(a + 2.094) * 84, 128 + Math.sin(a + 2.094) * 84); g.stroke(); }
      g.font = '900 28px serif'; g.fillStyle = '#ffb3f0'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const R = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃ'; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.fillText(R[i], 128 + Math.cos(a) * 100, 128 + Math.sin(a) * 100); }
    }));
    const flagTex = E.canvasTex(canvas(128, 64, (g) => { for (let x = 0; x < 8; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); } }));
    const eggTex = C.AREAS.map(a => E.canvasTex(canvas(256, 256, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#fff'); gr.addColorStop(1, a.sky[0]); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 20; i++) { g.fillStyle = i % 2 ? a.g : a.col[4]; g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 10 + rnd() * 18, 0, 7); g.fill(); }
      g.fillStyle = '#fff8'; g.fillRect(0, 118, 256, 20);
    }), true));
    WD.eggTex = eggTex;

    // ---------- signs & pads ----------
    // ---------- solid hitboxes ----------
    const cols = []; WD.cols = cols;
    const colC = (x, z, r, h) => cols.push({ x, z, r, h: h || 3 });
    const colB = (x, z, w, d, yaw, h) => cols.push({ x, z, hw: w / 2, hd: d / 2, yaw: yaw || 0, h: h || 3 });
    WD.colC = colC; WD.colB = colB;
    const HG = W.HANGAR, inHangar = (x, z, m) => Math.abs(x - HG.x) < HG.w / 2 + (m || 1.5) && Math.abs(z - HG.z) < HG.d / 2 + (m || 1.5);
    const signs = [], pads = [];
    function sign(text, sub, col, x, z, yaw, w, h, y, ck, ico, noPost) {
      w = w || 3.6; h = h || 1.8; y = y === undefined ? 2.4 : y;
      if (!noPost) {
        const off = w / 2 - 0.2, cy = Math.cos(yaw), sy = Math.sin(yaw);
        for (const s of [-1, 1]) S(geo.cyl, T(x + s * off * cy, (y - h / 2) / 2, z - s * off * sy, 0, 0, 0, 0.2, y - h / 2 + 0.2, 0.2), '#7a4e2a', 'wood', ck);
      }
      S(geo.rb, T(x, y, z, yaw, 0, 0, w + 0.25, h + 0.25, 0.22), '#5a3818', 'wood', ck);
      if (!noPost) colB(x, z, w + 0.2, 0.45, yaw, y + h / 2);
      const tex = signTex(text, sub, col, ico);
      signs.push({ tex, x, y, z, yaw, w, h, text, args: [text, sub, col, ico] });
      return signs[signs.length - 1];
    }
    WD.signs = signs;
    WD.refreshSigns = () => signs.forEach(sg => { if (sg.args) sg.tex = signTex(sg.args[0], sg.args[1], sg.args[2], sg.args[3]); });
    WD.setSign = (sg, text, sub, col, ico) => { if (sg.text === text + sub) return; sg.text = text + sub; sg.tex = signTex(text, sub, col, ico); };
    for (const k in W.STN) { const s = W.STN[k]; pads.push({ k, x: s.x, z: s.z, tex: padTex(s.c, s.ico), c: s.c }); }

    // ---------- floating island builder ----------
    function island(cx, cz, w, d, top, side, ck, tex) {
      S(G.box(w, 1.2, d, 0.55), T(cx, -0.6, cz), top, tex, ck);
      S(G.box(w - 0.5, 2.8, d - 0.5, 0.7), T(cx, -2.3, cz), side, 'dirt', ck);
      const rock = shade(side, 0.75);
      [[0.88, 3.4, -5.1], [0.68, 4, -8.6], [0.45, 4.4, -12.6], [0.22, 4.6, -16.6]].forEach(([f, h, y], i) =>
        S(G.box(w * f, h, d * f, 1.4), T(cx + (rnd() - 0.5) * 2, y, cz + (rnd() - 0.5) * 2), shade(side, 0.82 - i * 0.08), 'rock', ck));
      for (let i = 0; i < 10; i++) {
        const a = rnd() * 6.283, r = 0.35 + rnd() * 0.15, sz = 1.5 + rnd() * 2.5;
        S(geo.ico, T(cx + Math.cos(a) * w * r, -4 - rnd() * 8, cz + Math.sin(a) * d * r, rnd() * 6, 0, 0, sz * 1.6, sz * 2.2, sz * 1.6), rock, 'rock', ck);
      }
      // grassy lip / overhang tufts
      for (let i = 0; i < Math.floor((w + d) / 3); i++) {
        const t = rnd(), edge = rnd() * 4 | 0, sz = 0.7 + rnd() * 0.8;
        const px = edge < 2 ? cx - w / 2 + t * w : cx + (edge === 2 ? -w / 2 : w / 2), pz = edge < 2 ? cz + (edge === 0 ? -d / 2 : d / 2) : cz - d / 2 + t * d;
        S(geo.ico, T(px, -0.7, pz, rnd() * 6, 0, 0, sz * 1.4, sz, sz * 1.4), shade(typeof top === 'string' ? top : '#6cc04a', 0.9), tex, ck);
      }
    }
    function tree(x, z, ck, s, kind) {
      s = s || 1; colC(x, z, 0.45 * s + 0.1, 6);
      if (kind === 'gold') { S(geo.cyl, T(x, 0.9 * s, z, 0, 0, 0, 0.35 * s, 1.8 * s, 0.35 * s), '#8a5a10', 'wood', ck); S(geo.rb2, T(x, 2.4 * s, z, rnd() * 3, 0, 0, 1.8 * s), '#ffd84a', 'white', ck); return; }
      S(geo.cyl, T(x, 0.9 * s, z, 0, 0, 0, 0.4 * s, 1.8 * s, 0.4 * s), '#7a4a22', 'wood', ck);
      const g1 = ['#3da34a', '#4cb84f', '#2f9440'][rnd() * 3 | 0];
      S(geo.ico, T(x, 2.5 * s, z, rnd() * 6, 0, 0, 2.6 * s, 2.2 * s, 2.6 * s), g1, 'grass', ck);
      S(geo.ico, T(x + 0.4 * s, 3.5 * s, z - 0.2 * s, rnd() * 6, 0, 0, 1.8 * s, 1.6 * s, 1.8 * s), shade(g1, 1.12), 'grass', ck);
      S(geo.ico, T(x - 0.5 * s, 3.0 * s, z + 0.4 * s, rnd() * 6, 0, 0, 1.4 * s), shade(g1, 0.95), 'grass', ck);
    }
    function bush(x, z, ck, col) { const s = 0.7 + rnd() * 0.6; S(geo.ico, T(x, 0.35 * s, z, rnd() * 6, 0, 0, 1.4 * s, 1 * s, 1.4 * s), col || '#3fae4a', 'grass', ck); }
    function flower(x, z, ck) {
      const c = ['#ff5d8f', '#ffd000', '#ffffff', '#b04bff', '#ff9a4d', '#5ec8ff'][rnd() * 6 | 0];
      S(geo.cyl, T(x, 0.2, z, 0, 0, 0, 0.05, 0.4, 0.05), '#2f8a3a', 'white', ck);
      S(geo.sphLo, T(x, 0.45, z, 0, 0, 0, 0.26, 0.14, 0.26), c, 'white', ck);
      S(geo.sphLo, T(x, 0.5, z, 0, 0, 0, 0.1), '#ffe14d', 'white', ck);
    }
    function lamp(x, z, ck) { S(geo.cyl, T(x, 1.6, z, 0, 0, 0, 0.16, 3.2, 0.16), '#3a3f4a', 'metal', ck); S(geo.rb, T(x, 3.3, z, 0, 0, 0, 0.55, 0.15, 0.55), '#3a3f4a', 'metal', ck); lamps.push([x, 3.05, z]); colC(x, z, 0.25, 4); }
    const lamps = [];
    function fenceLine(x1, z1, x2, z2, ck, gaps) {
      const len = Math.hypot(x2 - x1, z2 - z1), n = Math.round(len / 2.5), yaw = Math.atan2(x2 - x1, z2 - z1);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
        if (gaps.some(g => Math.hypot(x - g[0], z - g[1]) < g[2])) continue;
        S(geo.rb, T(x, 0.55, z, yaw, 0, 0, 0.28, 1.1, 0.28), '#f2e6d0', 'wood', ck);
        if (i < n) { const t2 = (i + 0.5) / n, mx = x1 + (x2 - x1) * t2, mz = z1 + (z2 - z1) * t2;
          if (!gaps.some(g => Math.hypot(mx - g[0], mz - g[1]) < g[2] + 1.2)) for (const y of [0.45, 0.85]) S(geo.box, T(mx, y, mz, yaw, 0, 0, 0.12, 0.14, len / n), '#e8dcc4', 'wood', ck); }
      }
    }
    function path(x1, z1, x2, z2, w, ck, col) {
      const len = Math.hypot(x2 - x1, z2 - z1), yaw = Math.atan2(x2 - x1, z2 - z1);
      S(G.box(w, 0.1, len, 0.04), T((x1 + x2) / 2, 0.03, (z1 + z2) / 2, yaw), col || '#bfb7a5', 'tile', ck);
    }

    // ============================================================ ISLAND DETAIL PASS
    WD.anim = { mills: [], weeds: [], falls: [], blinks: [], holos: [], roids: [], cotton: [], flies: [], embers: [], cascades: [] };
    function detail(k, cx, cz, ck) {
      const A = C.AREAS[k], R = W.IH, br = W.BRG[k], vb = br[0] === br[2];
      const entry = vb ? [br[2], br[3]] : [br[2], br[3]];          // where the bridge meets the island
      const corridor = (x, z, m) => { // the walk from the bridge to the egg pad stays clear
        const dx = cx - entry[0], dz = cz - entry[1], l2 = dx * dx + dz * dz, t2 = Math.max(0, Math.min(1, ((x - entry[0]) * dx + (z - entry[1]) * dz) / l2));
        return Math.hypot(x - entry[0] - t2 * dx, z - entry[1] - t2 * dz) < 3.5 + m; };
      const HG = W.HANGAR;
      const free = (x, z, r) => Math.abs(x - cx) < R - r - 0.6 && Math.abs(z - cz) < R - r - 0.6 && Math.hypot(x - cx, z - cz) > 8 + r && !corridor(x, z, r) &&
        W.GEMS.every(g => Math.hypot(x - g[0], z - g[1]) > r + 1.6) && W.JP.every(j => Math.hypot(x - j[0], z - j[1]) > r + 2.5) &&
        !(k === 2 && (W.ROCKS.some(q => Math.hypot(x - q[0], z - q[1]) < r + 2.5) || Math.hypot(x - (cx - 10), z - (cz - 12)) < r + 4.5)) &&
        !(k === 3 && (Math.hypot(x - (cx - 12), z - (cz - 12)) < r + 4.5 || (x > W.LAVA.x1 - r - 2 && x < W.LAVA.x2 + r + 2 && z > W.LAVA.z1 - r - 2 && z < W.LAVA.z2 + r + 2))) &&
        !(k === 4 && (Math.abs(x - HG.x) < HG.w / 2 + r + 2 && Math.abs(z - HG.z) < HG.d / 2 + r + 3 || [[-5, -10], [5, -10], [12, -12]].some(o => Math.hypot(x - cx - o[0], z - cz - o[1]) < r + 2.6)));
      const tryPlace = (r, fn, tries) => { for (let i = 0; i < (tries || 30); i++) { const x = cx - R + 2 + rnd() * (R * 2 - 4), z = cz - R + 2 + rnd() * (R * 2 - 4); if (free(x, z, r)) { fn(x, z); return [x, z]; } } return null; };
      const spot = (pref, r, fn) => { for (const [ox, oz] of pref) { const x = cx + ox, z = cz + oz; if (free(x, z, r)) { fn(x, z); return true; } } return !!tryPlace(r, fn, 60); };
      // ---- underside: hanging roots / crystals, and a few small floating islets around the island for depth
      for (let i = 0; i < 18; i++) { const a = rnd() * 6.283, px = cx + Math.cos(a) * R * (0.7 + rnd() * 0.25), pz = cz + Math.sin(a) * R * (0.7 + rnd() * 0.25), h = 1.5 + rnd() * 3.5;
        S(G.cyl(0.18 + rnd() * 0.25, 0, h, 5), T(px, -1.2 - h / 2, pz, rnd() * 3), k === 4 ? '#7ad7ff' : k === 3 ? '#ff6a2a' : k === 1 ? '#ff9ad5' : '#5a8a3a', k === 4 || k === 3 ? 'white' : 'grass', ck); }
      for (let i = 0; i < 4; i++) { const a = i * 1.57 + rnd(), d = R + 9 + rnd() * 8, ix = cx + Math.cos(a) * d, iz = cz + Math.sin(a) * d, iy = -4 + rnd() * 9, sz = 2.2 + rnd() * 1.8;
        if (W.BRG.some(b => Math.min(Math.abs(ix - b[0]), Math.abs(ix - b[2])) < 6 && Math.min(Math.abs(iz - b[1]), Math.abs(iz - b[3])) < 40 && (b[0] === b[2] ? Math.abs(ix - b[0]) < 7 : Math.abs(iz - b[1]) < 7))) continue;
        S(G.box(sz * 2, 0.8, sz * 2, 0.4), T(ix, iy, iz, a), A.g, A.tex, ck); S(geo.ico, T(ix, iy - 1.6, iz, a, 0, 0, sz * 1.8, 2.6, sz * 1.8), shade(A.side, 0.8), 'rock', ck);
        if (k === 0 || k === 2) tree(ix, iz, ck, 0.7, k === 2 ? null : null), cols.pop(); }
      // ---- ground cover: grass tufts (or pebbles on sand / rock / metal)
      for (let i = 0; i < 110; i++) { const x = cx - R + 1 + rnd() * (R * 2 - 2), z = cz - R + 1 + rnd() * (R * 2 - 2); if (corridor(x, z, -1.5) || Math.hypot(x - cx, z - cz + 2) < 6) continue;
        if (k === 3 && L.inLava(x, z)) continue;
        if (k === 0 || k === 1) { const col = k ? ['#ff8ac8', '#ffd0ea', '#c8f0ff'][i % 3] : ['#4cb84f', '#62c858', '#3a9e44'][i % 3]; for (let j = 0; j < 3; j++) S(G.cyl(0, 0.07, 0.5 + rnd() * 0.35, 3), T(x + (rnd() - 0.5) * 0.3, 0.25, z + (rnd() - 0.5) * 0.3, rnd() * 3, (rnd() - 0.5) * 0.5, (rnd() - 0.5) * 0.5), col, 'white', ck); }
        else S(geo.ico, T(x, 0.05, z, rnd() * 6, 0, 0, 0.25 + rnd() * 0.3, 0.15, 0.25 + rnd() * 0.3), k === 2 ? '#c8a060' : k === 3 ? '#3a2a2a' : '#7a849c', 'rock', ck); }

      if (k === 0) { // ===== SPAWN PLAINS: windmill, cottage, haystacks, pond, waterfall, butterflies
        spot([[12, -11], [-12, -11], [12, 8]], 3, (x, z) => {
          S(G.cyl(1.1, 1.7, 7, 8), T(x, 3.5, z), '#f2e6d0', 'wood', ck); S(G.cyl(0, 1.6, 2.2, 8), T(x, 8.1, z), '#c0392b', 'wood', ck);
          S(G.box(0.9, 1.4, 0.2, 0.05), T(x, 0.7, z + 1.5), '#6b4a2b', 'wood', ck); for (const yy of [3, 5.2]) S(G.box(0.6, 0.6, 0.15, 0.05), T(x, yy, z + 1.35), '#7ad7ff', 'white', ck);
          colC(x, z, 1.7, 9); WD.anim.mills.push([x, 6.6, z + 1.35]); });
        spot([[-12, 9], [12, 9], [-12, -10]], 3.2, (x, z) => {
          S(G.box(4.4, 2.6, 3.6, 0.12), T(x, 1.3, z), '#fff3d6', 'wood', ck);
          S(G.box(5, 0.3, 4.2, 0.1), T(x, 2.75, z), '#8a5a2e', 'wood', ck);
          for (const sd of [-1, 1]) S(G.box(5, 0.25, 2.6, 0.08), T(x, 3.55, z + sd * 1.0, 0, sd * 0.62, 0), '#c0392b', 'wood', ck);
          S(G.box(0.9, 1.5, 0.15, 0.05), T(x, 0.75, z + 1.82), '#6b4a2b', 'wood', ck); for (const sd of [-1, 1]) S(G.box(0.8, 0.7, 0.12, 0.05), T(x + sd * 1.4, 1.5, z + 1.82), '#9fdcff', 'white', ck);
          S(G.box(0.5, 1.3, 0.5, 0.05), T(x + 1.4, 4, z - 0.6), '#7a7a7a', 'rock', ck); colB(x, z, 4.6, 3.8, 0, 4.5); });
        for (let i = 0; i < 3; i++) tryPlace(1.1, (x, z) => { S(G.cyl(0.95, 1.05, 1.2, 12), T(x, 0.6, z), '#e8c860', 'grass', ck); S(G.cyl(0, 0.95, 0.5, 12), T(x, 1.45, z), '#d8b850', 'grass', ck); colC(x, z, 1.05, 1.7); });
        spot([[-11, -2], [11, -2], [0, -12]], 3.4, (x, z) => { for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; S(geo.ico, T(x + Math.cos(a) * 3.1, 0.15, z + Math.sin(a) * 2.4, a, 0, 0, 0.8, 0.45, 0.7), '#9aa0a8', 'rock', ck); } WD.anim.ponds = (WD.anim.ponds || []).concat([[x, z, 2.9, 2.2]]); colC(x, z, 2.6, 0.6); });
        WD.anim.cascades.push([cx - R - 0.2, cz + 6, 'x']);
        WD.anim.flies.push([cx, cz, R - 2]);
      }
      if (k === 1) { // ===== CANDY MEADOW: gingerbread house, candy cane arches, chocolate river, gumdrops, cotton candy clouds
        spot([[12, -11], [-12, -11], [12, 9]], 3.4, (x, z) => {
          S(G.box(4.6, 2.8, 3.8, 0.25), T(x, 1.4, z), '#b5651d', 'white', ck);
          for (const sd of [-1, 1]) { S(G.box(5.2, 0.35, 2.7, 0.15), T(x, 3.6, z + sd * 1.05, 0, sd * 0.65, 0), '#ffffff', 'white', ck); S(G.box(5.0, 0.18, 2.5, 0.08), T(x, 3.75, z + sd * 1.0, 0, sd * 0.65, 0), '#ff6fae', 'candy', ck); }
          S(G.box(1, 1.6, 0.2, 0.2), T(x, 0.8, z + 1.95), '#ff5d8f', 'white', ck); for (const sd of [-1, 1]) S(G.cyl(0.4, 0.4, 0.12, 12), T(x + sd * 1.4, 1.6, z + 1.95, 0, Math.PI / 2, 0), '#7fd8ff', 'white', ck);
          for (let i = 0; i < 6; i++) S(geo.sphLo, T(x - 2 + i * 0.8, 0.12, z + 1.95, 0, 0, 0, 0.32), ['#ff5d8f', '#ffd000', '#7dff6a'][i % 3], 'white', ck);
          colB(x, z, 4.8, 4, 0, 4.5); });
        for (let i = 0; i < 3; i++) tryPlace(1.6, (x, z) => { const a = rnd() * 3; for (const sd of [-1, 1]) { const px = x + Math.cos(a) * sd * 1.5, pz = z + Math.sin(a) * sd * 1.5;
          for (let j = 0; j < 6; j++) S(G.cyl(0.2, 0.2, 0.5, 10), T(px, 0.25 + j * 0.5, pz), j % 2 ? '#ffffff' : '#e8202a', 'white', ck); colC(px, pz, 0.3, 3); }
          S(G.torus(1.5, 0.2, 16, 8), T(x, 3, z, -a, Math.PI / 2, 0, 1, 1, 1), '#e8202a', 'white', ck); });
        const rv = spot([[-11, 3], [11, 3], [0, 12]], 2.8, (x, z) => { S(G.box(5.4, 0.12, 5.4, 0.6), T(x, 0.02, z), '#8a5a3a', 'white', ck); WD.anim.choco = [x, z]; colC(x, z, 2.4, 0.5); });
        for (let i = 0; i < 9; i++) tryPlace(0.8, (x, z) => { S(G.sphere(0.7, 12, 6), T(x, 0, z, 0, 0, 0, 1, 1.1, 1), ['#ff3d6e', '#7dff6a', '#ffd000', '#b388ff', '#4fc3ff'][i % 5], 'white', ck); colC(x, z, 0.7, 0.8); });
        for (let i = 0; i < 4; i++) WD.anim.cotton.push([cx - 12 + rnd() * 24, 6 + rnd() * 4, cz - 12 + rnd() * 24, rnd() * 6]);
      }
      if (k === 2) { // ===== DUSTY DESERT: oasis + palms, sandstone arch, obelisk, bones, tumbleweeds
        spot([[11, -11], [-11, 10], [11, 11]], 4, (x, z) => {
          S(G.cyl(3, 3, 0.1, 24), T(x, 0.02, z), '#e8d090', 'sand', ck); WD.anim.oasis = [x, z];
          for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.4, px = x + Math.cos(a) * 3.4, pz = z + Math.sin(a) * 3.4; palm(px, pz, ck, a); }
          colC(x, z, 2.6, 0.6); });
        spot([[-12, 6], [12, -3], [-3, -12]], 2.5, (x, z) => { for (const sd of [-1, 1]) { S(G.box(1.2, 4.2, 1.6, 0.3), T(x + sd * 2, 2.1, z), '#d89a58', 'sand', ck); colB(x + sd * 2, z, 1.2, 1.6, 0, 4.4); }
          S(G.box(5.2, 1.2, 1.6, 0.4), T(x, 4.6, z), '#d08a48', 'sand', ck); });
        spot([[12, 12], [-12, -2], [4, 13]], 1.2, (x, z) => { S(G.box(1.6, 0.6, 1.6, 0.05), T(x, 0.3, z), '#b08850', 'sand', ck); S(G.cyl(0.25, 0.65, 6, 4), T(x, 3.6, z, 0.78), '#e8c070', 'sand', ck); S(G.cyl(0, 0.3, 0.8, 4), T(x, 7, z, 0.78), '#ffd84a', 'metal', ck); colC(x, z, 0.9, 7); });
        for (let i = 0; i < 4; i++) tryPlace(1, (x, z) => { S(geo.sphLo, T(x, 0.2, z, 0, 0, 0, 0.55, 0.45, 0.6), '#f4ecdc', 'white', ck); for (let j = 0; j < 3; j++) S(G.cyl(0.07, 0.07, 1, 6), T(x + 0.6 + j * 0.25, 0.08, z + (j - 1) * 0.3, 0, 0, Math.PI / 2), '#f4ecdc', 'white', ck); });
        for (let i = 0; i < 3; i++) WD.anim.weeds.push({ cx, cz, R: R - 3, ph: rnd() * 6, sp: 0.18 + rnd() * 0.1 });
      }
      if (k === 3) { // ===== MAGMA VOLCANO: lava falls, obsidian pillars, glowing cracks, embers
        WD.anim.falls.push([cx - 12, cz - 12]);
        for (let i = 0; i < 6; i++) tryPlace(0.9, (x, z) => { const h = 2.5 + rnd() * 3; S(G.cyl(0.5, 0.8, h, 6), T(x, h / 2, z, rnd()), '#1a1024', 'white', ck); S(G.cyl(0, 0.5, 1, 6), T(x, h + 0.5, z, rnd()), '#2a1834', 'white', ck); colC(x, z, 0.8, h + 1); });
        for (let i = 0; i < 12; i++) { const x = cx - R + 3 + rnd() * (R * 2 - 6), z = cz - R + 3 + rnd() * (R * 2 - 6); if (corridor(x, z, 0) || L.inLava(x, z)) continue; WD.anim.cracks = (WD.anim.cracks || []).concat([[x, z, rnd() * 3, 1.5 + rnd() * 2]]); }
        WD.anim.embers.push([cx, cz, R]);
      }
      if (k === 4) { // ===== SPACE STATION: antennas with blinking lights, solar panels, hologram planet, asteroids, crates
        spot([[-12, 3], [-12, -12], [12, 3]], 1, (x, z) => { S(G.cyl(0.12, 0.3, 9, 6), T(x, 4.5, z), '#c0c8d8', 'metal', ck); for (const yy of [3, 6]) S(G.box(1.6, 0.1, 0.1, 0.02), T(x, yy, z), '#c0c8d8', 'metal', ck); colC(x, z, 0.5, 9); WD.anim.blinks.push([x, 9.1, z]); });
        spot([[12, 6], [-12, 8], [-11, -6]], 1, (x, z) => { S(G.cyl(0.1, 0.25, 6, 6), T(x, 3, z), '#c0c8d8', 'metal', ck); colC(x, z, 0.4, 6); WD.anim.blinks.push([x, 6.1, z]); });
        for (let i = 0; i < 3; i++) tryPlace(1.8, (x, z) => { const a = rnd() * 3; S(G.box(0.25, 1.2, 0.25, 0.02), T(x, 0.6, z), '#9aa6c0', 'metal', ck);
          S(G.box(3.2, 0.08, 1.8, 0.02), T(x, 1.3, z, a, -0.5, 0), '#1a3a8a', 'metal', ck); S(G.box(3.3, 0.06, 1.9, 0.02), T(x, 1.27, z, a, -0.5, 0), '#c0c8d8', 'white', ck); colB(x, z, 1.2, 1.2, a, 1.6); });
        for (let i = 0; i < 5; i++) tryPlace(0.8, (x, z) => { const h = 0.8 + rnd() * 0.4; S(G.box(h, h, h, 0.06), T(x, h / 2, z, rnd()), ['#e8a020', '#5a6a8a', '#c0c8d8'][i % 3], 'metal', ck); colB(x, z, h, h, 0, h); });
        spot([[0, -13], [-10, -13], [10, 13]], 1.6, (x, z) => { S(G.cyl(1.5, 1.7, 0.4, 20), T(x, 0.2, z), '#3a3f4a', 'metal', ck); colC(x, z, 1.6, 0.5); WD.anim.holos.push([x, 3, z]); });
        for (let i = 0; i < 7; i++) WD.anim.roids.push([cx, cz, R + 4 + rnd() * 10, 3 + rnd() * 10, rnd() * 6, 0.05 + rnd() * 0.1, 0.6 + rnd() * 1.4]);
      }
    }
    function palm(x, z, ck, a) {
      let px = x, py = 0, pz = z; const lean = 0.18, dx = Math.cos(a) * lean, dz = Math.sin(a) * lean;
      for (let i = 0; i < 7; i++) { S(G.cyl(0.24 - i * 0.015, 0.28 - i * 0.015, 0.8, 8), T(px, py + 0.4, pz, i), i % 2 ? '#a07040' : '#8a5a30', 'wood', ck); px += dx * (1 + i * 0.25); pz += dz * (1 + i * 0.25); py += 0.76; }
      for (let i = 0; i < 7; i++) { const b = i / 7 * 6.283; S(G.box(0.5, 0.08, 2.6, 0.04), T(px + Math.cos(b) * 1.1, py + 0.1, pz + Math.sin(b) * 1.1, -b + Math.PI / 2, 0.45, 0), i % 2 ? '#3e9e4a' : '#2f8a3a', 'grass', ck); }
      for (let i = 0; i < 3; i++) S(geo.sphLo, T(px + (i - 1) * 0.25, py - 0.15, pz, 0, 0, 0, 0.26), '#6b4a2b', 'white', ck);
      colC(x, z, 0.35, 6);
    }

    // ============================================================ ROCKET HANGAR (Space Station island)
    const moonEggTex = C.MOON.EGGS.map((g, e) => E.canvasTex(canvas(256, 256, (gx) => {
      const gr = gx.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, e ? '#ff7af0' : '#8a7aff'); gx.fillStyle = gr; gx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 40; i++) { gx.fillStyle = i % 3 ? '#ffffffcc' : '#3a1a6a'; gx.beginPath(); gx.arc(rnd() * 256, rnd() * 256, 2 + rnd() * (i % 3 ? 5 : 14), 0, 7); gx.fill(); }
    }), true));
    const planetTex = E.canvasTex(canvas(256, 128, (gx) => {
      for (let y = 0; y < 128; y += 4) { gx.fillStyle = `hsl(${280 + Math.sin(y * 0.15) * 30 + rnd() * 10},70%,${45 + Math.sin(y * 0.3) * 15}%)`; gx.fillRect(0, y, 256, 4); }
      gx.fillStyle = '#ffffff22'; for (let i = 0; i < 8; i++) { gx.beginPath(); gx.ellipse(rnd() * 256, rnd() * 128, 20 + rnd() * 30, 4 + rnd() * 5, 0, 0, 7); gx.fill(); }
    }), true);
    WD.moonEggs = [];
    function buildHangar(ck) {
      const H = W.HANGAR, x0 = H.x - H.w / 2, x1 = H.x + H.w / 2, z0 = H.z - H.d / 2, z1 = H.z + H.d / 2, t = 0.5, wc = '#c8d0e0';
      S(G.box(H.w, 0.14, H.d, 0.05), T(H.x, 0.04, H.z), '#7a849c', 'metal', ck);
      const wall = (x, z, w, d) => { S(G.box(w, H.h, d, 0.08), T(x, H.h / 2, z), wc, 'metal', ck); S(G.box(w + 0.05, 0.5, d + 0.05, 0.05), T(x, H.h - 0.35, z), '#ff7a2a', 'white', ck); colB(x, z, w, d, 0, H.h); };
      wall(H.x, z1, H.w, t); wall(x0, H.z, t, H.d); wall(x1, H.z, t, H.d);
      const seg = (H.w - H.door) / 2; wall(x0 + seg / 2, z0, seg, t); wall(x1 - seg / 2, z0, seg, t);
      S(G.box(H.door + 0.6, 0.8, t + 0.1, 0.05), T(H.x, H.h - 0.4, z0), '#ffcc33', 'metal', ck);
      // launch pad + gantry
      const R = W.ROCKET;
      S(G.cyl(2.6, 2.8, 0.35, 32), T(R[0], 0.17, R[1]), '#3a3f4a', 'metal', ck);
      for (let i = 0; i < 8; i++) S(G.box(0.5, 0.06, 2.4, 0.02), T(R[0], 0.36, R[1], i * Math.PI / 4), i % 2 ? '#111' : '#ffd000', 'white', ck);
      S(G.box(0.9, 9, 0.9, 0.1), T(R[0] + 3.4, 4.5, R[1] + 1), '#9aa6c0', 'metal', ck); colB(R[0] + 3.4, R[1] + 1, 0.9, 0.9, 0, 9);
      for (const y of [3, 6]) S(G.box(2.4, 0.25, 0.4, 0.05), T(R[0] + 2.3, y, R[1] + 1), '#9aa6c0', 'metal', ck);
      colC(R[0], R[1], 1.8, 14);
      WD.hangarSign = sign('ROCKET HANGAR', C.ROCKET_RB + ' rebirths + ' + L.fmt(C.ROCKET_TAPS) + ' taps', '#e8541a', H.x, z0 - 0.3, 0, 4.6, 1.3, H.h + 1, ck, '🚀', true);
    }
    // a rocket on its pad that lifts off when a launch from this pad is running
    WD.launchRocket = function (x, y0, z, sc, lt, t, V) {
      const rise = lt > 2 ? (lt - 2) * (lt - 2) * 5 : 0, shake = lt > 1 && lt < 3 ? (Math.random() - 0.5) * 0.12 : 0;
      WD.rocket(x + shake, y0 + rise, z + shake, t, lt > 1.2, sc);
      if (lt > 1.2 && lt < 4.2 && V.parts) for (let i = 0; i < 4; i++) { const a = Math.random() * 6.283, sp = 3 + Math.random() * 5;
        E.particle({ x: x + Math.cos(a) * 1.5, y: y0 + 0.4, z: z + Math.sin(a) * 1.5, vx: Math.cos(a) * sp, vy: 0.6 + Math.random(), vz: Math.sin(a) * sp, life: 1.6, size: 1.4, grow: 1.5, drag: 1.4, col: ['#e8e8f0', '#c8c8d8', '#ffcf8a'][i % 3], a: 0.65 }); }
    };
    // rocket model (white body, red nose + fins, porthole, engine bell, optional flame)
    WD.rocket = function (x, y, z, t, flame, sc) {
      sc = sc || 1; const base = T(x, y, z, 0, 0, 0, sc);
      part(base, ms.cyl, 0, 3.4, 0, 0, 0, 0, 2.2, 5.6, 2.2, '#f2f4f8', { tex: 'metal', texMode: 1 });
      for (const yy of [1.4, 5.3]) part(base, ms.cyl, 0, yy, 0, 0, 0, 0, 2.26, 0.35, 2.26, '#e13b3b');
      part(base, ms.cone, 0, 7.4, 0, 0, 0, 0, 2.2, 2.4, 2.2, '#e13b3b');
      part(base, ms.disc, 0, 4.5, 1.12, 0, Math.PI / 2, 0, 0.8, 1, 0.8, '#7ad7ff', { emis: 0.6 });
      part(base, ms.torus, 0, 4.5, 1.08, 0, Math.PI / 2, 0, 0.44, 0.44, 0.6, '#c0c8d8');
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; part(base, ms.rb, Math.sin(a) * 1.25, 1.2, Math.cos(a) * 1.25, a, 0, 0, 0.18, 2, 1.2, '#e13b3b'); }
      part(base, ms.cyl, 0, 0.2, 0, 0, 0, 0, 1.4, 0.8, 1.4, '#3a3f4a');
      if (flame) {
        const f = 1 + Math.sin(t * 40) * 0.15;
        part(base, ms.cone, 0, -1.6 * f, 0, 0, Math.PI, 0, 1.3, 3.2 * f, 1.3, '#ffb000', { emis: 1.5, add: true, alpha: 0.9, noShadow: true });
        part(base, ms.cone, 0, -1.1, 0, 0, Math.PI, 0, 0.7, 2 * f, 0.7, '#ffffff', { emis: 2, add: true, alpha: 0.9, noShadow: true });
        for (let i = 0; i < 6; i++) E.particle({ x: x + (Math.random() - 0.5) * 1.2 * sc, y: y - 1 * sc, z: z + (Math.random() - 0.5) * 1.2 * sc, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 6, vz: (Math.random() - 0.5) * 6, life: 0.9, size: 0.9, col: ['#ff9a00', '#ffd000', '#ff3d1f', '#aaaaaa'][i % 4], add: i < 3, drag: 1 });
      }
    };

    // ============================================================ NEBULA MOON
    function buildMoon() {
      const Mo = W.MOON, ck = 'moon', X = Mo.x, Z = Mo.z, Rr = Mo.r;
      S(G.cyl(Rr, Rr, 1.2, 72), T(X, -0.6, Z), '#b4acd6', 'rock', ck);
      [[0.95, 3, -2.7, '#8a7ab0'], [0.75, 5, -6.6, '#6a5a90'], [0.45, 6, -12, '#4a3a70'], [0.18, 6, -18, '#3a2a5a']].forEach(([f, h, y, c], i) =>
        S(G.cyl(Rr * (i ? [0.95, 0.75, 0.45, 0.18][i - 1] : 1), Rr * f, h, 40), T(X, y, Z), c, 'rock', ck));
      for (let i = 0; i < 12; i++) { const a = rnd() * 6.283, sz = 2 + rnd() * 3; S(geo.ico, T(X + Math.cos(a) * Rr * 0.6, -8 - rnd() * 10, Z + Math.sin(a) * Rr * 0.6, rnd() * 6, 0, 0, sz * 1.5, sz * 2, sz * 1.5), '#5a4a80', 'rock', ck); }
      const lanes = ['rhome', 'megg0', 'megg1', 'dshop', 'shiny', 'mobby'].map(k => [W.STN[k].x, W.STN[k].z]).concat(W.JETS.map(j => [j.x, j.z]), W.BOUNCE.map(j => [j.x, j.z]));
      const offLane = (x, z, m) => lanes.every(([bx, bz]) => { const [ax, az] = W.MOON_SPAWN, dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t2 = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); return Math.hypot(x - ax - t2 * dx, z - az - t2 * dz) > 2.6 + (m || 0); });
      const keep = (x, z, m) => offLane(x, z, Math.min(m || 0, 2)) && Object.entries(W.STN).every(([k, st]) => !(k.startsWith('m') || k === 'rhome' || k === 'dshop' || k === 'shiny') || Math.hypot(x - st.x, z - st.z) > (m || 6)) &&
        W.JETS.every(j => Math.hypot(x - j.x, z - j.z) > 4) && W.BOUNCE.every(j => Math.hypot(x - j.x, z - j.z) > 4) && Math.hypot(x - W.MOON_SPAWN[0], z - W.MOON_SPAWN[1]) > 6 &&
        W.MROCK.every(q => q.y > 4 || Math.hypot(x - q.x, z - q.z) > q.s + 2) && Math.hypot(x - W.MCRYSTAL[0], z - W.MCRYSTAL[1]) > 6;
      // craters
      for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, d = 6 + rnd() * (Rr - 9), x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d, r = 1.6 + rnd() * 3; if (!keep(x, z, r + 4)) continue;
        S(G.lathe([[r * 0.7, 0], [r, 0.3], [r * 1.25, 0.02]], 24), T(x, 0.01, z), '#c8c0e6', 'rock', ck); S(G.cyl(r * 0.75, r * 0.75, 0.04, 20), T(x, 0.01, z), '#8a80b0', 'rock', ck); }
      // crystal clusters (solid)
      for (let i = 0; i < 18; i++) { const a = rnd() * 6.283, d = 10 + rnd() * (Rr - 13), x = X + Math.cos(a) * d, z = Z + Math.sin(a) * d; if (!keep(x, z, 5)) continue;
        const c = ['#7ad7ff', '#ff7af0', '#b88aff'][i % 3];
        for (let k = 0; k < 3; k++) { const h = 1.4 + rnd() * 2.2; S(G.cyl(0, 0.4, h, 5), T(x + (k - 1) * 0.5, h / 2, z + (rnd() - 0.5) * 0.6, rnd() * 3, (rnd() - 0.5) * 0.4, (rnd() - 0.5) * 0.5), c, 'white', ck); }
        colC(x, z, 1, 3); WD.moonCrystals.push([x, z, c]); }
      // stations
      const st = W.STN;
      // rocket home pad
      S(G.cyl(2.4, 2.6, 0.3, 28), T(st.rhome.x, 0.15, st.rhome.z), '#3a3f4a', 'metal', ck);
      colC(st.rhome.x + 5, st.rhome.z, 1.8, 14);
      // egg stalls
      [0, 1].forEach(e => { const q = st['megg' + e];
        S(G.box(4.4, 1.2, 2.2, 0.2), T(q.x, 0.6, q.z - 2.6), '#e8e0ff', 'metal', ck); S(G.box(4.8, 0.5, 2.8, 0.2), T(q.x, 1.4, q.z - 2.6), e ? '#ff7af0' : '#8a7aff', 'white', ck);
        S(G.cyl(1.2, 1.4, 0.5, 20), T(q.x, 1.9, q.z - 2.6), '#fff3d0', 'tile', ck); colB(q.x, q.z - 2.5, 4.8, 3, 0, 4);
        WD.moonEggs.push([q.x, 3.6, q.z - 2.6, e]);
        sign(C.MOON.EGGS[e].n, C.MOON.EGGS[e].cost + ' Stardust', e ? '#c02aa8' : '#5a3ad8', q.x, q.z - 1.3, 0, 3.4, 1.2, 1.3, ck, '✨', true); });
      // stardust shop: crystal kiosk
      { const q = st.dshop; S(G.box(3.8, 1.2, 1.6, 0.2), T(q.x, 0.6, q.z - 2.4), '#3a2a6a', 'metal', ck); S(G.cyl(0, 1.6, 2.4, 6), T(q.x, 3.6, q.z - 2.4), '#c08aff', 'white', ck);
        for (const sd of [-1, 1]) S(geo.cyl, T(q.x + sd * 1.7, 1.4, q.z - 2.4, 0, 0, 0, 0.16, 2.8, 0.16), '#e8e0ff', 'metal', ck);
        colB(q.x, q.z - 2.4, 4, 1.8, 0, 4); sign('STARDUST SHOP', 'moon upgrades', '#7a3ad8', q.x, q.z - 1.5, 0, 3.6, 1.1, 1.8, ck, '✨', true); }
      // shiny machine
      { const q = st.shiny; S(G.box(3.4, 2.6, 2.2, 0.3), T(q.x, 1.3, q.z - 2.6), '#4a3a70', 'metal', ck); S(G.cyl(0.9, 1.5, 1.2, 16), T(q.x, 3.2, q.z - 2.6), '#ffd84a', 'metal', ck);
        colB(q.x, q.z - 2.6, 3.6, 2.4, 0, 5); sign('SHINY MACHINE', C.MOON.FUSE_COUNT + ' same pets = 1 Shiny', '#c89a00', q.x, q.z - 1.4, 0, 3.6, 1.1, 1.0, ck, '🌟', true); }
      // floating platforms, jet + bounce pads
      W.MPL.forEach(q => { S(G.box(q.s, 0.6, q.s, 0.25), T(q.x, q.y - 0.3, q.z), '#c8c0e6', 'rock', ck); S(geo.ico, T(q.x, q.y - 1.6, q.z, rnd() * 6, 0, 0, q.s * 0.9, 2.4, q.s * 0.9), '#6a5a90', 'rock', ck); });
      W.JETS.forEach(j => S(G.cyl(1.5, 1.7, 0.3, 24), T(j.x, 0.15, j.z), '#2a6fd0', 'metal', ck));
      W.BOUNCE.forEach(j => S(G.cyl(1.5, 1.7, 0.3, 24), T(j.x, 0.15, j.z), '#ff3d9a', 'metal', ck));
      // moon obby rocks (low ones are solid from the ground)
      // moon obby: still rocks are built once (moving + vanishing rocks are drawn every frame in drawMoon)
      W.MROCK.forEach((q, i) => { if (q.k === 1 || q.k === 2) return;
        S(G.box(q.s, 0.6, q.s, 0.25), T(q.x, q.y - 0.3, q.z, 0), q.finish ? '#ffd84a' : q.k === 3 ? '#ff7ab8' : q.cp ? '#7dff9a' : '#d0c8ee', 'rock', ck);
        S(geo.ico, T(q.x, q.y - 1.2, q.z, i, 0, 0, q.s * 0.8, 1.6, q.s * 0.8), '#7a6aa0', 'rock', ck); if (q.y < 3) colC(q.x, q.z, q.s * 0.55, q.y - 0.2); });
      // the giant crystal spire the obby climbs around
      { const [gx, gz] = W.MCRYSTAL, top = W.MROCK[W.MROCK.length - 1].y;
        for (let k = 0; k < 6; k++) { const h = top * (0.55 + k * 0.08), a2 = k / 6 * 6.283; S(G.cyl(0, 1.3 + (k % 2) * 0.5, h, 6), T(gx + Math.cos(a2) * 1.2, h / 2, gz + Math.sin(a2) * 1.2, a2, (k % 3 - 1) * 0.05, 0), ['#7ad7ff', '#b88aff', '#ff7af0'][k % 3], 'white', ck); }
        S(G.cyl(0.4, 2.4, top + 6, 6), T(gx, (top + 6) / 2, gz), '#c8b0ff', 'white', ck); colC(gx, gz, 3, top + 6); }
      sign('NEBULA MOON', 'catch meteors for Stardust!', '#7a3ad8', W.MOON_SPAWN[0] - 6, W.MOON_SPAWN[1] + 1, 0, 4.2, 1.4, 2.4, ck, '🌙');
      sign('MOON OBBY', 'climb the floating rocks', '#2a8be8', st.mobby.x + 4, st.mobby.z, 0, 3.4, 1.2, 2.2, ck, '🪨');
    }
    WD.moonCrystals = [];
    WD.drawMoon = function (V, t, near) {
      const Mo = W.MOON, s = V.s, now = V.now;
      // giant planet + rings in the sky (always far away from the camera)
      const e = V.cam, d = E.far * 0.85, dir = [-0.45, 0.38, -0.81];
      const px = e[0] + dir[0] * d, py = e[1] + dir[1] * d, pz = e[2] + dir[2] * d, ps = E.far * 0.42;
      D(ms.sph, T(px, py, pz, t * 0.02, 0.3, 0.2, ps), '#ffffff', { tex: planetTex, texMode: 1, mode: 3, nofog: true, noShadow: true });
      D(ms.torus, T(px, py, pz, 0.4, 0.5, 0.25, ps * 0.85, ps * 0.08, ps * 0.85), '#e8c0ff', { mode: 3, nofog: true, noShadow: true, alpha: 0.7 });
      // rocket home
      WD.launchRocket(W.STN.rhome.x + 5, 0.3, W.STN.rhome.z, 0.9, V.launch && V.launch.from === 'moon' ? V.launch.t : 0, t, V);
      // moon eggs + crystals glow + pads
      WD.moonEggs.forEach(([x, y, z, k]) => D(ms.egg, T(x, y + Math.sin(t * 1.8 + k) * 0.25, z, t * 0.6, 0, Math.sin(t * 2) * 0.08, 2.2), '#ffffff', { tex: moonEggTex[k], texMode: 1, emis: 0.15 }));
      W.JETS.forEach(j => { D(ms.disc, T(j.x, 0.32, j.z, 0, 0, 0, 2.6, 1, 2.6), '#5ec8ff', { emis: 0.7 + 0.3 * Math.sin(t * 5) }); V.labels.push({ t: '🚀 JETPACK', x: j.x, y: 1.2, z: j.z, sz: 11, c: '#bfe8ff' });
        if (V.parts && Math.random() < 0.3) E.particle({ x: j.x + (Math.random() - 0.5) * 2, y: 0.4, z: j.z + (Math.random() - 0.5) * 2, vx: 0, vy: 3, vz: 0, life: 0.6, size: 0.25, col: '#7ad7ff', add: true }); });
      W.BOUNCE.forEach(j => { D(ms.disc, T(j.x, 0.32 + Math.abs(Math.sin(t * 4)) * 0.06, j.z, 0, 0, 0, 2.6, 1, 2.6), '#ff7ab8', { emis: 0.7 }); V.labels.push({ t: 'SUPER BOUNCE', x: j.x, y: 1.2, z: j.z, sz: 11, c: '#ffc0e0' }); });
      WD.moonCrystals.forEach(([x, z, c], i) => { if (near(x, z, 60)) D(ms.gem, T(x, 4 + Math.sin(t * 2 + i) * 0.3, z, t + i, 0, 0, 0.6), c, { emis: 0.9, noShadow: true }); });
      // shiny machine ring
      { const q = W.STN.shiny; D(ms.torus, T(q.x, 4.4, q.z - 2.6, t * 2, 0.3 * Math.sin(t), 0, 1.4, 1.4, 1.4), '#ffd84a', { emis: 1 }); if (V.parts && Math.random() < 0.3) E.particle({ x: q.x, y: 4.4, z: q.z - 2.6, vx: (Math.random() - 0.5) * 3, vy: 2, vz: (Math.random() - 0.5) * 3, life: 0.8, size: 0.3, col: '#fff2a0', add: true }); }
      // stardust pickups
      W.DUST.forEach((g, i) => { if ((s.dustT[i] || 0) > now || (V.dustPending[i] || 0) > now || !near(g[0], g[1], 70)) return;
        const y = g[2] + Math.sin(t * 3 + i) * 0.2; D(ms.gem, T(g[0], y, g[1], t * 2.5 + i, 0.4, 0, 0.7), '#ff9af0', { emis: 0.8 }); D(ms.gem, T(g[0], y, g[1], -t * 2 + i, -0.4, 0, 0.5), '#c08aff', { emis: 0.8 });
        if (V.parts && Math.random() < 0.08) E.particle({ x: g[0], y, z: g[1], vx: 0, vy: 1, vz: 0, life: 0.7, size: 0.2, col: '#ffd0ff', add: true }); });
      // moon obby: moving/vanishing rocks, kill crystals, spinners, star rings, checkpoint flags
      if (near(W.MCRYSTAL[0], W.MCRYSTAL[1], 90)) {
        W.MROCK.forEach((q, i) => {
          if ((q.k === 1 || q.k === 2) && !q.gone) {
            const blink = q.k === 2 && q.t > 0 ? 0.5 + 0.5 * Math.sin(t * 40) : 0;
            D(ms.rb, T(q.x, q.y - 0.3, q.z, 0, 0, 0, q.s, 0.6, q.s), q.k === 1 ? '#7ad7ff' : '#e0b070', { tex: 'rock', texMode: 2, emis: blink * 0.6 + (q.k === 1 ? 0.15 : 0) });
            D(ms.ico, T(q.x, q.y - 1.1, q.z, i, 0, 0, q.s * 0.75, 1.3, q.s * 0.75), '#6a5a90', { tex: 'rock', texMode: 2 });
          }
          if (q.bar) { const an = t * q.bar.spd + q.ph;
            D(ms.cyl, T(q.x, q.y + 0.35, q.z, 0, 0, 0, 0.5, 0.7, 0.5), '#2a1a40');
            D(ms.rb, T(q.x, q.y + q.bar.h, q.z, -an, 0, 0, q.bar.r * 2, 0.3, 0.3), '#ff1a5a', { emis: 0.6 + 0.3 * Math.sin(t * 8) });
            for (const sd of [-1, 1]) D(ms.gem, T(q.x + Math.cos(an) * q.bar.r * sd, q.y + q.bar.h, q.z + Math.sin(an) * q.bar.r * sd, t * 3, 0, 0, 0.5), '#ff3d6e', { emis: 0.8 }); }
          if (q.cp && !q.finish) { D(ms.cyl, T(q.x, q.y + 1, q.z, 0, 0, 0, 0.08, 2, 0.08), '#dddddd'); D(ms.quad, T(q.x + 0.35, q.y + 1.7, q.z, 0, Math.sin(t * 4 + i) * 0.15, 0, 0.7, 0.45, 1), i <= (V.mobbyCk || 0) * 7 ? '#3dff6a' : '#ff3333', { cull: false }); }
          if (q.k === 3) V.labels.push({ t: '⬆ BOUNCE', x: q.x, y: q.y + 1, z: q.z, sz: 11, c: '#ffc0e0' });
        });
        W.MKILL.forEach(b => { D(ms.cone, T(b.x, b.y - 0.1, b.z, t, 0, 0, b.w * 0.9, b.h * 1.6, b.d * 0.9), '#ff1a5a', { emis: 0.7 + 0.3 * Math.sin(t * 7 + b.p) });
          if (V.parts && Math.random() < 0.1) E.particle({ x: b.x, y: b.y + 0.4, z: b.z, vx: 0, vy: 1.2, vz: 0, life: 0.5, size: 0.25, col: '#ff5a8a', add: true }); });
        W.MRING.forEach((g, i) => { D(ms.torus, T(g.x, g.y, g.z, t * 1.5 + i, Math.PI / 2, 0, 1.4, 1.4, 1.4), g.hit ? '#ffffff' : '#ffe680', { emis: 1.4, noShadow: true });
          D(ms.gem, T(g.x, g.y, g.z, -t * 2, 0, 0, 0.5), '#fff6c0', { emis: 1.2, noShadow: true }); V.labels.push({ t: '⭐ air jump', x: g.x, y: g.y + 1.9, z: g.z, sz: 10, c: '#ffe680' }); });
      }
      // finish star on the moon obby
      { const q = W.MROCK[W.MROCK.length - 1]; D(ms.gem, T(q.x, q.y + 1.6 + Math.sin(t * 2) * 0.2, q.z, t * 1.5, 0, 0, 1.2), '#ffd84a', { emis: 1 }); V.labels.push({ t: '⭐ TOP', x: q.x, y: q.y + 3.2, z: q.z, sz: 14, c: '#ffd84a' }); }
      // meteor shower
      const mi = L.meteorInfo(now);
      if (mi.active) for (const m of L.meteors(mi.slot)) {
        if (now < m.spawn - 1500 || now > m.land + 1500) continue;
        const caught = s.meteorC.slot === mi.slot && s.meteorC.ids.includes(m.i) || (V.meteorPending[mi.slot + ':' + m.i]);
        const k = (now - m.spawn) / (m.land - m.spawn);
        if (k < 1) {
          const kk = Math.max(0, k), mx = m.x + (1 - kk) * 14, my = 0.6 + (1 - kk) * 42, mz = m.z - (1 - kk) * 9;
          if (k >= 0) { D(ms.ico, T(mx, my, mz, t * 3, t * 2, 0, 1.8), '#ff7a2a', { emis: 1.3 }); D(ms.sph, T(mx, my, mz, 0, 0, 0, 3.2), '#ffb000', { mode: 3, alpha: 0.35, add: true, noShadow: true }); if (V.parts) for (let n = 0; n < 2; n++) E.particle({ x: mx, y: my, z: mz, vx: 3.5 + Math.random(), vy: 10, vz: -2.2, life: 0.5, size: 0.7, col: ['#ffd000', '#ff7a2a', '#fff'][n % 3], add: true, drag: 2 }); }
          const catchable = now > m.land - 2500, rr = L.catchR(s);
          const rc2 = caught ? '#3dff6a' : catchable ? '#ffd000' : '#ff5a3d', blink = Math.abs(Math.sin(t * (catchable ? 12 : 4)));
          D(ms.disc, T(m.x, 0.07, m.z, 0, 0, 0, rr * 2, 1, rr * 2), rc2, { mode: 3, alpha: 0.45 + 0.3 * blink, noShadow: true, add: true });
          D(ms.torus, T(m.x, 0.15, m.z, t * 2, 0, 0, rr, 1.4, rr), rc2, { emis: 1.4, noShadow: true });
          if (!caught) D(ms.cyl, T(m.x, 6, m.z, 0, 0, 0, 0.5 + blink * 0.3, 12, 0.5 + blink * 0.3), rc2, { mode: 3, alpha: catchable ? 0.4 : 0.18, add: true, noShadow: true, cull: false });
        } else if (now < m.land + 400 && V.parts && !m.boomed) { m.boomed = 1; for (let n = 0; n < 24; n++) { const a = Math.random() * 6.283; E.particle({ x: m.x, y: 0.5, z: m.z, vx: Math.cos(a) * 6, vy: 3 + Math.random() * 4, vz: Math.sin(a) * 6, life: 0.8, size: 0.4, g: 9, col: '#c8b8ff' }); } }
      }
    };

    // ============================================================ BUILD STATIC WORLD
    WD.build = function () {
      const H = W.HUB, hw = H.x2 - H.x1, hd = H.z2 - H.z1, hcx = (H.x1 + H.x2) / 2, hcz = (H.z1 + H.z2) / 2;
      island(hcx, hcz, hw, hd, '#5ead42', '#7a5434', 'hub', 'grass');
      // spawn plaza + paths
      const PZ0 = W.PLAZA, SP = W.SPAWN;
      S(G.cyl(PZ0.r, PZ0.r, 0.14, 48), T(PZ0.x, 0.02, PZ0.z), '#c9c1ae', 'tile', 'hub');
      S(G.cyl(PZ0.r * 0.68, PZ0.r * 0.68, 0.16, 40), T(PZ0.x, 0.03, PZ0.z), '#b4ab98', 'tile', 'hub');
      S(G.cyl(1.4, 1.4, 0.18, 24), T(SP[0], 0.04, SP[1]), '#ffd84a', 'tile', 'hub');
      for (const p of W.PATHS) {
        path(p.x1, p.z1, p.x2, p.z2, p.w, 'hub');
        // kerb stones along both edges
        const len = Math.hypot(p.x2 - p.x1, p.z2 - p.z1), ux = (p.x2 - p.x1) / len, uz = (p.z2 - p.z1) / len;
        for (let d = PZ0.r + 1; d < len - 1; d += 2.2) for (const sd of [-1, 1]) {
          const x = p.x1 + ux * d + uz * sd * (p.w / 2 + 0.15), z = p.z1 + uz * d - ux * sd * (p.w / 2 + 0.15);
          S(G.box(0.3, 0.14, 1.6, 0.05), T(x, 0.06, z, Math.atan2(ux, uz)), '#b8b0a0', 'tile', 'hub');
        }
      }
      // boss arena
      const BX = W.BOSS[0], BZ = W.BOSS[2];
      S(G.cyl(W.ARENA_R - 0.4, W.ARENA_R - 0.4, 0.12, 48), T(BX, 0.025, BZ), '#4a3f5e', 'tile', 'hub');
      S(G.cyl(7.6, 7.6, 0.14, 48), T(BX, 0.03, BZ), '#6b5a8a', 'tile', 'hub');
      W.PILLARS.forEach(([x, z], i) => { const a = i / 6 * 6.283;
        S(G.box(0.9, 3.2, 0.9, 0.15), T(x, 1.6, z, a), '#3a3050', 'rock', 'hub'); S(G.box(1.2, 0.4, 1.2, 0.1), T(x, 3.3, z, a), '#2a2238', 'rock', 'hub'); WD.arenaPillars.push([x, 3.9, z]); });
      // fountain
      const FX = W.FOUNTAIN.x, FZ = W.FOUNTAIN.z;
      S(G.lathe([[3.2, 0], [3.3, 0.55], [3.0, 0.7], [2.75, 0.55], [2.7, 0.15]], 32), T(FX, 0, FZ), '#c9ccd6', 'tile', 'hub');
      S(G.cyl(0.5, 0.7, 1.8, 16), T(FX, 0.9, FZ), '#c9ccd6', 'tile', 'hub');
      S(G.lathe([[0.4, 0], [1.3, 0.25], [1.4, 0.45], [1.2, 0.5], [0.3, 0.35]], 24), T(FX, 1.75, FZ), '#d8dbe4', 'tile', 'hub');
      S(G.cyl(0.25, 0.35, 1, 12), T(FX, 2.6, FZ), '#d8dbe4', 'tile', 'hub');
      // pond with stone border, lily pads
      const PX = W.POND.x, PZ = W.POND.z;
      for (let i = 0; i < 22; i++) { const a = i / 22 * 6.283; S(geo.ico, T(PX + Math.cos(a) * 4.5, 0.15, PZ + Math.sin(a) * 3.3, a, 0, 0, 1.1, 0.6, 0.9), ['#9aa0a8', '#b4b8be', '#878c94'][i % 3], 'rock', 'hub'); }
      [[-1.8, -0.8], [1.5, 1.1], [0.4, -1.6], [-0.6, 1.4]].forEach(([dx, dz], i) => {
        S(G.cyl(0.55, 0.55, 0.05, 14), T(PX + dx, 0.12, PZ + dz, i), '#3aa856', 'white', 'hub');
        if (i % 2) S(geo.sphLo, T(PX + dx + 0.15, 0.22, PZ + dz, 0, 0, 0, 0.22, 0.14, 0.22), '#ff9ad5', 'white', 'hub');
      });
      // carousel base
      const CX = W.CAROUSEL.x, CZ = W.CAROUSEL.z;
      S(G.cyl(3, 3.1, 0.4, 28), T(CX, 0.2, CZ), '#ff9ad5', 'white', 'hub');
      S(G.cyl(0.3, 0.3, 3.6, 12), T(CX, 2, CZ), '#fff3d0', 'white', 'hub');
      // stations (static bases)
      const st = W.STN;
      S(G.box(2.4, 1.6, 1.6, 0.25), T(st.map.x, 0.8, st.map.z - 2.2), '#2a6fd0', 'white', 'hub');
      S(G.cyl(0.25, 0.35, 0.8, 12), T(st.map.x, 2, st.map.z - 2.2), '#ffd84a', 'metal', 'hub');
      for (const s of [-1, 1]) S(G.box(0.9, 4.2, 0.9, 0.2), T(st.reb.x + s * 2.1, 2.1, st.reb.z - 2.3), '#6a2bb8', 'tile', 'hub');
      S(G.box(5.3, 0.9, 1.1, 0.25), T(st.reb.x, 4.5, st.reb.z - 2.3), '#8a3be2', 'tile', 'hub');
      S(G.box(0.5, 3, 0.5, 0.1), T(st.wheel.x, 1.5, st.wheel.z - 1.6), '#5a5f6a', 'metal', 'hub');
      S(G.box(2, 0.4, 1.2, 0.15), T(st.wheel.x, 0.2, st.wheel.z - 1.6), '#5a5f6a', 'metal', 'hub');
      for (const s of [-1, 1]) S(G.box(0.7, 3.6, 0.7, 0.15), T(st.obby.x + s * 1.8, 1.8, st.obby.z - 1.2), '#ff7a2a', 'tile', 'hub');
      S(G.box(4.4, 0.7, 0.8, 0.2), T(st.obby.x, 3.8, st.obby.z - 1.2), '#ffd000', 'tile', 'hub');
      S(G.box(2, 1, 1.3, 0.12), T(st.chest.x, 0.5, st.chest.z - 2), '#9a5e1a', 'wood', 'hub');
      S(G.box(2.1, 0.18, 1.4, 0.05), T(st.chest.x, 0.25, st.chest.z - 2), '#ffcc33', 'metal', 'hub');
      S(G.cyl(1.6, 1.8, 0.3, 24), T(st.afk.x, 0.15, st.afk.z), '#2b4a3a', 'metal', 'hub');
      // gem shop stall
      const gs = st.gems;
      S(G.box(3.6, 1.1, 1.2, 0.15), T(gs.x, 0.55, gs.z - 2), '#3b4f8a', 'wood', 'hub');
      for (const s of [-1, 1]) S(geo.cyl, T(gs.x + s * 1.7, 1.6, gs.z - 2.5, 0, 0, 0, 0.18, 3.2, 0.18), '#e8e8f0', 'white', 'hub');
      for (let i = 0; i < 6; i++) S(G.box(0.64, 0.12, 2, 0.04), T(gs.x - 1.6 + i * 0.64, 3.3, gs.z - 2.3, 0, -0.25, 0), i % 2 ? '#3df5ff' : '#ffffff', 'white', 'hub');
      // quest board
      const qb = st.quests;
      for (const s of [-1, 1]) S(geo.cyl, T(qb.x + s * 1.5, 1.3, qb.z - 2, 0, 0, 0, 0.22, 2.6, 0.22), '#7a4e2a', 'wood', 'hub');
      S(G.box(3.4, 2, 0.25, 0.08), T(qb.x, 1.9, qb.z - 2), '#8a5a2e', 'wood', 'hub');
      S(G.box(3.8, 0.35, 0.6, 0.1), T(qb.x, 3.05, qb.z - 2, 0, 0, 0), '#5a3818', 'wood', 'hub');
      // podium
      const PD = W.PODIUM;
      [[0, 1.8, '#ffd84a'], [-2.2, 1.2, '#c8ccd0'], [2.2, 0.8, '#cd7f32']].forEach(q => S(G.box(2, q[1], 2, 0.2), T(PD.x + q[0], q[1] / 2, PD.z), q[2], 'tile', 'hub'));
      // hitboxes for the lobby buildings
      colB(st.map.x, st.map.z - 2.2, 2.4, 1.6, 0, 4);
      for (const sd of [-1, 1]) { colC(st.reb.x + sd * 2.1, st.reb.z - 2.3, 0.6, 5); colC(st.obby.x + sd * 1.8, st.obby.z - 1.2, 0.5, 4.5); colC(W.GATE_X - 0.4, sd * 2.3, 0.45, 5); }
      colB(st.wheel.x, st.wheel.z - 1.6, 2, 1.2, 0, 4); colB(st.chest.x, st.chest.z - 2, 2.1, 1.4, 0, 1.6);
      colB(gs.x, gs.z - 2.2, 3.8, 1.6, 0, 4); colB(qb.x, qb.z - 2, 3.6, 0.6, 0, 4); colB(PD.x, PD.z, 6.4, 2, 0, 4);
      colC(FX, FZ, 3.3, 4); colC(CX, CZ, 3.1, 5); for (const dx of [-2.3, 0, 2.3]) colC(PX + dx, PZ, dx ? 2.6 : 3.4, 1.2);
      W.PILLARS.forEach(([x, z]) => colC(x, z, 0.6, 5));
      // big title sign
      WD.titleSign = sign('TAPPING LEGENDS', 'by Parker & Wolfie', '#ff9a00', W.TITLE.x, W.TITLE.z, 0, 10, 3.2, 3.6, 'hub', '👆');
      // fence with openings for every bridge and the garden gate
      const gapsN = W.BRG.filter(b => b[1] === H.z1).map(b => [b[0], H.z1, 3]), gapsS = W.BRG.filter(b => b[1] === H.z2).map(b => [b[0], H.z2, 3]);
      const gapsE = W.BRG.filter(b => b[0] === H.x2).map(b => [H.x2, b[1], 3]);
      fenceLine(H.x1 + 0.6, H.z1 + 0.6, H.x2 - 0.6, H.z1 + 0.6, 'hub', gapsN);
      fenceLine(H.x1 + 0.6, H.z2 - 0.6, H.x2 - 0.6, H.z2 - 0.6, 'hub', gapsS);
      fenceLine(H.x1 + 0.6, H.z1 + 0.6, H.x1 + 0.6, H.z2 - 0.6, 'hub', [[H.x1, 0, 3]]);
      fenceLine(H.x2 - 0.6, H.z1 + 0.6, H.x2 - 0.6, H.z2 - 0.6, 'hub', gapsE);
      // trees, bushes, flowers and lamps: never on a path or next to a building
      const avoid = (x, z, pad) => L.pathDist(x, z) < (pad || 1.4) || W.FOOT.some(f => Math.hypot(x - f.x, z - f.z) < f.r + (pad || 1.4) + 1) ||
        W.GP.some(g => Math.hypot(x - g[0], z - g[1]) < 5) || (x < H.x1 + 4 && Math.abs(z) < 4);
      WD.avoid = avoid; WD.trees = [];
      const addTree = (x, z) => { if (!avoid(x, z, 2)) { tree(x, z, 'hub', 0.9 + rnd() * 0.35); WD.trees.push([x, z]); } };
      for (let x = H.x1 + 3; x <= H.x2 - 3; x += 6) { addTree(x + rnd(), H.z1 + 2.4); addTree(x + rnd(), H.z2 - 2.4); }
      for (let z = H.z1 + 8; z <= H.z2 - 8; z += 6) { addTree(H.x1 + 2.4, z + rnd()); addTree(H.x2 - 2.4, z + rnd()); }
      for (let i = 0; i < 60; i++) addTree(H.x1 + 6 + rnd() * (H.x2 - H.x1 - 12), H.z1 + 6 + rnd() * (H.z2 - H.z1 - 12));
      for (let i = 0; i < 160; i++) { const x = H.x1 + 2 + rnd() * (H.x2 - H.x1 - 4), z = H.z1 + 2 + rnd() * (H.z2 - H.z1 - 4); if (!avoid(x, z, 0.6)) flower(x, z, 'hub'); }
      for (let i = 0; i < 40; i++) { const x = H.x1 + 3 + rnd() * (H.x2 - H.x1 - 6), z = H.z1 + 3 + rnd() * (H.z2 - H.z1 - 6); if (!avoid(x, z, 1)) bush(x, z, 'hub'); }
      W.PATHS.forEach((p, i) => { for (const t of [0.45, 0.8]) {
        const len = Math.hypot(p.x2 - p.x1, p.z2 - p.z1), ux = (p.x2 - p.x1) / len, uz = (p.z2 - p.z1) / len, sd = (i + (t > 0.5 ? 1 : 0)) % 2 ? 1 : -1;
        const x = p.x1 + (p.x2 - p.x1) * t + uz * sd * (p.w / 2 + 1.2), z = p.z1 + (p.z2 - p.z1) * t - ux * sd * (p.w / 2 + 1.2);
        if (!W.FOOT.some(f => Math.hypot(x - f.x, z - f.z) < f.r + 0.8) && L.pathDist(x, z) > 0.4) lamp(x, z, 'hub'); } });
      // golden garden
      const GA = W.GARDEN;
      island((GA.x1 + GA.x2) / 2, 0, GA.x2 - GA.x1 + 1, GA.z2 - GA.z1 + 1, '#ffd84a', '#9a7414', 'garden', 'grass');
      for (const s of [-1, 1]) S(G.box(0.7, 4, 0.7, 0.2), T(W.GATE_X - 0.4, 2, s * 2.3), '#ffcc33', 'metal', 'hub');
      S(G.torus(2.3, 0.3, 24, 8), T(W.GATE_X - 0.4, 4, 0, Math.PI / 2, 0, 0, 1, 0.5, 1), '#ffcc33', 'metal', 'hub');
      for (let i = 0; i < 6; i++) tree(GA.x1 + 2 + (i % 3) * 4, -4 + Math.floor(i / 3) * 8, 'garden', 1, 'gold');
      // bridges
      W.BRG.forEach((b, k) => {
        const v = b[0] === b[2], len = v ? Math.abs(b[3] - b[1]) : Math.abs(b[2] - b[0]), dir = v ? Math.sign(b[3] - b[1]) : Math.sign(b[2] - b[0]);
        for (let i = 0; i < len / 1.2; i++) {
          const p = (v ? b[1] : b[0]) + dir * (i * 1.2 + 0.6), x = v ? b[0] : p, z = v ? p : b[1], sag = -0.12 - Math.sin(i * 1.2 / len * Math.PI) * 0.35;
          S(G.box(v ? 4.2 : 1.05, 0.22, v ? 1.05 : 4.2, 0.06), T(x, sag, z, 0, 0, (rnd() - 0.5) * 0.04), i % 2 ? '#b98a54' : '#a8784a', 'wood', 'bridges');
          if (i % 3 === 0) for (const s of [-1, 1]) S(geo.cyl, T(v ? x + s * 2.1 : x, sag + 0.7, v ? z : z + s * 2.1, 0, 0, 0, 0.16, 1.4, 0.16), '#6b4a2b', 'wood', 'bridges');
        }
        for (const s of [-1, 1]) {
          const ax = v ? b[0] + s * 2.1 : (b[0] + b[2]) / 2, az = v ? (b[1] + b[3]) / 2 : b[1] + s * 2.1;
          S(geo.cyl, T(ax, 1.25, az, v ? 0 : Math.PI / 2, Math.PI / 2, 0, 0.06, len, 0.06), '#d8c8a0', 'white', 'bridges');
        }
      });
      // islands
      W.CEN.forEach((c, k) => {
        const a = C.AREAS[k], ck = 'i' + k, cx = c[0], cz = c[1], R = W.IH;
        const sd = (k === 2 || k === 3) ? 1 : -1; // the stall stands on the far side of the egg pad from the bridge
        island(cx, cz, R * 2, R * 2, a.g, a.side, ck, a.tex);
        // egg shop stall
        S(G.box(4.4, 1.2, 2.2, 0.2), T(cx, 0.6, cz + sd * 4.5), '#ffffff', 'wood', ck); colB(cx, cz + sd * 4.4, 4.8, 3, 0, 4);
        S(G.box(4.8, 0.5, 2.8, 0.2), T(cx, 1.4, cz + sd * 4.5), shade(a.col[4], 0.9), 'white', ck);
        S(G.cyl(1.2, 1.4, 0.5, 20), T(cx, 1.9, cz + sd * 4.5), '#fff3d0', 'tile', ck);
        WD.eggShops.push([cx, 3.6, cz + sd * 4.5, k]);
        const dec = (n, fn) => { for (let i = 0; i < n; i++) { const x = cx - R + 2 + rnd() * (R * 2 - 4), z = cz - R + 2 + rnd() * (R * 2 - 4); if (Math.hypot(x - cx, z - cz + 2) > 7 && !(k === 3 && L.inLava(x, z)) && !(k === 2 && W.ROCKS.some(r => Math.hypot(x - r[0], z - r[1]) < 3)) && !(k === 4 && inHangar(x, z, 2.5))) fn(x, z); } };
        if (k === 0) { dec(16, (x, z) => tree(x, z, ck, 0.9 + rnd() * 0.4)); dec(40, (x, z) => flower(x, z, ck)); dec(14, (x, z) => bush(x, z, ck)); }
        if (k === 1) {
          dec(12, (x, z) => { const h = 2 + rnd() * 1.5, col = ['#ff5d8f', '#7fd8ff', '#b388ff', '#9cff8f'][rnd() * 4 | 0];
            colC(x, z, 0.3, 4); S(geo.cyl, T(x, h / 2, z, 0, 0, 0, 0.16, h, 0.16), '#ffffff', 'white', ck); S(G.cyl(0.9, 0.9, 0.3, 20), T(x, h + 0.6, z, rnd() * 3, Math.PI / 2, 0), col, 'candy', ck); });
          dec(10, (x, z) => { colC(x, z, 0.4, 4); S(geo.ico, T(x, 1.8, z, rnd() * 6, 0, 0, 2.6, 2.2, 2.6), ['#ffb3d9', '#c9b3ff', '#b3ecff'][rnd() * 3 | 0], 'white', ck); S(geo.cyl, T(x, 0.6, z, 0, 0, 0, 0.3, 1.2, 0.3), '#ffffff', 'candy', ck); });
          for (let i = 0; i < 8; i++) { const x = cx - 15 + i * 4.3, z = cz - 12 + (i % 3) * 2; colC(x, z, 0.5, 4); S(geo.cyl, T(x, 1, z, 0, 0, 0, 0.35, 2, 0.35), '#ffffff', 'candy', ck); S(geo.sph, T(x, 2.4, z, 0, 0, 0, 1.2), ['#ff5d8f', '#ffd000', '#7dff6a', '#4fc3ff'][i % 4], 'white', ck); }
        }
        if (k === 2) {
          dec(12, (x, z) => { const h = 1.6 + rnd() * 1.6; colC(x, z, 0.6, 4); S(G.cyl(0.42, 0.48, h, 12), T(x, h / 2, z), '#3e9e4a', 'grass', ck); S(geo.sph, T(x, h, z, 0, 0, 0, 0.84), '#3e9e4a', 'grass', ck);
            for (const s of [-1, 1]) { S(G.cyl(0.25, 0.25, 0.8, 10), T(x + s * 0.6, h * 0.55, z, 0, 0, Math.PI / 2), '#3e9e4a', 'grass', ck); S(G.cyl(0.25, 0.25, 0.9, 10), T(x + s * 0.95, h * 0.55 + 0.4, z), '#3e9e4a', 'grass', ck); }
            if (rnd() < 0.4) S(geo.sphLo, T(x, h + 0.45, z, 0, 0, 0, 0.3), '#ff6fae', 'white', ck); });
          [0, 1, 2, 3].forEach(i => S(G.box(6 - i * 1.4, 1, 6 - i * 1.4, 0.05), T(cx - 10, 0.5 + i, cz - 12), '#e8c36a', 'sand', ck)); colB(cx - 10, cz - 12, 6, 6, 0, 5);
          dec(8, (x, z) => S(geo.ico, T(x, 0.3, z, rnd() * 6, 0, 0, 1.2, 0.7, 1.2), '#b8945a', 'rock', ck));
        }
        if (k === 3) {
          [0, 1, 2, 3, 4].forEach(i => S(G.cyl(3.4 - i * 0.6, 3.8 - i * 0.6, 1.1, 14), T(cx - 12, 0.55 + i * 1.1, cz - 12), shade('#4a3030', 1 - i * 0.05), 'rock', ck)); colC(cx - 12, cz - 12, 3.8, 7);
          dec(14, (x, z) => { const h = 1 + rnd() * 2.5; colC(x, z, 0.55, h); S(G.cyl(0, 0.5 + rnd() * 0.4, h, 6), T(x, h / 2, z, rnd() * 3), '#241a24', 'rock', ck); });
          dec(8, (x, z) => { colC(x, z, 0.3, 3); S(geo.cyl, T(x, 1, z, 0, 0, 0, 0.25, 2, 0.25), '#2a1e1e', 'wood', ck); for (const s of [-1, 1]) S(geo.cyl, T(x + s * 0.4, 1.7, z, 0, 0, s * 0.7, 0.12, 1, 0.12), '#2a1e1e', 'wood', ck); });
          const LV = W.LAVA; for (let i = 0; i < 14; i++) { const t = i / 14 * 6.283, x = (LV.x1 + LV.x2) / 2 + Math.cos(t) * 7, z = (LV.z1 + LV.z2) / 2 + Math.sin(t) * 9; S(geo.ico, T(x, 0.2, z, t, 0, 0, 1.3, 0.6, 1.3), '#3a2a2a', 'rock', ck); }
        }
        if (k === 4) {
          dec(14, (x, z) => { const h = 1 + rnd() * 2; colC(x, z, 0.5, h); S(G.cyl(0, 0.45, h, 5), T(x, h / 2, z, rnd() * 3), '#6ee7ff', 'white', ck); S(G.cyl(0, 0.3, h * 0.6, 5), T(x + 0.4, h * 0.3, z + 0.2, rnd() * 3, 0, 0.4), '#c08aff', 'white', ck); });
          [[-5, -10], [5, -10]].forEach(o => { colC(cx + o[0], cz + o[1], 1.9, 3); S(G.sphere(1.8, 18, 10), T(cx + o[0], 0.4, cz + o[1], 0, 0, 0, 1, 0.8, 1), '#c8d4f0', 'metal', ck); S(G.cyl(1.9, 1.9, 0.4, 20), T(cx + o[0], 0.2, cz + o[1]), '#4d5570', 'metal', ck); });
          colC(cx + 12, cz - 12, 0.3, 6); S(geo.cyl, T(cx + 12, 2.5, cz - 12, 0, 0, 0, 0.2, 5, 0.2), '#9aa6c0', 'metal', ck); S(G.lathe([[0, 0], [1.5, 0.5], [1.6, 0.6]], 16), T(cx + 12, 5, cz - 12, 0, 0.6, 0), '#e8eef8', 'metal', ck);
          for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.4, px = cx + Math.cos(a) * 14, pz = cz + Math.sin(a) * 14; if (inHangar(px, pz)) continue; S(G.box(0.8, 3, 0.8, 0.15), T(px, 1.5, pz, a), '#4d5570', 'metal', ck); colB(px, pz, 0.8, 0.8, a, 3); }
          buildHangar(ck);
        }
        detail(k, cx, cz, ck);
        // jump pad bases on this island
        W.JP.forEach(j => { if (Math.abs(j[0] - cx) < R && Math.abs(j[1] - cz) < R) S(G.cyl(1.5, 1.6, 0.25, 20), T(j[0], 0.1, j[1]), '#ff8a00', 'metal', ck); });
      });
      // desert gate + island gates signs on hub
      // gate signs stand beside the path (on the outer side), facing the lobby
      W.GP.forEach((p, k) => {
        const east = k === 4, x = east ? p[0] - 1.5 : p[0] + Math.sign(p[0]) * 4.2, z = east ? p[1] - 4.4 : p[1] + (p[1] > 0 ? -1.5 : 1.5);
        WD.gateSigns[k] = sign(C.AREAS[k].n, '', '#2f9e44', x, z, east ? -Math.PI / 2 : (p[1] > 0 ? Math.PI : 0), 3.4, 1.5, 2.8, 'hub', C.AREAS[k].e[0]);
      });
      // station signs
      sign('WORLD MAP', '', '#2a8be8', st.map.x, st.map.z - 3.3, 0, 3.4, 1.3, 3.6, 'hub', '🗺️', true);
      sign('REBIRTH', 'more pet slots + taps', '#9a3be2', st.reb.x, st.reb.z - 2.0, 0, 3.6, 1.4, 5.6, 'hub', '♻️', true);
      sign('LUCKY WHEEL', 'free spin every 2 min', '#e8a800', st.wheel.x + 2.6, st.wheel.z - 1, -0.4, 3.2, 1.5, 2.2, 'hub', '🎡');
      sign('OBBY', '50 platforms · HARD', '#e8541a', st.obby.x, st.obby.z - 1.2 + 0.45, 0, 3.6, 1.3, 4.9, 'hub', '🏁', true);
      sign('TREASURE', 'opens every 10 min', '#c88a00', st.chest.x + 2.4, st.chest.z - 1.5, -0.6, 3, 1.4, 2.2, 'hub', '💰');
      WD.afkSign = sign('AUTO TAP PAD', 'unlocks at rebirth 1', '#1fa55a', st.afk.x, st.afk.z - 2.6, 0, 3.6, 1.5, 2.6, 'hub', '⚙️');
      sign('GEM SHOP', 'upgrades & boosts', '#11a9c4', gs.x, gs.z - 2.3, 0, 3.6, 1.2, 4.3, 'hub', '💎', true);
      sign('DAILY QUESTS', '', '#e8a800', qb.x, qb.z - 1.85, 0, 3.2, 1.0, 3.3, 'hub', '📜', true);
      sign('TOP TAPPERS', 'this week', '#e8a800', W.PODIUM.x, W.PODIUM.z - 1.7, 0, 4.2, 1.5, 5.2, 'hub', '🏆');
      sign('GOLDEN GARDEN', 'needs ' + L.fmt(C.GARDEN_CLICKS) + ' clicks · 2x taps', '#c89a00', W.GATE_X + 1.2, -5, -Math.PI / 2, 3.8, 1.4, 2.4, 'hub', '✨');
      W.CEN.forEach((c, k) => sign(C.AREAS[k].egg, L.fmt(C.AREAS[k].ec) + ' taps', '#2f9e44', c[0], c[1] + (k === 2 || k === 3 ? 3.2 : -3.2), k === 2 || k === 3 ? Math.PI : 0, 3.4, 1.3, 1.4, 'i' + k, '🥚', true));
      // obby start pad base
      S(G.box(6, 1, 6, 0.3), T(W.OB, -0.6, 0), '#ff7a2a', 'tile', 'obby');
      buildMoon();
      WD.colGrid = L.colGrid(cols);
      E.buildStatic();
    };
    WD.arenaPillars = []; WD.eggShops = []; WD.gateSigns = [];

    // ============================================================ CLOUDS
    const cloudGeo = []; for (let i = 0; i < 5; i++) { const parts = []; const n = 4 + (rnd() * 3 | 0); for (let j = 0; j < n; j++) parts.push(G.xf(geo.ico, T((j - n / 2) * 1.6 + rnd(), rnd() * 0.8, rnd() * 1.4 - 0.7, rnd() * 6, 0, 0, 2.2 + rnd() * 1.6, 1.6 + rnd() * 1.2, 2 + rnd()), '#ffffff')); cloudGeo.push(E.mesh([].concat(...parts))); }
    const clouds = []; for (let i = 0; i < 26; i++) clouds.push({ m: i % 5, x: -160 + rnd() * 320, y: i < 14 ? 16 + rnd() * 14 : -26 - rnd() * 14, z: -140 + rnd() * 300, s: 1.2 + rnd() * 2.2, v: 0.4 + rnd() * 0.6 });

    // ============================================================ CHARACTERS
    const mT = new Float32Array(16), mA = new Float32Array(16), mB = new Float32Array(16);
    function part(base, mesh, x, y, z, yaw, pit, rol, sx, sy, sz, col, o) { T(x, y, z, yaw, pit, rol, sx, sy, sz, mT); mul(base, mT, mA); D(mesh, mA, col, o); }
    // look = {skin, shirt, pants, hat} (or an old [skin, shirt, pants] array). opt.emote = {k, t}
    // look = {skin, shirt, pants, hat} (or an old [skin, shirt, pants] array).
    // opt: emote {k,t}, phase (walk cycle, radians), speed (m/s), vy (vertical speed, 0 on the ground), air (bool), land (0..1 squash)
    const mH = new Float32Array(16), mK = new Float32Array(16), mR = new Float32Array(16);
    WD.char = function (x, y, z, yaw, t, mv, up, look, opt) {
      opt = opt || {}; const sc = opt.scale || 1;
      if (Array.isArray(look)) look = { skin: look[0], shirt: look[1], pants: look[2], hat: opt.crown ? 'crown' : 'none' };
      const em = opt.emote && opt.emote.t < 3.2 ? opt.emote : null, et = em ? em.t : 0;
      const air = !!opt.air && !em, vy = opt.vy || 0, kUp = air ? clampN(vy / 7, 0, 1) : 0, kDown = air ? clampN(-vy / 7, 0, 1) : 0;
      const amt = mv && !air ? clampN((opt.speed || 6) / 6, 0.4, 1.4) : 0, ph = opt.phase !== undefined ? opt.phase : t * 11;
      const land = opt.land || 0;
      let bob = 0, spin = 0;
      if (em && em.k === 'dance') { bob = Math.abs(Math.sin(et * 8)) * 0.18; spin = Math.sin(et * 4) * 0.7; }
      bob += amt * Math.abs(Math.sin(ph)) * 0.09;
      // root (feet) with landing squash, then the upper body leans and sways from the hips
      const root = T(x, y + bob, z, yaw + spin, 0, 0, sc * (1 + 0.1 * land), sc * (1 - 0.16 * land), sc * (1 + 0.1 * land), mR);
      const lean = amt * 0.13 - kDown * 0.1 + kUp * 0.05, sway = amt * Math.sin(ph) * 0.05;
      T(0, 0.92, 0, amt * Math.sin(ph) * 0.06, lean, sway, 1, 1, 1, mT); mul(root, mT, mB); T(0, -0.92, 0, 0, 0, 0, 1, 1, 1, mT);
      const base = mul(mB, mT, new Float32Array(16));
      const br = Math.sin(t * 2) * 0.02 * (1 - amt);
      let sw = Math.sin(ph) * 0.75 * amt;
      if (em && em.k === 'dance') sw = Math.sin(et * 8) * 0.5;
      const skin = look.skin, shirt = look.shirt, pants = look.pants, shoe = shade(pants, 0.55);
      // legs: thigh from the hip, shin from the knee, little shoe
      for (const s of [-1, 1]) {
        let th = s * sw, kn = amt * Math.max(0, Math.sin(ph * s + (s > 0 ? 0 : Math.PI) + 1.2)) * 0.9 * (s > 0 ? 1 : 1);
        if (amt) kn = Math.max(0, Math.sin(ph + (s > 0 ? 0.6 : Math.PI + 0.6))) * 1.0 * amt;
        if (air) {
          th = th * (1 - kUp - kDown) + kUp * (s > 0 ? -0.95 : 0.35) + kDown * (s * 0.22 + Math.sin(t * 9 + s) * 0.12);
          kn = kn * (1 - kUp - kDown) + kUp * (s > 0 ? 1.3 : 0.55) + kDown * 0.35;
        }
        if (em && em.k === 'dance') kn = Math.max(0, Math.sin(et * 8 + (s > 0 ? 0 : Math.PI))) * 0.7;
        T(s * 0.21, 0.92, 0, 0, th, s * kDown * 0.15, 1, 1, 1, mT); mul(root, mT, mH);
        T(0, -0.24, 0, 0, 0, 0, 0.4, 0.5, 0.44, mT); mul(mH, mT, mA); D(ms.rb, mA, pants);
        T(0, -0.46, 0, 0, kn, 0, 1, 1, 1, mT); mul(mH, mT, mK);
        T(0, -0.22, 0, 0, 0, 0, 0.38, 0.48, 0.42, mT); mul(mK, mT, mA); D(ms.rb, mA, pants);
        T(0, -0.44, 0.06, 0, 0, 0, 0.4, 0.14, 0.54, mT); mul(mK, mT, mA); D(ms.rb, mA, shoe);
      }
      const pulse = em && em.k === 'flex' ? 1 + Math.abs(Math.sin(et * 6)) * 0.08 : 1;
      part(base, ms.rb, 0, 1.42 + br, 0, 0, 0, 0, 0.84 * pulse, 1.0, 0.48 * pulse, shirt);
      part(base, ms.rb, 0, 1.18 + br, 0.0, 0, 0, 0, 0.86, 0.14, 0.5, shade(pants, 0.8));
      part(base, ms.rb, 0, 1.18 + br, 0.255, 0, 0, 0, 0.18, 0.1, 0.02, '#e8c860');
      // arms (pivot at shoulder) with a bend at the elbow when running
      for (const s of [-1, 1]) {
        let pit = -s * sw - up * 2.6 + Math.sin(t * 1.5 + s) * 0.04 * (1 - amt), rol = -s * 0.06, elb = amt * 0.5;
        if (air) { pit = pit * (1 - kUp - kDown) + kUp * -2.5 + kDown * (-2.4 + Math.sin(t * 15 + s * 1.7) * 0.6); rol = rol * (1 - kUp - kDown) + kUp * -s * 0.3 + kDown * -s * (0.75 + Math.sin(t * 11 + s) * 0.25); elb = elb * (1 - kUp - kDown) + kDown * 0.3; }
        if (em) {
          elb = 0;
          if (em.k === 'wave' && s === 1) { pit = -2.9; rol = -0.3 + Math.sin(et * 12) * 0.4; }
          if (em.k === 'dance') { pit = -1.5 + Math.sin(et * 8 + (s > 0 ? 0 : Math.PI)) * 1.1; }
          if (em.k === 'flex') { pit = -0.2; rol = s * 2.0; elb = -1.8; }
          if (em.k === 'tap' && s === 1) { pit = -1.5 + Math.sin(et * 30) * 0.55; }
        }
        T(s * 0.62, 1.86 + br, 0, 0, pit, rol, 1, 1, 1, mT); mul(base, mT, mH);
        T(0, -0.23, 0, 0, 0, 0, 0.37 * pulse, 0.5, 0.42 * pulse, mT); mul(mH, mT, mA); D(ms.rb, mA, shirt);
        T(0, -0.46, 0, 0, -elb, 0, 1, 1, 1, mT); mul(mH, mT, mK);
        T(0, -0.24, 0, 0, 0, 0, 0.34 * pulse, 0.52, 0.38 * pulse, mT); mul(mK, mT, mA); D(ms.rb, mA, skin);
      }
      // head + face (looks around a little when idle)
      const hy = 2.3 + br, look2 = (1 - amt) * Math.sin(t * 0.7 + x) * 0.25 * (air ? 0 : 1);
      T(0, hy, 0, look2, kDown * -0.15, 0, 1, 1, 1, mT); const head = mul(base, mT, new Float32Array(16));
      part(head, ms.rb2, 0, 0, 0, 0, 0, 0, 0.82, 0.8, 0.8, skin);
      part(head, ms.quad, 0, -0.02, 0.415, 0, 0, 0, 0.7, 0.7, 1, '#ffffff', { tex: kDown > 0.5 ? faceTexO : faceTex, mode: 3, cull: true });
      // hats
      const hat = look.hat || 'none';
      if (hat === 'crown') { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; part(head, ms.cone, Math.cos(a) * 0.3, 0.56, Math.sin(a) * 0.3, 0, 0, 0, 0.16, 0.32, 0.16, '#ffd84a', { emis: 0.25 }); } part(head, ms.cyl, 0, 0.44, 0, 0, 0, 0, 0.72, 0.14, 0.72, '#ffcc33', { emis: 0.2 }); }
      else if (hat === 'cap') { part(head, ms.rb2, 0, 0.36, -0.02, 0, 0, 0, 0.88, 0.3, 0.86, shirt); part(head, ms.rb, 0, 0.26, 0.55, 0, -0.1, 0, 0.8, 0.07, 0.42, shade(shirt, 0.8)); }
      else if (hat === 'tophat') { part(head, ms.cyl, 0, 0.45, 0, 0, 0, 0, 1.1, 0.06, 1.1, '#151515'); part(head, ms.cyl, 0, 0.85, 0, 0, 0, 0, 0.62, 0.8, 0.62, '#1c1c1c'); part(head, ms.cyl, 0, 0.55, 0, 0, 0, 0, 0.64, 0.12, 0.64, '#c0392b'); }
      else if (hat === 'phones') { part(head, ms.torus, 0, 0.1, 0, Math.PI / 2, Math.PI / 2, 0, 0.5, 0.5, 0.5, '#2a2a3a'); for (const sd of [-1, 1]) part(head, ms.cyl, sd * 0.45, 0, 0, 0, 0, Math.PI / 2, 0.36, 0.16, 0.36, '#ff3d6e', { emis: 0.2 }); }
      else if (hat === 'halo') part(head, ms.ring, 0, 0.72 + Math.sin(t * 3) * 0.04, 0, t, 0, 0, 0.42, 1, 0.42, '#fff6a0', { emis: 1.2 });
      else if (hat === 'helmet') { part(head, ms.sph, 0, 0.02, 0, 0, 0, 0, 1.28, 1.25, 1.25, '#bfe8ff', { alpha: 0.32, depthWrite: false, noShadow: true }); part(head, ms.torus, 0, -0.55, 0, 0, 0, 0, 0.62, 0.9, 0.62, '#e8eef8', { tex: 'metal', texMode: 2 }); }
      if (em && em.k === 'tap' && Math.random() < 0.4) { const p = M.apply(base, 0.62, 1.1, 0.5); E.particle({ x: p[0], y: p[1], z: p[2], vx: (Math.random() - 0.5) * 3, vy: 3, vz: (Math.random() - 0.5) * 3, life: 0.5, size: 0.25, g: 8, col: '#ffe14d', add: true }); }
      if (em && em.k === 'dance' && Math.random() < 0.15) E.particle({ x: x + (Math.random() - 0.5) * 2, y: y + 0.5 + Math.random() * 2, z: z + (Math.random() - 0.5) * 2, vx: 0, vy: 1, vz: 0, life: 0.9, size: 0.3, col: ['#ff3d9a', '#5ec8ff', '#ffd84a'][Math.random() * 3 | 0], add: true });
    };
    WD.charCols = (name, rb) => { const h = L.hash(name) % 360, hsl = (hh, sa, l) => { const k = n => (n + hh / 30) % 12, a = sa * Math.min(l, 1 - l); return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))); }; return { skin: '#f5cd2f', shirt: hsl(h, 0.7, 0.5), pants: hsl((h + 150) % 360, 0.5, 0.35), hat: rb ? 'crown' : 'none' }; };

    // ============================================================ PETS
    WD.pet = function (p, x, y, z, yaw, t, V, i) {
      const col = p.col, base = T(x, y, z, yaw, 0, 0, p.r >= 5 ? 1.25 : 1), hop = Math.abs(Math.sin(t * 6 + i)) * 0.12;
      part(base, ms.sph, 0, 0.34 + hop, 0, 0, 0, 0, 0.78, 0.68, 0.74, col, { emis: p.r >= 5 ? 0.3 + 0.15 * Math.sin(t * 4) : p.r >= 4 ? 0.12 : 0 });
      part(base, ms.sph, 0, 0.28 + hop, 0.18, 0, 0, 0, 0.5, 0.4, 0.42, shade(col, 1.18));
      const earType = p.id % 3;
      for (const s of [-1, 1]) {
        if (earType === 0) part(base, ms.cone, s * 0.22, 0.78 + hop, 0, 0, 0, s * -0.35, 0.22, 0.3, 0.16, shade(col, 0.85));
        else if (earType === 1) part(base, ms.sph, s * 0.24, 0.72 + hop, -0.02, 0, 0, 0, 0.2, 0.2, 0.12, shade(col, 0.85));
        else part(base, ms.rb, s * 0.16, 0.84 + hop, 0, 0, 0, s * -0.15, 0.1, 0.34, 0.08, shade(col, 0.85));
        part(base, ms.sphLo, s * 0.2, 0.06, 0.06, 0, 0, 0, 0.18, 0.12, 0.22, shade(col, 0.7));
      }
      part(base, ms.quad, 0, 0.42 + hop, 0.375, 0, 0, 0, 0.5, 0.5, 1, '#ffffff', { tex: petFaceTex, mode: 3 });
      if (p.shiny) {
        part(base, ms.sph, 0, 0.34 + hop, 0, 0, 0, 0, 0.98, 0.88, 0.94, '#ffe680', { alpha: 0.28 + 0.12 * Math.sin(t * 5 + i), add: true, depthWrite: false, noShadow: true });
        if (V.parts && Math.random() < 0.35) E.particle({ x: x + (Math.random() - 0.5) * 0.9, y: y + 0.3 + Math.random() * 0.6, z: z + (Math.random() - 0.5) * 0.9, vx: 0, vy: 0.5, vz: 0, life: 0.7, size: 0.22, col: '#fff2a0', add: true });
      }
      if (p.r === 6 && V.parts && Math.random() < 0.8) E.particle({ x: x + (Math.random() - 0.5) * 0.3, y: y + 0.3, z: z + (Math.random() - 0.5) * 0.3, vx: 0, vy: 0.1, vz: 0, life: 1.2, size: 0.3, col: hsl2rgb((t * 200 + Math.random() * 60) % 360), add: true });
      const rc = C.RARITIES[p.r].c;
      if (p.r >= 4) { // halo
        const hue = p.r === 6 ? `hsl(${(t * 120) % 360},90%,65%)` : null;
        const hc = p.r === 6 ? hsl2rgb((t * 120) % 360) : M.hex(rc);
        part(base, ms.ring, 0, 1.05 + hop + Math.sin(t * 3) * 0.04, 0, t, 0, 0, 0.28, 1, 0.28, hc, { emis: 1 });
      }
      if (p.r >= 3 && V.parts && Math.random() < (p.r >= 5 ? 0.5 : 0.12)) {
        const c = p.r === 6 ? hsl2rgb(Math.random() * 360) : p.r === 5 ? (Math.random() < 0.5 ? '#ff2e63' : '#200010') : rc;
        E.particle({ x: x + (Math.random() - 0.5) * 0.8, y: y + 0.4 + Math.random() * 0.5, z: z + (Math.random() - 0.5) * 0.8, vx: 0, vy: 0.6 + Math.random() * 0.6, vz: 0, life: 0.9, size: p.r >= 5 ? 0.35 : 0.22, col: c, add: p.r !== 5 || Math.random() < 0.5 });
      }
    };
    function hsl2rgb(h) { const k = n => (n + h / 30) % 12, a = 0.9 * Math.min(0.62, 0.38); return [0, 8, 4].map(n => 0.62 - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))); }
    WD.hsl2rgb = hsl2rgb;

    // ============================================================ BOSS: THE TAP TITAN
    const wingGeo = (() => { // membrane between 4 bone tips, local: root at 0, wing extends to +x
      const a = [], pts = [[0, 0, 0], [0.6, 1.0, 0], [3.4, 1.6, 0], [3.0, 0.5, 0], [4.2, -0.2, 0], [3.0, -0.8, 0], [3.4, -1.6, 0], [2.3, -1.5, 0], [1.8, -2.4, 0], [1.0, -1.3, 0], [0.3, -1.0, 0]];
      for (let i = 1; i < pts.length - 1; i++) {
        for (const p of [pts[0], pts[i], pts[i + 1]]) a.push(p[0], p[1], p[2], 0, 0, 1, 1, 1, 1, p[0] / 4, p[1] / 4);
      }
      return E.mesh(a);
    })();
    const B = { flash: 0, roar: 0, dieT: -1, scale: 1.8 };
    WD.boss = B;
    WD.drawBoss = function (V, t) {
      const b = V.boss; if (!b && B.dieT < 0) return;
      const hpf = b ? b.hp / b.max : 0, phase = hpf > 0.66 ? 0 : hpf > 0.33 ? 1 : 2;
      const dying = B.dieT >= 0, dt2 = dying ? t - B.dieT : 0;
      if (dying && dt2 > 2.2) { B.dieT = -1; return; }
      const PAL = [['#7a3cff', '#b98aff', '#ffe14d'], ['#e0602a', '#ffb070', '#ff3d1f'], ['#c01830', '#ff6070', '#ffffff']][phase];
      const flash = B.flash; B.flash = Math.max(0, B.flash - V.dt * 6); B.roar = Math.max(0, B.roar - V.dt);
      const shakeX = phase === 2 ? (Math.random() - 0.5) * 0.12 : 0;
      const bx = W.BOSS[0] + shakeX, by = 5.4 + Math.sin(t * 1.6) * 0.45 + (dying ? -dt2 * dt2 * 3 : 0), bz = W.BOSS[2];
      const s = B.scale * (dying ? Math.max(0.01, 1 - dt2 * 0.45) : 1), yaw = Math.atan2(V.P.x - bx, V.P.z - bz) * 0.7;
      const base = T(bx, by, bz, yaw, 0, 0, s), em = flash * 1.2 + (dying ? dt2 : 0);
      const body = M.hex(PAL[0]), belly = M.hex(PAL[1]), eye = M.hex(PAL[2]);
      const breath = 1 + Math.sin(t * 2.4) * 0.03;
      part(base, ms.sph, 0, 0, 0, 0, 0.15, 0, 2.5 * breath, 2.7, 2.1 * breath, body, { emis: em });
      part(base, ms.sph, 0, -0.1, 0.62, 0, 0.15, 0, 1.7, 2.0, 1.0, belly, { emis: em });
      for (let i = 0; i < 4; i++) part(base, ms.rb, 0, 0.7 - i * 0.45, 1.08, 0, 0.1, 0, 0.9 - i * 0.08, 0.08, 0.06, shade(PAL[1], 0.75), { emis: em });
      // head
      const hp = Math.sin(t * 1.3) * 0.08, jaw = 0.15 + B.roar * 0.5 + (phase === 2 ? Math.abs(Math.sin(t * 6)) * 0.15 : 0);
      T(0, 1.75, 0.35, 0, hp, 0, 1, 1, 1, mT); const head = mul(base, mT, new Float32Array(16));
      part(head, ms.sph, 0, 0.35, 0, 0, 0, 0, 1.75, 1.5, 1.6, body, { emis: em });
      part(head, ms.rb2, 0, 0.2, 0.75, 0, 0, 0, 1.05, 0.62, 0.9, shade(PAL[0], 1.1), { emis: em });
      T(0, -0.05, 0.4, 0, jaw, 0, 1, 1, 1, mT); const jm = mul(head, mT, new Float32Array(16));
      part(jm, ms.rb2, 0, -0.12, 0.42, 0, 0, 0, 0.95, 0.3, 0.82, shade(PAL[0], 0.85), { emis: em });
      for (let i = 0; i < 4; i++) { const x = -0.33 + i * 0.22; part(head, ms.cone, x, -0.02, 1.05, 0, Math.PI, 0, 0.1, 0.22, 0.1, '#fffbe8'); part(jm, ms.cone, x + 0.11, 0.05, 0.75, 0, 0, 0, 0.09, 0.18, 0.09, '#fffbe8'); }
      for (const sx of [-1, 1]) {
        part(head, ms.sph, sx * 0.42, 0.62, 0.62, 0, 0, sx * 0.25, 0.42, 0.3, 0.2, eye, { emis: 1.6 });
        part(head, ms.rb, sx * 0.42, 0.62, 0.71, 0, 0, 0, 0.07, 0.22, 0.05, '#120010', { emis: 0 });
        part(head, ms.rb, sx * 0.45, 0.88, 0.62, 0, 0, sx * (phase ? 0.5 : 0.3), 0.5, 0.1, 0.16, shade(PAL[0], 0.6));
        // curved horns: chain of cones
        T(sx * 0.62, 0.95, -0.05, 0, 0, sx * -0.55, 1, 1, 1, mT); let hm = mul(head, mT, new Float32Array(16));
        for (let i = 0; i < 4; i++) {
          const w = 0.34 - i * 0.07;
          part(hm, ms.cyl, 0, 0.22, 0, 0, 0, 0, w, 0.48, w, i < 3 ? '#f2e8cf' : '#2a2030', { emis: em * 0.4 });
          T(0, 0.42, 0, 0, -0.18, sx * 0.32, 1, 1, 1, mT); hm = mul(hm, mT, new Float32Array(16));
        }
        part(hm, ms.cone, 0, 0.25, 0, 0, 0, 0, 0.14, 0.5, 0.14, '#2a2030');
        // wings
        const flap = Math.sin(t * (phase === 2 ? 7 : phase === 1 ? 5 : 3.2)) * 0.45 + 0.2;
        T(sx * 1.3, 1.2, -0.75, sx > 0 ? 0.35 : Math.PI - 0.35, 0, flap * sx, 1, 1, 1, mT); const wm = mul(base, mT, new Float32Array(16));
        const wscale = T(0, 0, 0, 0, 0, 0, 1.15, 1.15, 1.15, new Float32Array(16)); const wmm = mul(wm, wscale, new Float32Array(16));
        D(wingGeo, wmm, shade(PAL[0], 0.7), { cull: false, emis: 0.15 + em * 0.5 });
        for (const [ex, ey, l] of [[3.4, 1.6, 3.8], [4.2, -0.2, 4.2], [3.4, -1.6, 3.8], [1.8, -2.4, 3]]) {
          const ang = Math.atan2(ey, ex); T(0, 0, 0.02, 0, 0, ang - Math.PI / 2, 1, 1, 1, mT); const bm = mul(wmm, mT, new Float32Array(16));
          part(bm, ms.cyl, 0, -l / 2, 0, 0, 0, 0, 0.1, l, 0.1, '#2a1a30');
        }
        // arms + claws
        const swing = Math.sin(t * 2 + sx) * 0.3 - (V.bossHitAnim || 0) * 0.6;
        T(sx * 1.95, 0.6, 0.3, 0, swing, sx * 0.5, 1, 1, 1, mT); const am = mul(base, mT, new Float32Array(16));
        part(am, ms.sph, 0, 0, 0, 0, 0, 0, 0.9, 0.9, 0.9, body, { emis: em });
        part(am, ms.rb2, 0, -0.8, 0.1, 0, 0, 0, 0.6, 1.3, 0.6, body, { emis: em });
        for (let i = 0; i < 3; i++) part(am, ms.cone, (i - 1) * 0.18, -1.55, 0.25, 0, -0.5, (i - 1) * 0.3, 0.14, 0.4, 0.14, '#f2e8cf');
      }
      // tail
      let tm = mul(base, T(0, -1.6, -0.9, 0, 0.9, 0, 1, 1, 1, mT), new Float32Array(16));
      for (let i = 0; i < 6; i++) {
        const w = 0.7 - i * 0.1;
        part(tm, ms.sph, 0, 0, 0, 0, 0, 0, w, w, 0.9, body, { emis: em });
        T(0, 0, -0.62, Math.sin(t * 2 + i * 0.6) * 0.25, 0.12, 0, 1, 1, 1, mT); tm = mul(tm, mT, new Float32Array(16));
      }
      part(tm, ms.cone, 0, 0, -0.2, 0, -Math.PI / 2, 0, 0.5, 0.8, 0.2, eye, { emis: 0.8 });
      // spikes along back
      for (let i = 0; i < 5; i++) part(base, ms.cone, 0, 1.3 - i * 0.55, -1.0 + Math.abs(i - 2) * 0.05, 0, -0.5 - i * 0.12, 0, 0.32, 0.6, 0.32, '#2a2030');
      // floating rune halo
      const hm2 = T(bx, by + 5.2 * s / B.scale + Math.sin(t * 2) * 0.2, bz, t * 0.6, 0, 0, 2.2 * s / B.scale, 1, 2.2 * s / B.scale);
      D(ms.torus, hm2, eye, { emis: 1.4 });
      D(ms.quad, mul(T(bx, by + 5.2 * s / B.scale + Math.sin(t * 2) * 0.2, bz, -t * 0.4, -Math.PI / 2, 0, 5 * s / B.scale), T(0, 0, 0)), '#ffffff', { tex: runeTex, mode: 3, cull: false, add: true, alpha: 0.85 });
      for (let i = 0; i < 6; i++) { const a = t * 1.2 + i / 6 * 6.283; D(ms.rb, T(bx + Math.cos(a) * 4.8, by + Math.sin(t * 3 + i) * 0.6, bz + Math.sin(a) * 4.8, a, t, 0, 0.45), eye, { emis: 1.2 }); }
      // aura particles
      if (V.parts) {
        const n = phase === 2 ? 3 : phase === 1 ? 2 : 1;
        for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, r = 3 + Math.random() * 2;
          E.particle({ x: bx + Math.cos(a) * r, y: by - 2 + Math.random() * 6, z: bz + Math.sin(a) * r, vx: 0, vy: 1 + Math.random() * 2, vz: 0, life: 1.2, size: 0.5, col: phase === 2 ? (Math.random() < 0.3 ? '#ffffff' : '#ff2a2a') : PAL[1], add: true }); }
        if (phase === 2 && Math.random() < 0.08) for (let i = 0; i < 12; i++) E.particle({ x: bx + (Math.random() - 0.5) * 2, y: by + 6 - i * 0.6, z: bz + (Math.random() - 0.5) * 2, vx: 0, vy: 0, vz: 0, life: 0.25, size: 0.8, col: '#e8f0ff', add: true });
      }
      if (b) V.labels.push({ bar: hpf, x: bx, y: by + 8.5, z: bz });
    };
    WD.bossBurst = function (win) {
      const bx = W.BOSS[0], by = 4.8, bz = W.BOSS[2];
      for (let i = 0; i < 160; i++) { const a = Math.random() * 6.283, e = Math.random() * 3 - 1, sp = 6 + Math.random() * 12;
        E.particle({ x: bx, y: by, z: bz, vx: Math.cos(a) * sp, vy: e * sp * 0.6 + 4, vz: Math.sin(a) * sp, life: 1.6 + Math.random(), size: 0.5 + Math.random() * 0.5, g: 9, drag: 0.8,
          col: win ? ['#ffd84a', '#ffffff', '#ff9a00', '#7dff6a'][i % 4] : '#8a7aa8', add: win }); }
    };
    WD.bossHit = function (x, y, z) {
      B.flash = 1; if (Math.random() < 0.04) B.roar = 0.8;
      for (let i = 0; i < 5; i++) E.particle({ x: x + (Math.random() - 0.5), y: y + (Math.random() - 0.5), z: z + (Math.random() - 0.5), vx: (Math.random() - 0.5) * 8, vy: Math.random() * 6, vz: (Math.random() - 0.5) * 8, life: 0.5, size: 0.35, g: 14, col: ['#ffe14d', '#ffffff', '#ff7a2a'][i % 3], add: true });
    };

    // ============================================================ PER-FRAME DYNAMIC WORLD
    let fishT = [0, 0, 0];
    WD.draw = function (V, t) {
      const cx = V.cam[0], cz = V.cam[2], far2 = (E.far + 10) * (E.far + 10), near = (x, z, r) => (x - cx) * (x - cx) + (z - cz) * (z - cz) < (r ? r * r : far2);
      const s = V.s, st = W.STN, dt = V.dt;
      // signs (two-sided quads)
      for (const sg of signs) if (near(sg.x, sg.z, 70)) {
        const cy = Math.cos(sg.yaw), sy = Math.sin(sg.yaw);
        D(ms.quad, T(sg.x + sy * 0.12, sg.y, sg.z + cy * 0.12, sg.yaw, 0, 0, sg.w, sg.h, 1), '#ffffff', { tex: sg.tex, mode: 3 });
        D(ms.quad, T(sg.x - sy * 0.12, sg.y, sg.z - cy * 0.12, sg.yaw + Math.PI, 0, 0, sg.w, sg.h, 1), '#ffffff', { tex: sg.tex, mode: 3 });
      }
      // pads
      for (const p of pads) {
        if (!near(p.x, p.z, 60)) continue;
        if (p.k.startsWith('gate') && s.open.includes(+p.k.slice(4))) continue;
        const pulse = 0.75 + 0.25 * Math.sin(t * 3 + p.x), active = V.near === p.k;
        D(ms.quad, T(p.x, 0.07, p.z, t * 0.3, -Math.PI / 2, 0, active ? 2.9 : 2.5), '#ffffff', { tex: p.tex, mode: 3, alpha: pulse, cull: false });
        if (active && V.parts && Math.random() < 0.3) E.particle({ x: p.x + (Math.random() - 0.5) * 2, y: 0.1, z: p.z + (Math.random() - 0.5) * 2, vx: 0, vy: 1.5, vz: 0, life: 0.8, size: 0.25, col: p.c, add: true });
      }
      // lamps + arena crystals
      for (const l of lamps) if (near(l[0], l[2], 70)) D(ms.sph, T(l[0], l[1], l[2], 0, 0, 0, 0.42), '#fff2b0', { emis: 1.1, noShadow: true });
      WD.arenaPillars.forEach((p, i) => { if (near(p[0], p[2], 70)) D(ms.gem, T(p[0], p[1] + Math.sin(t * 2 + i) * 0.2, p[2], t + i, 0, 0, 0.9), V.boss ? '#ff4d6d' : '#c08aff', { emis: 0.9 }); });
      if (near(W.BOSS[0], W.BOSS[2], 60)) D(ms.quad, T(W.BOSS[0], 0.1, W.BOSS[2], t * 0.2, -Math.PI / 2, 0, 12), '#ffffff', { tex: runeTex, mode: 3, alpha: V.boss ? 0.9 : 0.35, cull: false, add: true });
      // world map globe
      if (near(st.map.x, st.map.z, 60)) D(ms.sph, T(st.map.x, 3.3, st.map.z - 2.2, t * 0.5, 0.3, 0, 1.7), '#ffffff', { tex: globeTex, texMode: 1 });
      // rebirth portal
      if (near(st.reb.x, st.reb.z, 60)) {
        D(ms.quad, T(st.reb.x, 2.2, st.reb.z - 2.3, 0, 0, t, 3.6), '#ffffff', { mode: 4, cull: false, alpha: 0.95 });
        D(ms.torus, T(st.reb.x, 2.2, st.reb.z - 2.3, 0, Math.PI / 2, 0, 1.75, 1.75, 1.75), '#d58aff', { emis: 0.8 });
        if (V.parts && Math.random() < 0.4) { const a = Math.random() * 6.283; E.particle({ x: st.reb.x + Math.cos(a) * 1.7, y: 2.2 + Math.sin(a) * 1.7, z: st.reb.z - 2.2, vx: -Math.cos(a), vy: -Math.sin(a), vz: 0.3, life: 1, size: 0.3, col: '#e9b3ff', add: true }); }
      }
      // lucky wheel
      if (near(st.wheel.x, st.wheel.z, 60)) {
        V.wheelRot = (V.wheelRot || 0) + dt * (V.wheelSpin > 0 ? 9 * V.wheelSpin : 0.3);
        D(ms.cyl, T(st.wheel.x, 3, st.wheel.z - 1.35, 0, Math.PI / 2, 0, 3, 0.25, 3), '#ffd84a', { emis: 0.1 });
        D(ms.quad, T(st.wheel.x, 3, st.wheel.z - 1.21, 0, 0, V.wheelRot, 2.9), '#ffffff', { tex: wheelTex, mode: 3 });
        D(ms.cone, T(st.wheel.x, 4.7, st.wheel.z - 1.15, 0, 0, Math.PI, 0.35, 0.6, 0.2), '#ff3d3d', { emis: 0.3 });
      }
      // obby gate flag
      if (near(st.obby.x, st.obby.z, 40)) V.labels.push({ t: s.obbyBest ? '🏆 Your best: ' + Math.floor(s.obbyBest / 60) + ':' + (s.obbyBest % 60).toFixed(1).padStart(4, '0') : 'No best time yet', x: st.obby.x, y: 0.9, z: st.obby.z - 1.2, sz: 12, c: '#ffe9a8' });
      if (near(st.obby.x, st.obby.z, 60)) D(ms.quad, T(st.obby.x, 3.05, st.obby.z - 1.15, 0, Math.sin(t * 3) * 0.1, 0, 3, 0.7, 1), '#ffffff', { tex: flagTex, mode: 3, cull: false });
      // chest
      if (near(st.chest.x, st.chest.z, 60)) {
        const ready = s.chest <= V.now, lid = ready ? 0.35 + Math.sin(t * 3) * 0.1 : 0;
        D(ms.rb, mul(T(st.chest.x, 1.02, st.chest.z - 2.65, 0, -lid, 0), T(0, 0.18, 0.65, 0, 0, 0, 2.05, 0.4, 1.35)), '#b8741e', { tex: 'wood', texMode: 2 });
        if (ready) { D(ms.sph, T(st.chest.x, 1.3, st.chest.z - 2, 0, 0, 0, 0.9, 0.4, 0.6), '#ffd84a', { emis: 0.9 }); if (V.parts && Math.random() < 0.2) E.particle({ x: st.chest.x + (Math.random() - 0.5), y: 1.4, z: st.chest.z - 2, vx: 0, vy: 2, vz: 0, life: 1, size: 0.3, col: '#ffe14d', add: true }); }
        V.labels.push({ t: ready ? 'OPEN ME!' : L.fmt(Math.ceil((s.chest - V.now) / 1000)) + 's', x: st.chest.x, y: 2.6, z: st.chest.z - 2, sz: 15, c: ready ? '#ffd84a' : '#ccc' });
      }
      // AFK pad gear hologram
      if (near(st.afk.x, st.afk.z, 60)) {
        const ok = L.canAutoTap(s);
        D(ms.torus, T(st.afk.x, 2.2 + Math.sin(t * 2) * 0.15, st.afk.z, t * 1.5, Math.PI / 2, 0, 0.7), ok ? '#2bff88' : '#777', { emis: ok ? 0.8 : 0 });
        for (let i = 0; i < 8; i++) { const a = t * 1.5 + i / 8 * 6.283; D(ms.rb, T(st.afk.x + Math.cos(a) * 0.85, 2.2 + Math.sin(t * 2) * 0.15 + Math.sin(a) * 0.85, st.afk.z, 0, 0, a, 0.25, 0.25, 0.15), ok ? '#2bff88' : '#777', { emis: ok ? 0.8 : 0 }); }
        if (!ok) V.labels.push({ t: '🔒 Rebirth 1', x: st.afk.x, y: 3.4, z: st.afk.z, sz: 13, c: '#ff9a9a' });
      }
      // gem shop gem, quest papers
      if (near(st.gems.x, st.gems.z, 60)) D(ms.gem, T(st.gems.x, 2.2 + Math.sin(t * 2) * 0.2, st.gems.z - 2, t, 0, 0, 1.3), '#3df5ff', { emis: 0.6 });
      if (near(st.quests.x, st.quests.z, 60)) for (let i = 0; i < 3; i++) D(ms.quad, T(st.quests.x - 1 + i, 1.9, st.quests.z - 1.86, Math.sin(t * 2 + i) * 0.05, 0, (i - 1) * 0.08, 0.8, 1.1, 1), V.questDone && V.questDone[i] ? '#b8ffb0' : '#fff6dc', { mode: 3 });
      // podium players
      const PDZ = W.PODIUM.z, PDX = W.PODIUM.x;
      if (near(PDX, PDZ, 60) && V.board) [[0, 1.8], [-2.2, 1.2], [2.2, 0.8]].forEach((q, i) => {
        const e = V.board[i]; if (!e) return;
        WD.char(PDX + q[0], q[1], PDZ, 0, t, 0, i === 0 ? 0.3 + Math.sin(t * 5) * 0.12 : 0, WD.charCols(e[0], e[2]), { crown: i === 0 });
        V.labels.push({ t: e[0], x: PDX + q[0], y: q[1] + 3.4, z: PDZ, sz: 13 }, { t: L.fmt(e[1]), x: PDX + q[0], y: q[1] + 3, z: PDZ, sz: 11, c: '#ffd84a' });
      });
      // carousel
      if (near(W.CAROUSEL.x, W.CAROUSEL.z, 60)) {
        D(ms.cone, T(W.CAROUSEL.x, 4.4, W.CAROUSEL.z, t * 0.5, 0, 0, 7, 1.6, 7), '#ffd84a', {});
        for (let i = 0; i < 4; i++) { const an = t * 0.8 + i * 1.57, hx = W.CAROUSEL.x + Math.cos(an) * 2.1, hz = W.CAROUSEL.z + Math.sin(an) * 2.1, hy = 1.2 + Math.sin(t * 3 + i) * 0.3;
          D(ms.cyl, T(hx, 2.3, hz, 0, 0, 0, 0.06, 3.6, 0.06), '#fff3d0'); D(ms.rb2, T(hx, hy, hz, -an, 0, 0, 0.5, 0.6, 1.1), ['#ff5d8f', '#4fc3ff', '#7dff6a', '#c25cff'][i]); D(ms.rb2, T(hx + Math.cos(an + 1.57) * 0.5, hy + 0.45, hz + Math.sin(an + 1.57) * 0.5, -an, 0, 0, 0.35, 0.5, 0.35), ['#ff5d8f', '#4fc3ff', '#7dff6a', '#c25cff'][i]); }
      }
      // fountain + pond water and fish
      if (near(W.FOUNTAIN.x, W.FOUNTAIN.z, 60)) {
        D(ms.disc, T(W.FOUNTAIN.x, 0.45, W.FOUNTAIN.z, 0, 0, 0, 5.5, 1, 5.5), '#4fb8ff', { mode: 1, alpha: 0.85 });
        D(ms.disc, T(W.FOUNTAIN.x, 2.12, W.FOUNTAIN.z, 0, 0, 0, 2.4, 1, 2.4), '#4fb8ff', { mode: 1, alpha: 0.85 });
        if (V.parts && Math.random() < 0.7) { const a = Math.random() * 6.283; E.particle({ x: W.FOUNTAIN.x, y: 3.1, z: W.FOUNTAIN.z, vx: Math.cos(a) * 1.2, vy: 3 + Math.random(), vz: Math.sin(a) * 1.2, life: 0.9, size: 0.18, col: '#d6f3ff', g: 9, add: true }); }
      }
      if (near(W.POND.x, W.POND.z, 60)) {
        D(ms.disc, T(W.POND.x, 0.08, W.POND.z, 0, 0, 0, 8.4, 1, 6), '#3aa0e8', { mode: 1, alpha: 0.9 });
        for (let i = 0; i < 3; i++) {
          const a = t * 0.7 + i * 2.1, fx = W.POND.x + Math.cos(a) * 2.4, fz = W.POND.z + Math.sin(a) * 1.6;
          fishT[i] -= dt; let fy = -0.05;
          if (fishT[i] < -6 - i * 2) { fishT[i] = 0.8; if (V.parts) for (let k = 0; k < 6; k++) E.particle({ x: fx, y: 0.1, z: fz, vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 2, vz: (Math.random() - 0.5) * 2, life: 0.6, size: 0.15, g: 10, col: '#d6f3ff', add: true }); }
          if (fishT[i] > 0) fy = Math.sin((0.8 - fishT[i]) / 0.8 * Math.PI) * 1.2;
          D(ms.sph, T(fx, fy + 0.05, fz, a + Math.PI, fishT[i] > 0 ? Math.cos((0.8 - fishT[i]) / 0.8 * Math.PI) * 0.8 : 0, 0, 0.3, 0.26, 0.6), '#ff8a3d', {});
          D(ms.cone, T(fx - Math.cos(a + Math.PI / 2) * 0.35, fy + 0.05, fz - Math.sin(a + Math.PI / 2) * 0.35, a + Math.PI, Math.PI / 2, 0, 0.3, 0.25, 0.08), '#ffb07a', {});
        }
      }
      // locked bridge barriers + garden barrier
      W.BRG.forEach((b, k) => { if (s.open.includes(k) || !near(b[0], b[1], 60)) return; const v = b[0] === b[2];
        D(ms.box, T(b[0], 1.3, b[1], v ? 0 : Math.PI / 2, 0, 0, 4.2, 2.6, 0.1), '#ff2a2a', { alpha: 0.32 + 0.12 * Math.sin(t * 5), noShadow: true, cull: false }); });
      if (!(s.clicks >= C.GARDEN_CLICKS) && near(W.GATE_X, 0, 60)) {
        D(ms.box, T(W.GATE_X - 0.4, 1.8, 0, Math.PI / 2, 0, 0, 4, 3.6, 0.1), '#ffcc33', { alpha: 0.35 + 0.12 * Math.sin(t * 5), noShadow: true, cull: false });
        V.labels.push({ t: L.fmt(s.clicks) + ' / ' + L.fmt(C.GARDEN_CLICKS) + ' clicks', x: W.GATE_X - 0.4, y: 4.6, z: 0, sz: 13, c: '#ffd84a' });
      }
      // gate labels
      W.GP.forEach((p, k) => { if (!near(p[0], p[1], 40)) return; const o = s.open.includes(k), a = C.AREAS[k];
        V.labels.push({ t: o ? 'OPEN · cross the bridge' : '🔒 ' + L.fmt(a.cost) + ' taps' + (a.rb ? ' + ' + a.rb + ' rebirth' + (a.rb > 1 ? 's' : '') : ''), x: p[0], y: 1.2, z: p[1], sz: 11, c: o ? '#7dff6a' : '#ffb3b3' }); });
      // egg shops
      WD.eggShops.forEach(([x, y, z, k]) => { if (!near(x, z)) return;
        D(ms.egg, T(x, y + Math.sin(t * 1.8 + k) * 0.25, z, t * 0.6, 0, Math.sin(t * 2) * 0.08, 2.2), '#ffffff', { tex: eggTex[k], texMode: 1 });
        if (V.parts && Math.random() < 0.15) E.particle({ x: x + (Math.random() - 0.5) * 2, y: y + Math.random() * 2, z: z + (Math.random() - 0.5) * 2, vx: 0, vy: 0.5, vz: 0, life: 1.2, size: 0.25, col: '#ffffff', add: true }); });
      // jump pads
      W.JP.forEach(j => { if (near(j[0], j[1], 60)) { D(ms.disc, T(j[0], 0.26 + Math.abs(Math.sin(t * 4)) * 0.05, j[1], 0, 0, 0, 2.6, 1, 2.6), '#ffd000', { emis: 0.6 }); V.labels.push({ t: 'MEGA BOUNCE', x: j[0], y: 1, z: j[1], sz: 11, c: '#ffe0a0' }); } });
      // gems
      W.GEMS.forEach((g, i) => { if (!near(g[0], g[1], 70) || (s.gemT[i] || 0) > V.now || V.gemPending[i] > V.now) return;
        const y = g[2] + Math.sin(t * 3 + i) * 0.2; D(ms.gem, T(g[0], y, g[1], t * 2 + i, 0, 0, 0.8), '#3df5ff', { emis: 0.55 });
        if (V.parts && Math.random() < 0.05) E.particle({ x: g[0], y, z: g[1], vx: (Math.random() - 0.5), vy: 1, vz: (Math.random() - 0.5), life: 0.8, size: 0.2, col: '#bffcff', add: true }); });
      // desert rocks
      W.ROCKS.forEach((r, i) => { if (!near(r[0], r[1], 70)) return; const hp = V.rockHp[i], gone = (s.rockT[i] || 0) > V.now; if (gone) return;
        const f = 0.65 + hp * 0.07, sh = V.rockShake[i] > 0 ? (Math.random() - 0.5) * 0.15 : 0;
        D(ms.ico, T(r[0] + sh, 0.6 * f, r[1], i, 0, 0, 2 * f, 1.4 * f, 2 * f), '#8a6a4a', { tex: 'rock', texMode: 2 });
        for (let k = 0; k < 3; k++) D(ms.gem, T(r[0] + Math.cos(k * 2 + i) * 0.6 * f + sh, 1.1 * f, r[1] + Math.sin(k * 2 + i) * 0.6 * f, k, 0.4, 0, 0.45 * f), '#ffd000', { emis: 0.4 }); });
      // lava + geysers
      const LV = W.LAVA; if (near((LV.x1 + LV.x2) / 2, (LV.z1 + LV.z2) / 2)) {
        D(ms.box, T((LV.x1 + LV.x2) / 2, 0.02, (LV.z1 + LV.z2) / 2, 0, 0, 0, LV.x2 - LV.x1, 0.06, LV.z2 - LV.z1), '#ff5a1a', { mode: 2, noShadow: true });
        D(ms.sph, T(W.CEN[3][0] - 12, 6.2, W.CEN[3][1] - 12, 0, 0, 0, 2 + Math.sin(t * 4) * 0.2), '#ff7a00', { mode: 2 });
        if (V.parts && Math.random() < 0.3) E.particle({ x: W.CEN[3][0] - 12 + (Math.random() - 0.5) * 1.5, y: 6.6, z: W.CEN[3][1] - 12, vx: (Math.random() - 0.5) * 2, vy: 4 + Math.random() * 3, vz: (Math.random() - 0.5) * 2, life: 1.4, size: 0.35, g: 4, col: ['#ff9a00', '#ffd000', '#ff3d1f'][Math.random() * 3 | 0], add: true });
        for (const q of V.geysers) {
          if (q.t < 1.2) D(ms.disc, T(q.x, 0.1, q.z, 0, 0, 0, 3.2, 1, 3.2), '#ff2a00', { alpha: 0.35 + 0.35 * Math.sin(t * 20), mode: 3, noShadow: true });
          else if (q.t < 1.8) { D(ms.cyl, T(q.x, 2.2, q.z, t * 3, 0, 0, 1.5, 4.4, 1.5), '#ff7a00', { mode: 2 }); if (V.parts) E.particle({ x: q.x, y: 4.4, z: q.z, vx: (Math.random() - 0.5) * 4, vy: 4, vz: (Math.random() - 0.5) * 4, life: 0.8, size: 0.4, g: 9, col: '#ffd24d', add: true }); }
        }
      }
      // space ring crystals
      if (near(W.CEN[4][0], W.CEN[4][1])) for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.4; if (inHangar(W.CEN[4][0] + Math.cos(a) * 14, W.CEN[4][1] + Math.sin(a) * 14)) continue; D(ms.gem, T(W.CEN[4][0] + Math.cos(a) * 14, 3.6 + Math.sin(t * 2 + i) * 0.25, W.CEN[4][1] + Math.sin(a) * 14, t, 0, 0, 0.9), '#ffffff', { emis: 0.9 }); }
      // clouds
      for (const c of clouds) {
        c.x += c.v * dt; if (c.x > 170) c.x = -170;
        if (near(c.x, c.z, E.far + 40)) D(cloudGeo[c.m], T(c.x, c.y, c.z, 0, 0, 0, c.s), V.cloudCol, { emis: 0.35, noShadow: true });
      }
      // obby
      if (V.P.x > W.OB - 60) {
        W.PL.forEach((q, i) => { if (q.gone) return;
          if (Math.abs(q.x - V.P.x) > 70) return;
          const col = q.finish ? '#ffd000' : q.cp ? '#50c85a' : q.k === 1 ? '#4aa8ff' : q.k === 2 ? '#d9a066' : q.k === 3 ? '#c25cff' : q.k === 4 ? '#8a94a8' : hslStr(`hsl(${i * 14},80%,62%)`);
          const blink = q.k === 2 && q.t > 0 ? 0.5 + 0.5 * Math.sin(t * 40) : 0, shakeX = q.k === 2 && q.t > 0 ? Math.sin(t * 60) * 0.06 : 0;
          D(ms.rb, T(q.x + shakeX, q.y - 0.3, q.z, 0, 0, 0, q.s, 0.6, q.s), col, { tex: 'tile', texMode: 2, emis: blink * 0.5 });
          if (q.k === 3) for (const sd of [-1, 1]) D(ms.cone, T(q.x, q.y - 0.9 + sd * 0.05, q.z, 0, sd > 0 ? 0 : Math.PI, 0, 0.35, 0.5, 0.35), '#e0b0ff', { emis: 0.4 });
          if (q.bar) {
            const a = t * q.bar.spd + q.ph;
            D(ms.cyl, T(q.x, q.y + 0.35, q.z, 0, 0, 0, 0.5, 0.7, 0.5), '#2a2f3a', { tex: 'metal', texMode: 2 });
            D(ms.rb, T(q.x, q.y + q.bar.h, q.z, -a, 0, 0, q.bar.r * 2, 0.3, 0.3), '#ff1a1a', { emis: 0.55 + 0.25 * Math.sin(t * 8) });
            for (const sd of [-1, 1]) D(ms.sph, T(q.x + Math.cos(a) * q.bar.r * sd, q.y + q.bar.h, q.z + Math.sin(a) * q.bar.r * sd, 0, 0, 0, 0.42), '#ff5a1a', { emis: 0.5 });
          }
          if (q.cp && !q.finish && i) { D(ms.cyl, T(q.x, q.y + 1, q.z - q.s / 2 + 0.3, 0, 0, 0, 0.08, 2, 0.08), '#dddddd'); D(ms.quad, T(q.x + 0.35, q.y + 1.7, q.z - q.s / 2 + 0.3, 0, Math.sin(t * 4 + i) * 0.15, 0, 0.7, 0.45, 1), i <= (V.obbyCk || 0) * 8 ? '#3dff6a' : '#ff3333', { cull: false }); }
        });
        for (const b of W.KILL) if (Math.abs(b.x - V.P.x) < 70) {
          D(ms.box, T(b.x, b.y, b.z, 0, 0, 0, b.w, b.h, b.d), '#ff1a1a', { emis: 0.55 + 0.25 * Math.sin(t * 8 + b.p), noShadow: true });
          if (V.parts && Math.random() < 0.1) E.particle({ x: b.x + (Math.random() - 0.5) * b.w, y: b.y + b.h / 2, z: b.z + (Math.random() - 0.5) * b.d, vx: 0, vy: 1, vz: 0, life: 0.5, size: 0.2, col: '#ff5a3a', add: true });
        }
        const L0 = W.PL[0], LN = W.PL[W.PL.length - 1];
        V.labels.push({ t: 'OBBY START', x: L0.x, y: L0.y + 2.5, z: L0.z, sz: 14, c: '#ff9a4d' }, { t: '🏁 FINISH', x: LN.x, y: LN.y + 2.8, z: LN.z, sz: 18, c: '#ffd84a' });
        W.PL.forEach((q, i) => { if (q.cp && i && !q.finish && Math.abs(q.x - V.P.x) < 40) V.labels.push({ t: 'CHECKPOINT ' + (i / 8), x: q.x, y: q.y + 2.6, z: q.z, sz: 12, c: '#7dff6a' }); });
      }
      // ---- island detail animation
      const AN = WD.anim;
      AN.mills.forEach(([x, y, z]) => { if (!near(x, z, 80)) return; const r = t * 1.4;
        D(ms.cyl, T(x, y, z + 0.1, 0, Math.PI / 2, 0, 0.5, 0.4, 0.5), '#6b4a2b');
        for (let i = 0; i < 4; i++) { const b = r + i * Math.PI / 2; D(ms.rb, mul(T(x, y, z + 0.3, 0, 0, b), T(0, 2.2, 0, 0, 0, 0, 0.9, 4.2, 0.08)), i % 2 ? '#f2e6d0' : '#ffffff', { tex: 'wood', texMode: 2 }); } });
      (AN.ponds || []).forEach(([x, z, rx, rz]) => { if (near(x, z, 70)) D(ms.disc, T(x, 0.08, z, 0, 0, 0, rx * 2, 1, rz * 2), '#3aa0e8', { mode: 1, alpha: 0.9 }); });
      AN.cascades.forEach(([x, z]) => { if (!near(x, z, 80)) return;
        D(ms.box, T(x - 0.3, -4, z, 0, 0, 0, 0.3, 8, 2.6), '#7ad0ff', { alpha: 0.55, mode: 3, noShadow: true, add: true });
        if (V.parts) for (let i = 0; i < 2; i++) E.particle({ x: x - 0.4, y: 0, z: z + (Math.random() - 0.5) * 2.4, vx: -0.6, vy: -2, vz: 0, life: 1.6, size: 0.5, g: 6, col: '#e0f6ff', a: 0.8, add: true }); });
      AN.flies.forEach(([x, z, r]) => { if (!near(x, z, 60) || !V.parts) return; for (let i = 0; i < 5; i++) { const a = t * (0.4 + i * 0.07) + i * 1.3, fx = x + Math.cos(a) * r * (0.3 + i * 0.12), fz = z + Math.sin(a * 1.3) * r * 0.6, fy = 1.4 + Math.sin(t * 3 + i) * 0.5, fl = Math.abs(Math.sin(t * 18 + i));
        for (const sd of [-1, 1]) D(ms.quad, T(fx, fy, fz, a + Math.PI / 2, 0, sd * (0.3 + fl * 1.1), 0.35, 0.3, 1), ['#ffd000', '#ff7ab8', '#7ad7ff', '#ffffff', '#ff9a3d'][i], { mode: 3, cull: false }); } });
      if (AN.choco && near(AN.choco[0], AN.choco[1], 70)) D(ms.box, T(AN.choco[0], 0.06, AN.choco[1], 0, 0, 0, 5, 0.04, 5), '#6a3a1a', { mode: 1, alpha: 0.95 });
      AN.cotton.forEach(([x, y, z, ph], i) => { if (!near(x, z, 80)) return; const yy = y + Math.sin(t * 0.7 + ph) * 0.5;
        for (let j = 0; j < 3; j++) D(ms.sph, T(x + (j - 1) * 0.9, yy + (j % 2) * 0.3, z, 0, 0, 0, 1.4 - (j % 2) * 0.3), ['#ffb3d9', '#c9b3ff', '#b3ecff', '#ffffff'][i % 4], { emis: 0.25, noShadow: true }); });
      if (AN.oasis && near(AN.oasis[0], AN.oasis[1], 70)) D(ms.disc, T(AN.oasis[0], 0.1, AN.oasis[1], 0, 0, 0, 5.2, 1, 5.2), '#2ab8c8', { mode: 1, alpha: 0.92 });
      AN.weeds.forEach(w => { if (!near(w.cx, w.cz, 80)) return; const a = t * w.sp + w.ph, x = w.cx + Math.cos(a) * w.R * 0.8, z = w.cz + Math.sin(a * 1.7) * w.R * 0.7, hop = Math.abs(Math.sin(t * 3 + w.ph)) * 0.6;
        D(ms.ico, T(x, 0.6 + hop, z, t * 2.5, t * 3, 0, 1.1), '#a07a40', { tex: 'grass', texMode: 2 }); D(ms.ico, T(x, 0.6 + hop, z, -t * 2, t, 0.5, 0.8), '#8a6430', {}); });
      AN.falls.forEach(([x, z]) => { if (!near(x, z, 90)) return;
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.6, f = 0.8 + Math.sin(t * 3 + i) * 0.1; D(ms.box, T(x + Math.cos(a) * 1.9, 3, z + Math.sin(a) * 1.9, -a, 0.18, 0, 0.6 * f, 5.6, 0.7), '#ff7a00', { mode: 2 }); }
        if (V.parts && Math.random() < 0.5) E.particle({ x: x + (Math.random() - 0.5) * 3, y: 0.3, z: z + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 2, vy: 3, vz: (Math.random() - 0.5) * 2, life: 0.8, size: 0.35, g: 6, col: '#ffb000', add: true }); });
      (AN.cracks || []).forEach(([x, z, a, l]) => { if (near(x, z, 60)) D(ms.box, T(x, 0.03, z, a, 0, 0, 0.16, 0.04, l), '#ff5a00', { emis: 0.8 + 0.4 * Math.sin(t * 2 + x), noShadow: true }); });
      AN.embers.forEach(([x, z, r]) => { if (near(x, z, 60) && V.parts && Math.random() < 0.6) E.particle({ x: x + (Math.random() - 0.5) * r * 2, y: 0.2, z: z + (Math.random() - 0.5) * r * 2, vx: (Math.random() - 0.5) * 0.6, vy: 1 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 0.6, life: 3, size: 0.18, col: Math.random() < 0.5 ? '#ffb000' : '#ff5a1a', add: true }); });
      AN.blinks.forEach(([x, y, z], i) => { if (!near(x, z, 90)) return; const on = Math.sin(t * 3 + i * 1.7) > 0.2; D(ms.sph, T(x, y, z, 0, 0, 0, 0.4), on ? '#ff2a2a' : '#4a1010', { emis: on ? 2 : 0, noShadow: true }); });
      AN.holos.forEach(([x, y, z]) => { if (!near(x, z, 70)) return;
        D(ms.sph, T(x, y + Math.sin(t) * 0.15, z, t * 0.6, 0.3, 0, 2.2), '#5ec8ff', { tex: globeTex, texMode: 1, mode: 3, alpha: 0.55, add: true, noShadow: true });
        D(ms.ring, T(x, y + Math.sin(t) * 0.15, z, -t, 0.4, 0, 1.8, 1, 1.8), '#7ad7ff', { emis: 1.2, noShadow: true });
        D(ms.cone, T(x, 1.2, z, 0, 0, 0, 1.6, 1.6, 1.6), '#5ec8ff', { mode: 3, alpha: 0.18, add: true, noShadow: true, cull: false }); });
      AN.roids.forEach(([cx2, cz2, r, y, ph, sp, sz], i) => { if (!near(cx2, cz2, 100)) return; const a = t * sp + ph; D(ms.ico, T(cx2 + Math.cos(a) * r, y + Math.sin(t * 0.5 + i) * 0.6, cz2 + Math.sin(a) * r, t * 0.3 + i, t * 0.2, 0, sz), '#6a6a80', { tex: 'rock', texMode: 2 }); });
      // hangar rocket (rises during a launch)
      if (near(W.ROCKET[0], W.ROCKET[1], 90)) WD.launchRocket(W.ROCKET[0], 0.35, W.ROCKET[1], 1, V.launch && V.launch.from === 'hub' ? V.launch.t : 0, t, V);
      if (near(W.MOON.x, W.MOON.z, W.MOON.r + 80)) WD.drawMoon(V, t, near);
      WD.drawBoss(V, t);
    };
    function hslStr(s) { const m = s.match(/hsl\((\d+),(\d+)%,(\d+)%\)/); const h = +m[1] % 360, sa = m[2] / 100, l = m[3] / 100, k = n => (n + h / 30) % 12, a = sa * Math.min(l, 1 - l); return [0, 8, 4].map(n => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))); }
    return WD;
  };
})(typeof self !== 'undefined' ? self : this);
