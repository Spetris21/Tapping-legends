/* Tapping Legends - tiny WebGL renderer (no libraries needed).
   Lighting, soft shadow maps, fog, sky, procedural textures, static batching, particles.
   Works on WebGL2 or WebGL1. */
(function (root) {
  'use strict';
  // ================================================================ MATH (column-major mat4)
  const M = {};
  M.ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  M.mul = function (a, b, o) {
    o = o || new Float32Array(16);
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
      o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
      o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
      o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
    }
    return o;
  };
  M.persp = function (fovy, asp, n, f) {
    const t = 1 / Math.tan(fovy / 2), o = new Float32Array(16);
    o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o;
  };
  M.ortho = function (l, r, b, t, n, f) {
    const o = new Float32Array(16);
    o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o;
  };
  M.lookAt = function (e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2], l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
      -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
  };
  M.invert = function (m) {
    const o = new Float32Array(16), a = m;
    const b00 = a[0] * a[5] - a[1] * a[4], b01 = a[0] * a[6] - a[2] * a[4], b02 = a[0] * a[7] - a[3] * a[4], b03 = a[1] * a[6] - a[2] * a[5],
      b04 = a[1] * a[7] - a[3] * a[5], b05 = a[2] * a[7] - a[3] * a[6], b06 = a[8] * a[13] - a[9] * a[12], b07 = a[8] * a[14] - a[10] * a[12],
      b08 = a[8] * a[15] - a[11] * a[12], b09 = a[9] * a[14] - a[10] * a[13], b10 = a[9] * a[15] - a[11] * a[13], b11 = a[10] * a[15] - a[11] * a[14];
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; if (!d) return M.ident(); d = 1 / d;
    o[0] = (a[5] * b11 - a[6] * b10 + a[7] * b09) * d; o[1] = (a[2] * b10 - a[1] * b11 - a[3] * b09) * d; o[2] = (a[13] * b05 - a[14] * b04 + a[15] * b03) * d; o[3] = (a[10] * b04 - a[9] * b05 - a[11] * b03) * d;
    o[4] = (a[6] * b08 - a[4] * b11 - a[7] * b07) * d; o[5] = (a[0] * b11 - a[2] * b08 + a[3] * b07) * d; o[6] = (a[14] * b02 - a[12] * b05 - a[15] * b01) * d; o[7] = (a[8] * b05 - a[10] * b02 + a[11] * b01) * d;
    o[8] = (a[4] * b10 - a[5] * b08 + a[7] * b06) * d; o[9] = (a[1] * b08 - a[0] * b10 - a[3] * b06) * d; o[10] = (a[12] * b04 - a[13] * b02 + a[15] * b00) * d; o[11] = (a[9] * b02 - a[8] * b04 - a[11] * b00) * d;
    o[12] = (a[5] * b07 - a[4] * b09 - a[6] * b06) * d; o[13] = (a[0] * b09 - a[1] * b07 + a[2] * b06) * d; o[14] = (a[13] * b01 - a[12] * b03 - a[14] * b00) * d; o[15] = (a[8] * b03 - a[9] * b01 + a[10] * b00) * d;
    return o;
  };
  // translate * rotY(yaw) * rotX(pitch) * rotZ(roll) * scale
  M.trs = function (x, y, z, yaw, pitch, roll, sx, sy, sz, o) {
    o = o || new Float32Array(16);
    yaw = yaw || 0; pitch = pitch || 0; roll = roll || 0;
    if (sx === undefined) sx = 1; if (sy === undefined) sy = sx; if (sz === undefined) sz = sx;
    const cy = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
    // R = Ry * Rx * Rz
    const r00 = cy * cr + syw * sp * sr, r01 = cp * sr, r02 = -syw * cr + cy * sp * sr;
    const r10 = -cy * sr + syw * sp * cr, r11 = cp * cr, r12 = syw * sr + cy * sp * cr;
    const r20 = syw * cp, r21 = -sp, r22 = cy * cp;
    o[0] = r00 * sx; o[1] = r01 * sx; o[2] = r02 * sx; o[3] = 0;
    o[4] = r10 * sy; o[5] = r11 * sy; o[6] = r12 * sy; o[7] = 0;
    o[8] = r20 * sz; o[9] = r21 * sz; o[10] = r22 * sz; o[11] = 0;
    o[12] = x; o[13] = y; o[14] = z; o[15] = 1;
    return o;
  };
  M.apply = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
  M.hex = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };
  M.col = c => typeof c === 'string' ? M.hex(c) : c;
  M.lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // ================================================================ GEOMETRY (non-indexed, interleaved pos3 nrm3 col3 uv2)
  const G = {};
  const STRIDE = 11;
  function push(a, p, n, uv) { a.push(p[0], p[1], p[2], n[0], n[1], n[2], 1, 1, 1, uv[0], uv[1]); }
  G.STRIDE = STRIDE;
  // make every triangle counter-clockwise when seen from the side its normals point to
  function fix(a) {
    for (let k = 0; k < a.length; k += STRIDE * 3) {
      const b = k + STRIDE, c = k + STRIDE * 2;
      const ux = a[b] - a[k], uy = a[b + 1] - a[k + 1], uz = a[b + 2] - a[k + 2], vx = a[c] - a[k], vy = a[c + 1] - a[k + 1], vz = a[c + 2] - a[k + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const mx = a[k + 3] + a[b + 3] + a[c + 3], my = a[k + 4] + a[b + 4] + a[c + 4], mz = a[k + 5] + a[b + 5] + a[c + 5];
      if (nx * mx + ny * my + nz * mz < 0) for (let i = 0; i < STRIDE; i++) { const t = a[b + i]; a[b + i] = a[c + i]; a[c + i] = t; }
    }
    return a;
  }
  G.fix = fix;
  // rounded box: subdivided cube pushed out from an inner box
  G.box = function (w, h, d, r) {
    const hw = w / 2, hh = h / 2, hd = d / 2, a = [];
    r = Math.min(r || 0, hw, hh, hd);
    const ticks = (e) => r > 0.001 ? [-e, -e + r * 0.3, -e + r, e - r, e - r * 0.3, e] : [-e, e];
    const ix = hw - r, iy = hh - r, iz = hd - r;
    const P = (x, y, z) => {
      if (r <= 0.001) return null;
      const cx = Math.max(-ix, Math.min(ix, x)), cy = Math.max(-iy, Math.min(iy, y)), cz = Math.max(-iz, Math.min(iz, z));
      let dx = x - cx, dy = y - cy, dz = z - cz; const l = Math.hypot(dx, dy, dz);
      if (l < 1e-6) return null; dx /= l; dy /= l; dz /= l;
      return [[cx + dx * r, cy + dy * r, cz + dz * r], [dx, dy, dz]];
    };
    const face = (axis, sign) => {
      const [u, v, e1, e2, e0] = axis === 0 ? [2, 1, hd, hh, hw] : axis === 1 ? [0, 2, hw, hd, hh] : [0, 1, hw, hh, hd];
      const tu = ticks(e1), tv = ticks(e2);
      const vert = (iu, iv) => {
        const p = [0, 0, 0]; p[axis] = sign * e0; p[u] = tu[iu]; p[v] = tv[iv];
        const nn = [0, 0, 0]; nn[axis] = sign;
        const q = P(p[0], p[1], p[2]);
        return { p: q ? q[0] : p, n: q ? q[1] : nn, uv: [(tu[iu] + e1) / (2 * e1), (tv[iv] + e2) / (2 * e2)] };
      };
      for (let i = 0; i < tu.length - 1; i++) for (let j = 0; j < tv.length - 1; j++) {
        let A = vert(i, j), B = vert(i + 1, j), Cc = vert(i + 1, j + 1), D = vert(i, j + 1);
        // keep counter-clockwise winding facing outwards
        const flip = (axis === 1) ? sign < 0 : sign > 0;
        if (axis === 0 ? sign < 0 : flip) { const t = B; B = D; D = t; }
        push(a, A.p, A.n, A.uv); push(a, B.p, B.n, B.uv); push(a, Cc.p, Cc.n, Cc.uv);
        push(a, A.p, A.n, A.uv); push(a, Cc.p, Cc.n, Cc.uv); push(a, D.p, D.n, D.uv);
      }
    };
    for (let ax = 0; ax < 3; ax++) { face(ax, 1); face(ax, -1); }
    return fix(a);
  };
  // lathe around Y. pts = [[radius, y], ...] from bottom to top
  G.lathe = function (pts, seg, smooth) {
    const a = [], N = [];
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)];
      let dr = p1[0] - p0[0], dy = p1[1] - p0[1]; const l = Math.hypot(dr, dy) || 1;
      N.push([dy / l, -dr / l]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      let n0 = N[i], n1 = N[i + 1];
      if (smooth === false) { const dr = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dr, dy) || 1; n0 = n1 = [dy / l, -dr / l]; }
      for (let s = 0; s < seg; s++) {
        const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const v = (pt, nn, c, sn, u, vv) => ({ p: [pt[0] * c, pt[1], pt[0] * sn], n: [nn[0] * c, nn[1], nn[0] * sn], uv: [u, vv] });
        const A = v(pts[i], n0, c0, s0, s / seg, i / pts.length), B = v(pts[i], n0, c1, s1, (s + 1) / seg, i / pts.length),
          Cc = v(pts[i + 1], n1, c1, s1, (s + 1) / seg, (i + 1) / pts.length), D = v(pts[i + 1], n1, c0, s0, s / seg, (i + 1) / pts.length);
        push(a, A.p, A.n, A.uv); push(a, Cc.p, Cc.n, Cc.uv); push(a, B.p, B.n, B.uv);
        push(a, A.p, A.n, A.uv); push(a, D.p, D.n, D.uv); push(a, Cc.p, Cc.n, Cc.uv);
      }
    }
    return fix(a);
  };
  G.sphere = function (r, seg, rings) {
    seg = seg || 16; rings = rings || 10; const pts = [];
    for (let i = 0; i <= rings; i++) { const t = -Math.PI / 2 + Math.PI * i / rings; pts.push([Math.cos(t) * r, Math.sin(t) * r]); }
    pts[0][0] = 0; pts[rings][0] = 0;
    return G.lathe(pts, seg);
  };
  G.cyl = function (rt, rb, h, seg, caps) {
    seg = seg || 12; const a = G.lathe([[rb, -h / 2], [rt, h / 2]], seg, false);
    if (caps !== false) {
      if (rt > 0) a.push(...G.disc(rt, seg, h / 2, 1));
      if (rb > 0) a.push(...G.disc(rb, seg, -h / 2, -1));
    }
    return a;
  };
  G.disc = function (r, seg, y, dir) {
    const a = []; y = y || 0; dir = dir || 1;
    for (let s = 0; s < seg; s++) {
      const a0 = s / seg * Math.PI * 2, a1 = (s + 1) / seg * Math.PI * 2;
      const p0 = [Math.cos(a0) * r, y, Math.sin(a0) * r], p1 = [Math.cos(a1) * r, y, Math.sin(a1) * r];
      const uv = p => [p[0] / (2 * r) + 0.5, p[2] / (2 * r) + 0.5], n = [0, dir, 0], c = [0, y, 0];
      if (dir > 0) { push(a, c, n, [0.5, 0.5]); push(a, p1, n, uv(p1)); push(a, p0, n, uv(p0)); }
      else { push(a, c, n, [0.5, 0.5]); push(a, p0, n, uv(p0)); push(a, p1, n, uv(p1)); }
    }
    return fix(a);
  };
  G.torus = function (R, r, seg, tube) {
    seg = seg || 24; tube = tube || 8; const a = [];
    const P = (i, j) => { const u = i / seg * Math.PI * 2, v = j / tube * Math.PI * 2, cx = Math.cos(u), sx = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
      return { p: [(R + r * cv) * cx, r * sv, (R + r * cv) * sx], n: [cv * cx, sv, cv * sx], uv: [i / seg, j / tube] }; };
    for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) {
      const A = P(i, j), B = P(i + 1, j), Cc = P(i + 1, j + 1), D = P(i, j + 1);
      push(a, A.p, A.n, A.uv); push(a, Cc.p, Cc.n, Cc.uv); push(a, B.p, B.n, B.uv);
      push(a, A.p, A.n, A.uv); push(a, D.p, D.n, D.uv); push(a, Cc.p, Cc.n, Cc.uv);
    }
    return fix(a);
  };
  G.quad = function (w, h) { // facing +Z, centered
    const a = [], n = [0, 0, 1], x = w / 2, y = h / 2;
    push(a, [-x, -y, 0], n, [0, 1]); push(a, [x, -y, 0], n, [1, 1]); push(a, [x, y, 0], n, [1, 0]);
    push(a, [-x, -y, 0], n, [0, 1]); push(a, [x, y, 0], n, [1, 0]); push(a, [-x, y, 0], n, [0, 0]);
    return a;
  };
  G.plane = function (w, d, nx, nz) { // facing +Y, subdivided
    const a = [], n = [0, 1, 0]; nx = nx || 1; nz = nz || 1;
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const x0 = -w / 2 + w * i / nx, x1 = -w / 2 + w * (i + 1) / nx, z0 = -d / 2 + d * j / nz, z1 = -d / 2 + d * (j + 1) / nz;
      const uv = (x, z) => [x / w + 0.5, z / d + 0.5];
      push(a, [x0, 0, z0], n, uv(x0, z0)); push(a, [x0, 0, z1], n, uv(x0, z1)); push(a, [x1, 0, z1], n, uv(x1, z1));
      push(a, [x0, 0, z0], n, uv(x0, z0)); push(a, [x1, 0, z1], n, uv(x1, z1)); push(a, [x1, 0, z0], n, uv(x1, z0));
    }
    return a;
  };
  G.egg = (r, h, seg) => { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12, ang = -Math.PI / 2 + Math.PI * t, k = t > 0.5 ? 0.82 + 0.18 * (1 - (t - 0.5) * 2) : 1; pts.push([Math.cos(ang) * r * k, Math.sin(ang) * h / 2 * (t > 0.5 ? 1.15 : 1)]); } pts[0][0] = 0; pts[12][0] = 0; return G.lathe(pts, seg || 16); };
  G.ico = function (r, jag, seed) { // chunky low-poly blob (for bushes/rocks)
    const t = (1 + Math.sqrt(5)) / 2, V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    let sd = seed || 1; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const P = V.map(v => { const l = Math.hypot(...v), k = r * (1 + (rnd() - 0.5) * (jag || 0)); return v.map(c => c / l * k); });
    const a = [];
    for (const f of F) {
      const p0 = P[f[0]], p1 = P[f[1]], p2 = P[f[2]];
      const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2], vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      push(a, p0, [nx, ny, nz], [0, 0]); push(a, p1, [nx, ny, nz], [1, 0]); push(a, p2, [nx, ny, nz], [0, 1]);
    }
    return a;
  };
  // transform + recolor a geometry (returns new array)
  G.xf = function (geo, m, col) {
    col = col ? M.col(col) : null;
    // normal matrix = inverse transpose of upper 3x3
    const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
    const A = e * i - f * h, B = -(d * i - f * g), Cc = d * h - e * g, det = a * A + b * B + c * Cc || 1;
    const n00 = A / det, n01 = B / det, n02 = Cc / det, n10 = -(b * i - c * h) / det, n11 = (a * i - c * g) / det, n12 = -(a * h - b * g) / det,
      n20 = (b * f - c * e) / det, n21 = -(a * f - c * d) / det, n22 = (a * e - b * d) / det;
    const o = new Array(geo.length);
    for (let k = 0; k < geo.length; k += STRIDE) {
      const x = geo[k], y = geo[k + 1], z = geo[k + 2], nx = geo[k + 3], ny = geo[k + 4], nz = geo[k + 5];
      o[k] = m[0] * x + m[4] * y + m[8] * z + m[12]; o[k + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; o[k + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      let qx = n00 * nx + n01 * ny + n02 * nz, qy = n10 * nx + n11 * ny + n12 * nz, qz = n20 * nx + n21 * ny + n22 * nz; const l = Math.hypot(qx, qy, qz) || 1;
      o[k + 3] = qx / l; o[k + 4] = qy / l; o[k + 5] = qz / l;
      o[k + 6] = col ? col[0] * geo[k + 6] : geo[k + 6]; o[k + 7] = col ? col[1] * geo[k + 7] : geo[k + 7]; o[k + 8] = col ? col[2] * geo[k + 8] : geo[k + 8];
      o[k + 9] = geo[k + 9]; o[k + 10] = geo[k + 10];
    }
    return o;
  };
  G.merge = (...gs) => [].concat(...gs);

  // ================================================================ PROCEDURAL TEXTURES
  function noiseTex(size, fn) {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
    fn(x, size); return c;
  }
  let sd = 99; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const TEXGEN = {
    white: (g, s) => { g.fillStyle = '#fff'; g.fillRect(0, 0, s, s); },
    grass: (g, s) => {
      g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 2600; i++) { const v = 170 + rnd() * 85 | 0; g.fillStyle = `rgb(${v},${v},${v})`; const x = rnd() * s, y = rnd() * s; g.fillRect(x, y, 1.5, 3 + rnd() * 5); }
      for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(rnd() * s, rnd() * s, 6 + rnd() * 18, 0, 7); g.fill(); }
    },
    dirt: (g, s) => {
      g.fillStyle = '#bbb'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 16) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.12})`; g.fillRect(0, y + rnd() * 4, s, 6 + rnd() * 6); }
      for (let i = 0; i < 260; i++) { const v = 120 + rnd() * 120 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 2 + rnd() * 7, 1.5 + rnd() * 4, 0, 0, 7); g.fill(); }
    },
    tile: (g, s) => {
      g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, s, s); const n = 4, w = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const v = 205 + rnd() * 45 | 0, off = (j % 2) * w / 2;
        g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect((i * w + off) % s + 3, j * w + 3, w - 6, w - 6);
        if (off) { g.fillRect(-w / 2 + 3, j * w + 3, w - 6, w - 6); }
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect((i * w + off) % s + 3, j * w + 3, w - 6, 3);
      }
      for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.08})`; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
    },
    wood: (g, s) => {
      const n = 4, h = s / n;
      for (let j = 0; j < n; j++) {
        const v = 190 + rnd() * 50 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, j * h, s, h);
        for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(0,0,0,${0.05 + rnd() * 0.08})`; g.lineWidth = 1; g.beginPath(); const y = j * h + rnd() * h; g.moveTo(0, y); g.bezierCurveTo(s * 0.3, y + rnd() * 6 - 3, s * 0.6, y + rnd() * 6 - 3, s, y); g.stroke(); }
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, j * h, s, 3); g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, j * h + 3, s, 2);
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(((j * 97) % s), j * h, 3, h);
      }
    },
    sand: (g, s) => {
      g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, s, s);
      for (let y = 0; y < s; y += 10) { g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 3; g.beginPath(); for (let x = 0; x <= s; x += 8) g.lineTo(x, y + Math.sin(x / s * Math.PI * 4 + y) * 3); g.stroke(); }
      for (let i = 0; i < 3000; i++) { const v = 170 + rnd() * 85 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(rnd() * s, rnd() * s, 1, 1); }
    },
    candy: (g, s) => {
      g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s);
      const cols = ['#ff6fae', '#7fd8ff', '#fff176', '#b388ff', '#9cff8f', '#ffffff'];
      for (let i = 0; i < 160; i++) { g.save(); g.translate(rnd() * s, rnd() * s); g.rotate(rnd() * 3.14); g.fillStyle = cols[rnd() * cols.length | 0]; g.fillRect(-5, -1.5, 10, 3); g.restore(); }
    },
    metal: (g, s) => {
      g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, s, s); const n = 2, w = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const gr = g.createLinearGradient(i * w, j * w, i * w + w, j * w + w); gr.addColorStop(0, '#e8e8e8'); gr.addColorStop(1, '#b4b4b4');
        g.fillStyle = gr; g.fillRect(i * w + 2, j * w + 2, w - 4, w - 4);
        g.fillStyle = '#888'; for (const [a, b] of [[8, 8], [w - 12, 8], [8, w - 12], [w - 12, w - 12]]) { g.beginPath(); g.arc(i * w + a + 2, j * w + b + 2, 3, 0, 7); g.fill(); }
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(1, 1, s - 2, s - 2); g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
    },
    rock: (g, s) => {
      g.fillStyle = '#a0a0a0'; g.fillRect(0, 0, s, s);
      for (let i = 0; i < 60; i++) { const v = 120 + rnd() * 110 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); const x = rnd() * s, y = rnd() * s, r = 8 + rnd() * 26; for (let k = 0; k < 7; k++) { const a = k / 7 * 6.28; g.lineTo(x + Math.cos(a) * r * (0.7 + rnd() * 0.5), y + Math.sin(a) * r * (0.7 + rnd() * 0.5)); } g.fill(); }
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5; for (let i = 0; i < 18; i++) { g.beginPath(); let x = rnd() * s, y = rnd() * s; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    }
  };

  // ================================================================ SHADERS
  const VS = `
attribute vec3 aP; attribute vec3 aN; attribute vec3 aC; attribute vec2 aU;
uniform mat4 uVP, uM, uLVP; uniform vec3 uTint;
varying vec3 vW, vN, vC; varying vec2 vU; varying vec4 vL;
void main(){ vec4 w = uM * vec4(aP,1.0); vW = w.xyz; vN = (uM * vec4(aN,0.0)).xyz; vC = aC * uTint; vU = aU; vL = uLVP * w; gl_Position = uVP * w; }`;
  const FS = (shadow) => `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
#define SHADOW ${shadow}
uniform sampler2D uTex, uShadow;
uniform float uTexMode, uTexScale, uEmis, uAlpha, uMode, uTime, uFogNear, uFogFar, uShadowTexel;
uniform vec3 uSunDir, uSunCol, uSkyCol, uGndCol, uFogCol, uCam;
varying vec3 vW, vN, vC; varying vec2 vU; varying vec4 vL;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
vec3 grade(vec3 c){ vec3 k = max(c - 0.82, 0.0); c = min(c, 0.82) + (1.0 - exp(-k * 4.0)) * 0.18; float l = dot(c, vec3(0.299, 0.587, 0.114)); return clamp(mix(vec3(l), c, 1.1), 0.0, 1.0); }
float shadowAt(){
#if SHADOW == 0
  return 1.0;
#else
  vec3 p = vL.xyz / vL.w * 0.5 + 0.5;
  if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
  float bias = 0.0025, s = 0.0;
#if SHADOW == 1
  for (int x = 0; x < 2; x++) for (int y = 0; y < 2; y++) { vec2 o = (vec2(float(x), float(y)) - 0.5) * uShadowTexel * 1.5; s += step(p.z - bias, texture2D(uShadow, p.xy + o).r); }
  return mix(0.35, 1.0, s / 4.0);
#else
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) { vec2 o = vec2(float(x), float(y)) * uShadowTexel * 1.2; s += step(p.z - bias, texture2D(uShadow, p.xy + o).r); }
  return mix(0.35, 1.0, s / 9.0);
#endif
#endif
}
void main(){
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 base = vC;
  vec2 wuv = vW.xz;
  if (uTexMode > 0.5) {
    vec2 uv = vU;
    if (uTexMode > 1.5) { vec3 a = abs(n); uv = (a.y > 0.55 ? vW.xz : (a.x > a.z ? vW.zy : vW.xy)) * uTexScale; }
    base *= texture2D(uTex, uv).rgb * 1.12;
  }
  float emis = uEmis;
  if (uMode > 0.5 && uMode < 1.5) { // water
    float w1 = vnoise(wuv * 1.3 + vec2(uTime * 0.6, uTime * 0.4)), w2 = vnoise(wuv * 2.7 - vec2(uTime * 0.5, -uTime * 0.3));
    n = normalize(vec3((w1 - 0.5) * 0.6, 1.0, (w2 - 0.5) * 0.6));
    base = mix(vC * 0.7, vC * 1.3, w1 * w2 * 1.5);
  } else if (uMode > 1.5 && uMode < 2.5) { // lava
    float w1 = vnoise(wuv * 0.9 + vec2(uTime * 0.25, uTime * 0.15)), w2 = vnoise(wuv * 2.3 - vec2(uTime * 0.2, 0.0));
    float k = smoothstep(0.35, 0.75, w1 * 0.6 + w2 * 0.5);
    base = mix(vec3(0.35, 0.05, 0.02), vec3(1.0, 0.75, 0.15), k); emis = 0.9;
  } else if (uMode > 2.5 && uMode < 3.5) { // unlit (signs, decals)
    vec4 t = uTexMode > 0.5 ? texture2D(uTex, vU) : vec4(1.0);
    float d = length(vW - uCam), f = smoothstep(uFogNear, uFogFar, d);
    vec3 c = mix(vC * t.rgb, uFogCol, f * 0.85);
    gl_FragColor = vec4(mix(c, grade(c), 0.6), t.a * uAlpha); if (gl_FragColor.a < 0.02) discard; return;
  } else if (uMode > 3.5) { // swirl portal
    vec2 q = vU - 0.5; float r = length(q) * 2.0, a = atan(q.y, q.x);
    float sw = sin(a * 3.0 + r * 9.0 - uTime * 4.0) * 0.5 + 0.5;
    vec3 c = mix(vec3(0.45, 0.1, 0.9), vec3(1.0, 0.5, 1.0), sw) * (1.2 - r);
    gl_FragColor = vec4(c + 0.25, (1.0 - smoothstep(0.85, 1.0, r)) * uAlpha); return;
  }
  vec3 V = normalize(uCam - vW);
  float ndl = dot(n, uSunDir);
  float sh = shadowAt();
  float diff = smoothstep(-0.05, 0.45, ndl) * 0.85 + max(ndl, 0.0) * 0.15;
  vec3 hemi = mix(uGndCol, uSkyCol, n.y * 0.5 + 0.5);
  // contact shadow: the sides of things get darker where they meet the ground (y = 0)
  float ao = 1.0 - (1.0 - abs(n.y)) * 0.34 * (1.0 - smoothstep(0.0, 1.3, vW.y)) * step(-0.4, vW.y);
  vec3 col = base * (hemi * 0.66 * ao + uSunCol * diff * sh * 0.84);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += rim * 0.22 * uSkyCol * (0.5 + 0.5 * sh);
  vec3 H = normalize(V + uSunDir);
  col += pow(max(dot(n, H), 0.0), 40.0) * 0.22 * sh * uSunCol;
  col += base * emis;
  if (uMode > 0.5 && uMode < 1.5) col += pow(max(dot(n, H), 0.0), 60.0) * 0.6 * uSunCol;
  float d = length(vW - uCam), f = smoothstep(uFogNear, uFogFar, d);
  col = mix(col, uFogCol, f);
  gl_FragColor = vec4(grade(col), uAlpha);
}`;
  const DEPTH_VS = `attribute vec3 aP; uniform mat4 uLVP, uM; void main(){ gl_Position = uLVP * uM * vec4(aP,1.0); }`;
  const DEPTH_FS = `precision mediump float; void main(){ gl_FragColor = vec4(1.0); }`;
  const SKY_VS = `attribute vec2 aP; varying vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
  const SKY_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform mat4 uInvVP; uniform vec3 uTop, uHor, uSunDir, uCam; uniform float uStars, uTime;
