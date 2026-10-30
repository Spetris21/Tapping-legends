/* Tapping Legends - synthesized sound effects and background music (no audio files). */
(function (root) {
  'use strict';
  const A = { sfx: 0.7, music: 0.35, ctx: null };
  let master, sfxG, musG, noiseBuf, musicOn = false, musicTimer = 0, nextBar = 0, bar = 0;
  function init() {
    if (A.ctx) return A.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext; A.ctx = new AC();
      master = A.ctx.createGain(); master.gain.value = 0.9; master.connect(A.ctx.destination);
      const comp = A.ctx.createDynamicsCompressor(); comp.connect(master);
      sfxG = A.ctx.createGain(); sfxG.gain.value = A.sfx; sfxG.connect(comp);
      musG = A.ctx.createGain(); musG.gain.value = A.music * 0.5; musG.connect(comp);
      noiseBuf = A.ctx.createBuffer(1, A.ctx.sampleRate, A.ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { A.ctx = null; }
    return A.ctx;
  }
  A.unlock = () => { const c = init(); if (c && c.state === 'suspended') c.resume(); };
  A.setVol = (s, m) => { A.sfx = s; A.music = m; if (sfxG) { sfxG.gain.value = s; musG.gain.value = m * 0.5; } };
  function tone(f, dur, type, vol, when, dest, glide, attack) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (when || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, glide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + (attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, when, q, type) {
    const c = A.ctx; if (!c) return;
    const t = c.currentTime + (when || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = type || 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(sfxG); s.start(t); s.stop(t + dur + 0.05);
  }
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const S = {
    tap(combo) { const f = 520 + (combo || 0) * 900 + Math.random() * 40; tone(f, 0.07, 'triangle', 0.12); tone(f * 2, 0.04, 'sine', 0.05); },
    click() { tone(900, 0.05, 'square', 0.05); },
    error() { tone(180, 0.18, 'sawtooth', 0.08, 0, null, 120); },
    gem() { [0, 4, 7, 12].forEach((n, i) => tone(NOTE(84 + n), 0.25, 'sine', 0.12, i * 0.05)); },
    coin() { tone(NOTE(88), 0.08, 'square', 0.06); tone(NOTE(95), 0.3, 'square', 0.06, 0.07); },
    jump() { tone(300, 0.18, 'triangle', 0.1, 0, null, 620); },
    bounce() { tone(160, 0.35, 'sine', 0.2, 0, null, 900); },
    shake(i) { noise(0.06, 0.12, 900 + i * 120, 0, 3); tone(200 + i * 40, 0.06, 'square', 0.04); },
    reveal(r) {
      const base = [72, 74, 76, 79, 81, 84, 86][r] || 72;
      const chord = r >= 3 ? [0, 4, 7, 12, 16] : [0, 4, 7];
      chord.forEach((n, i) => tone(NOTE(base + n), 0.6 + r * 0.15, 'triangle', 0.12, i * (r >= 4 ? 0.09 : 0.05)));
      if (r >= 4) { noise(1.2, 0.08, 6000, 0, 0.5, 'highpass'); [0, 7, 12, 19, 24].forEach((n, i) => tone(NOTE(base + 12 + n), 0.9, 'sine', 0.08, 0.4 + i * 0.08)); }
      if (r >= 5) tone(NOTE(base - 24), 1.6, 'sawtooth', 0.08, 0, null, NOTE(base - 12));
    },
    rebirth() { tone(200, 1.2, 'sawtooth', 0.08, 0, null, 1600); noise(1.2, 0.1, 3000, 0, 0.7); [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(NOTE(72 + n), 0.5, 'triangle', 0.08, 0.5 + i * 0.07)); },
    roar() { tone(90, 1.4, 'sawtooth', 0.22, 0, null, 45, 0.08); tone(140, 1.1, 'square', 0.08, 0.05, null, 60); noise(1.3, 0.25, 400, 0, 0.8, 'lowpass'); },
    hit() { tone(140 + Math.random() * 30, 0.1, 'square', 0.08, 0, null, 70); noise(0.08, 0.12, 1800, 0, 1); },
    win() { [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((n, i) => tone(NOTE(72 + n), 0.32, 'square', 0.07, i * 0.1)); },
    horn() { [0, 7, 12].forEach((n, i) => tone(NOTE(67 + n), 0.5, 'sawtooth', 0.06, i * 0.12)); },
    unlock() { [0, 5, 9, 12].forEach((n, i) => tone(NOTE(76 + n), 0.3, 'triangle', 0.1, i * 0.08)); },
    buy() { tone(NOTE(84), 0.1, 'sine', 0.12); tone(NOTE(91), 0.25, 'sine', 0.12, 0.08); },
    whoosh() { noise(0.4, 0.14, 1200, 0, 0.6); },
    splash() { noise(0.35, 0.12, 2400, 0, 0.8); }
  };
  A.play = (name, arg) => { if (!A.ctx || A.sfx <= 0) return; try { S[name] && S[name](arg); } catch (e) {} };

  // ---------- music: gentle chord loop with an arpeggio ----------
  const PROG = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];
  function scheduleBar() {
    const c = A.ctx, t0 = nextBar, beat = 0.42, chord = PROG[bar % 4];
    chord.forEach(n => { const o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.value = NOTE(n - 12);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t0 + beat * 8);
      o.connect(g); g.connect(musG); o.start(t0); o.stop(t0 + beat * 8 + 0.1); });
    const pat = [0, 2, 1, 3, 2, 1, 3, 2];
    pat.forEach((p, i) => { const o = c.createOscillator(), g = c.createGain(), t = t0 + i * beat; o.type = 'sine'; o.frequency.value = NOTE(chord[p] + 12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.6);
      o.connect(g); g.connect(musG); o.start(t); o.stop(t + beat * 1.7); });
    const bo = c.createOscillator(), bg = c.createGain(); bo.type = 'sine'; bo.frequency.value = NOTE(chord[0] - 24);
    bg.gain.setValueAtTime(0.0001, t0); bg.gain.exponentialRampToValueAtTime(0.1, t0 + 0.02); bg.gain.exponentialRampToValueAtTime(0.0001, t0 + beat * 4);
    bo.connect(bg); bg.connect(musG); bo.start(t0); bo.stop(t0 + beat * 4.2);
    nextBar += beat * 8; bar++;
  }
  A.startMusic = function () {
    if (!init() || musicOn) return; musicOn = true; nextBar = A.ctx.currentTime + 0.3;
    musicTimer = setInterval(() => { if (A.music > 0 && A.ctx.currentTime > nextBar - 1) scheduleBar(); else if (A.music <= 0) nextBar = A.ctx.currentTime + 0.2; }, 300);
  };
  root.TLAudio = A;
})(typeof self !== 'undefined' ? self : this);