varying vec2 vP;
float h31(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
vec3 grade(vec3 c){ vec3 k = max(c - 0.82, 0.0); c = min(c, 0.82) + (1.0 - exp(-k * 4.0)) * 0.18; float l = dot(c, vec3(0.299, 0.587, 0.114)); return clamp(mix(vec3(l), c, 1.1), 0.0, 1.0); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vn(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
void main(){
  vec4 a = uInvVP * vec4(vP, 1.0, 1.0); vec3 d = normalize(a.xyz / a.w - uCam);
  float t = clamp(d.y * 1.4 + 0.15, 0.0, 1.0);
  vec3 c = mix(uHor, uTop, pow(t, 0.8));
  float s = max(dot(d, uSunDir), 0.0);
  c += vec3(1.0, 0.93, 0.7) * (pow(s, 600.0) * 2.5 + pow(s, 12.0) * 0.25) * (1.0 - uStars);
  if (uStars > 0.5) {
    vec3 q = floor(d * 140.0); float st = step(0.9965, h31(q)) * (0.6 + 0.4 * sin(uTime * 2.0 + h31(q + 1.0) * 30.0));
    c += vec3(st) * smoothstep(-0.1, 0.2, d.y);
    c += vec3(0.5, 0.2, 0.8) * pow(max(1.0 - abs(d.y - 0.25 * sin(d.x * 3.0)), 0.0), 8.0) * 0.25;
  }
  c += uHor * pow(1.0 - abs(d.y), 8.0) * 0.18;                    // bright band at the horizon
  c += vec3(1.0, 0.9, 0.7) * pow(s, 4.0) * 0.12 * (1.0 - uStars);   // wide sun halo
  if (d.y > 0.02 && uStars < 0.5) {                                  // soft drifting clouds
    vec2 cp = d.xz / (d.y + 0.12) * 1.4 + vec2(uTime * 0.012, uTime * 0.006);
    float cl = smoothstep(0.52, 0.78, fbm(cp)) * smoothstep(0.02, 0.25, d.y);
    vec3 cc = mix(vec3(1.0), uHor * 1.1, 0.25) + vec3(1.0, 0.9, 0.75) * pow(s, 6.0) * 0.4;
    c = mix(c, cc, cl * 0.75);
  }
  if (d.y < 0.0) c = mix(c, uHor * 0.85, clamp(-d.y * 3.0, 0.0, 1.0));
  gl_FragColor = vec4(grade(c * 0.96), 1.0);
}`;
  const PT_VS = `attribute vec3 aP; attribute vec4 aC; attribute float aS; uniform mat4 uVP; uniform float uScale; varying vec4 vC;
void main(){ vec4 p = uVP * vec4(aP, 1.0); gl_Position = p; gl_PointSize = clamp(aS * uScale / max(p.w, 0.1), 1.0, 160.0); vC = aC; }`;
  const PT_FS = `precision mediump float; varying vec4 vC; uniform float uSoft;
void main(){ vec2 q = gl_PointCoord - 0.5; float r = length(q) * 2.0; if (r > 1.0) discard;
  float a = uSoft > 0.5 ? pow(1.0 - r, 1.6) : (1.0 - smoothstep(0.7, 1.0, r));
  gl_FragColor = vec4(vC.rgb, vC.a * a); }`;

  // ================================================================ ENGINE
  function Engine(canvas) {
    const E = { M, G, ok: false, quality: 'med', stats: { draws: 0, tris: 0 } };
    const opts = { antialias: true, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', opts), gl2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) return E;
    E.gl = gl; E.webgl2 = gl2;
    const depthExt = gl2 ? true : !!gl.getExtension('WEBGL_depth_texture');
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    E.canShadow = depthExt;

    function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src); return s; }
    function program(vs, fs, attrs) {
      const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
      return { p, u };
    }
    let progMain = null, progMainShadow = -1;
    const progDepth = program(DEPTH_VS, DEPTH_FS, ['aP']);
    const progSky = program(SKY_VS, SKY_FS, ['aP']);
    const progPt = program(PT_VS, PT_FS, ['aP', 'aC', 'aS']);
    const skyBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    // ---------- textures
    const texCache = {};
    function uploadCanvas(c, repeat) {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      const pot = (c.width & (c.width - 1)) === 0 && (c.height & (c.height - 1)) === 0;
      const wrap = repeat && pot ? gl.REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (pot) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
      else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      if (aniso && pot) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      return t;
    }
    E.tex = function (name) {
      if (texCache[name]) return texCache[name];
      const gen = TEXGEN[name] || TEXGEN.white;
      return (texCache[name] = uploadCanvas(noiseTex(name === 'white' ? 4 : 256, gen), true));
    };
    E.canvasTex = (c, repeat) => uploadCanvas(c, repeat);
    E.updateCanvasTex = (t, c) => { gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); };
    const TEXSCALE = { grass: 0.22, dirt: 0.3, tile: 0.25, wood: 0.35, sand: 0.18, candy: 0.25, metal: 0.25, rock: 0.2, white: 1 };

    // ---------- meshes
    function upload(arr) {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr instanceof Float32Array ? arr : new Float32Array(arr), gl.STATIC_DRAW);
      return { b, n: arr.length / STRIDE };
    }
    E.mesh = geo => upload(geo);
    function bindMesh(m, depthOnly) {
      gl.bindBuffer(gl.ARRAY_BUFFER, m.b);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, STRIDE * 4, 0);
      if (!depthOnly) {
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, STRIDE * 4, 12);
        gl.vertexAttribPointer(2, 3, gl.FLOAT, false, STRIDE * 4, 24);
        gl.vertexAttribPointer(3, 2, gl.FLOAT, false, STRIDE * 4, 36);
      }
    }

    // ---------- static world batches: chunk -> tex -> array
    const staticSrc = {}, chunks = [];
    E.addStatic = function (geo, m, col, tex, chunk) {
      chunk = chunk || 'hub'; tex = tex || 'white';
      const c = staticSrc[chunk] || (staticSrc[chunk] = {}); const arr = c[tex] || (c[tex] = []);
      const g = m ? G.xf(geo, m, col) : (col ? G.xf(geo, M.ident(), col) : geo);
      for (let i = 0; i < g.length; i++) arr.push(g[i]);
    };
    E.buildStatic = function () {
      for (const ck in staticSrc) {
        const parts = [], mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
        for (const tex in staticSrc[ck]) {
          const a = staticSrc[ck][tex];
          for (let i = 0; i < a.length; i += STRIDE) for (let k = 0; k < 3; k++) { if (a[i + k] < mn[k]) mn[k] = a[i + k]; if (a[i + k] > mx[k]) mx[k] = a[i + k]; }
          parts.push({ tex, mesh: upload(a), scale: TEXSCALE[tex] || 0.25 });
        }
        chunks.push({ name: ck, parts, mn, mx, visible: true });
        delete staticSrc[ck];
      }
    };
    E.chunkVisible = (name, v) => { for (const c of chunks) if (c.name === name) c.visible = v; };

    // ---------- draw queue (dynamic)
    const POOL = 3000, qM = []; for (let i = 0; i < POOL; i++) qM.push(new Float32Array(16));
    let queue = [], qn = 0;
    // opt: {tex, texMode(1 uv, 2 world), emis, alpha, mode(0 lit,1 water,2 lava,3 unlit,4 portal), noShadow, cull:false}
    E.draw = function (mesh, m, col, opt) {
      if (qn >= POOL) return;
      const mm = qM[qn++]; mm.set(m);
      queue.push({ mesh, m: mm, col: col ? M.col(col) : [1, 1, 1], o: opt || {} });
    };

    // ---------- particles
    const PMAX = 2000, pData = new Float32Array(PMAX * 8), parts = [];
    const pBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, pBuf); gl.bufferData(gl.ARRAY_BUFFER, pData.byteLength, gl.DYNAMIC_DRAW);
    E.particleCap = 900;
    // p: {x,y,z,vx,vy,vz,life,size,col:[r,g,b],add:bool,g:gravity,drag,fade}
    E.particle = function (p) {
      if (parts.length >= E.particleCap) return;
      p.t = 0; p.col = M.col(p.col || '#ffffff'); if (p.g === undefined) p.g = 0; if (p.a === undefined) p.a = 1; parts.push(p);
    };
    E.particleCount = () => parts.length;
    function updateParticles(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt;
        if (p.t >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
        p.vy -= p.g * dt; if (p.drag) { const k = Math.max(0, 1 - p.drag * dt); p.vx *= k; p.vy *= k; p.vz *= k; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      }
    }

    // ---------- shadow map
    let shadowSize = 0, shadowFB = null, shadowTex = null;
    function setupShadow(size) {
      if (shadowFB) { gl.deleteFramebuffer(shadowFB); gl.deleteTexture(shadowTex); shadowFB = null; }
      shadowSize = size; if (!size || !depthExt) { shadowSize = 0; return; }
      shadowTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
      if (gl2) gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT16, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_SHORT, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      shadowFB = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadowTex, 0);
      if (!gl2) { // WebGL1 wants a colour attachment too
        const cr = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, cr); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA4, size, size);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, cr);
      }
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); shadowSize = 0; shadowFB = null; }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    // ---------- quality
    const Q = {
      low:  { shadow: 0,    pcf: 0, scale: 0.7, maxDpr: 1,   far: 75,  parts: 350 },
      med:  { shadow: 1024, pcf: 1, scale: 1,   maxDpr: 1,   far: 105, parts: 900 },
      high: { shadow: 2048, pcf: 2, scale: 1,   maxDpr: 1.5, far: 145, parts: 1800 }
    };
    E.Q = Q;
    E.setQuality = function (q, extraScale) {
      E.quality = Q[q] ? q : 'med'; const cfg = Q[E.quality];
      setupShadow(cfg.shadow);
      const pcf = shadowSize ? cfg.pcf : 0;
      if (pcf !== progMainShadow) { progMain = program(VS, FS(pcf), ['aP', 'aN', 'aC', 'aU']); progMainShadow = pcf; }
      E.far = cfg.far; E.particleCap = cfg.parts; E.renderScale = cfg.scale * (extraScale || 1);
      E.resize();
    };
    E.resize = function () {
      const cfg = Q[E.quality], dpr = Math.min(window.devicePixelRatio || 1, cfg.maxDpr) * E.renderScale;
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr)), h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };

    // ---------- frame
    let VP = M.ident(), LVP = M.ident(), invVP = M.ident(), camPos = [0, 0, 0];
    E.project = function (x, y, z) {
      const m = VP, X = m[0] * x + m[4] * y + m[8] * z + m[12], Y = m[1] * x + m[5] * y + m[9] * z + m[13], Wc = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (Wc < 0.1) return null;
      return [(X / Wc * 0.5 + 0.5) * canvas.clientWidth, (1 - (Y / Wc * 0.5 + 0.5)) * canvas.clientHeight, Wc];
    };
    E.camPos = () => camPos;
    function setCommon(u, env) {
      gl.uniform3fv(u.uSunDir, env.sun); gl.uniform3fv(u.uSunCol, env.sunCol); gl.uniform3fv(u.uSkyCol, env.skyCol); gl.uniform3fv(u.uGndCol, env.gndCol);
      gl.uniform3fv(u.uFogCol, env.fog); gl.uniform3fv(u.uCam, camPos); gl.uniform1f(u.uFogNear, E.far * 0.45); gl.uniform1f(u.uFogFar, E.far);
      gl.uniform1f(u.uTime, env.time); gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uLVP, false, LVP);
      gl.uniform1f(u.uShadowTexel, shadowSize ? 1 / shadowSize : 0);
    }
    const IDENT = M.ident();
    function chunkNear(c, cx, cz, r) {
      const dx = Math.max(c.mn[0] - cx, 0, cx - c.mx[0]), dz = Math.max(c.mn[2] - cz, 0, cz - c.mx[2]);
      return dx * dx + dz * dz < r * r;
    }
    // env: {eye, target, fov, sun, sunCol, skyCol, gndCol, fog, skyTop, skyHor, stars, time, focus, dt}
    E.frame = function (env) {
      E.resize();
      const W = canvas.width, H = canvas.height; gl.viewport(0, 0, W, H);
      camPos = env.eye;
      const proj = M.persp(env.fov || 1.0, canvas.clientWidth / Math.max(1, canvas.clientHeight), 0.2, E.far + 40);
      const view = M.lookAt(env.eye, env.target, [0, 1, 0]);
      VP = M.mul(proj, view); invVP = M.invert(VP);
      updateParticles(env.dt || 0.016);
      let draws = 0, tris = 0;
      // ---- shadow pass
      const f = env.focus || env.target;
      if (shadowSize) {
        const S = E.quality === 'high' ? 38 : 30, sun = env.sun;
        const texel = 2 * S / shadowSize, fx = Math.round(f[0] / texel) * texel, fz = Math.round(f[2] / texel) * texel;
        const eye = [fx + sun[0] * 80, f[1] + sun[1] * 80, fz + sun[2] * 80];
        LVP = M.mul(M.ortho(-S, S, -S, S, 1, 200), M.lookAt(eye, [fx, f[1], fz], [0, 1, 0]));
        gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB); gl.viewport(0, 0, shadowSize, shadowSize);
        gl.clear(gl.DEPTH_BUFFER_BIT); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
        gl.colorMask(false, false, false, false);
        gl.useProgram(progDepth.p); gl.uniformMatrix4fv(progDepth.u.uLVP, false, LVP);
        gl.enableVertexAttribArray(0); for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
        gl.uniformMatrix4fv(progDepth.u.uM, false, IDENT);
        for (const c of chunks) if (c.visible && chunkNear(c, fx, fz, S * 1.5)) for (const p of c.parts) { bindMesh(p.mesh, true); gl.drawArrays(gl.TRIANGLES, 0, p.mesh.n); }
        for (const q of queue) if (!q.o.noShadow && !(q.o.mode >= 1) && (q.o.alpha === undefined || q.o.alpha >= 1)) { gl.uniformMatrix4fv(progDepth.u.uM, false, q.m); bindMesh(q.mesh, true); gl.drawArrays(gl.TRIANGLES, 0, q.mesh.n); }
        gl.colorMask(true, true, true, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      }
      // ---- sky
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.useProgram(progSky.p);
      for (let i = 1; i < 4; i++) gl.disableVertexAttribArray(i);
      gl.enableVertexAttribArray(0); gl.bindBuffer(gl.ARRAY_BUFFER, skyBuf); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.uniformMatrix4fv(progSky.u.uInvVP, false, invVP); gl.uniform3fv(progSky.u.uTop, env.skyTop); gl.uniform3fv(progSky.u.uHor, env.skyHor);
      gl.uniform3fv(progSky.u.uSunDir, env.sun); gl.uniform3fv(progSky.u.uCam, camPos); gl.uniform1f(progSky.u.uStars, env.stars ? 1 : 0); gl.uniform1f(progSky.u.uTime, env.time);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      // ---- main
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      const P = progMain, u = P.u; gl.useProgram(P.p);
      for (let i = 0; i < 4; i++) gl.enableVertexAttribArray(i);
      setCommon(u, env);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, shadowSize ? shadowTex : E.tex('white')); gl.uniform1i(u.uShadow, 1);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(u.uTex, 0);
      gl.uniformMatrix4fv(u.uM, false, IDENT); gl.uniform3f(u.uTint, 1, 1, 1); gl.uniform1f(u.uEmis, 0); gl.uniform1f(u.uAlpha, 1); gl.uniform1f(u.uMode, 0);
      gl.uniform1f(u.uTexMode, 2);
      const cx = camPos[0], cz = camPos[2];
      for (const c of chunks) {
        if (!c.visible || !chunkNear(c, cx, cz, E.far + 10)) continue;
        for (const p of c.parts) {
          gl.bindTexture(gl.TEXTURE_2D, E.tex(p.tex)); gl.uniform1f(u.uTexMode, p.tex === 'white' ? 0 : 2); gl.uniform1f(u.uTexScale, p.scale);
          bindMesh(p.mesh); gl.drawArrays(gl.TRIANGLES, 0, p.mesh.n); draws++; tris += p.mesh.n / 3;
        }
      }
      const trans = [];
      const drawItem = (q) => {
        const o = q.o;
        gl.uniformMatrix4fv(u.uM, false, q.m); gl.uniform3fv(u.uTint, q.col);
        gl.uniform1f(u.uEmis, o.emis || 0); gl.uniform1f(u.uAlpha, o.alpha === undefined ? 1 : o.alpha); gl.uniform1f(u.uMode, o.mode || 0);
        if (o.tex) { gl.bindTexture(gl.TEXTURE_2D, typeof o.tex === 'string' ? E.tex(o.tex) : o.tex); gl.uniform1f(u.uTexMode, o.texMode || 1); gl.uniform1f(u.uTexScale, o.texScale || TEXSCALE[o.tex] || 0.25); }
        else gl.uniform1f(u.uTexMode, 0);
        if (o.cull === false) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
        if (o.nofog) gl.uniform1f(u.uFogFar, 1e9), gl.uniform1f(u.uFogNear, 1e9 - 1);
        bindMesh(q.mesh); gl.drawArrays(gl.TRIANGLES, 0, q.mesh.n); draws++; tris += q.mesh.n / 3;
        if (o.nofog) gl.uniform1f(u.uFogFar, E.far), gl.uniform1f(u.uFogNear, E.far * 0.45);
      };
      for (const q of queue) {
        if ((q.o.alpha !== undefined && q.o.alpha < 1) || q.o.mode === 3 || q.o.mode === 4 || q.o.blend) { q.d = Math.hypot(q.m[12] - cx, q.m[13] - camPos[1], q.m[14] - cz); trans.push(q); }
        else drawItem(q);
      }
      // ---- transparent (far to near)
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      trans.sort((a, b) => b.d - a.d);
      for (const q of trans) {
        if (q.o.add) gl.blendFunc(gl.SRC_ALPHA, gl.ONE); else gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(!!q.o.depthWrite); drawItem(q);
      }
      gl.depthMask(true);
      // ---- particles
      if (parts.length) {
        gl.useProgram(progPt.p);
        for (let i = 3; i < 4; i++) gl.disableVertexAttribArray(i);
        gl.uniformMatrix4fv(progPt.u.uVP, false, VP); gl.uniform1f(progPt.u.uScale, canvas.height * 0.9);
        gl.bindBuffer(gl.ARRAY_BUFFER, pBuf);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 12); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 32, 28);
        gl.depthMask(false);
        for (const add of [false, true]) {
          let n = 0;
          for (const p of parts) {
            if (!!p.add !== add) continue;
            const k = p.t / p.life, a = p.a * (p.fade === false ? 1 : (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85)), o = n * 8;
            pData[o] = p.x; pData[o + 1] = p.y; pData[o + 2] = p.z; pData[o + 3] = p.col[0]; pData[o + 4] = p.col[1]; pData[o + 5] = p.col[2]; pData[o + 6] = a;
            pData[o + 7] = p.size * (p.grow ? 1 + k * p.grow : 1); n++;
          }
          if (!n) continue;
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, pData.subarray(0, n * 8));
          gl.blendFunc(gl.SRC_ALPHA, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA); gl.uniform1f(progPt.u.uSoft, add ? 1 : 0);
          gl.drawArrays(gl.POINTS, 0, n); draws++;
        }
        gl.depthMask(true);
      }
      gl.disable(gl.BLEND);
      queue = []; qn = 0;
      E.stats.draws = draws; E.stats.tris = tris | 0; E.stats.parts = parts.length;
    };
    E.setQuality('med');
    E.ok = true;
    return E;
  }
  Engine.M = M; Engine.G = G;
  root.TLEngine = Engine;
})(typeof self !== 'undefined' ? self : this);
