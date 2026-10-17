// =====================================================================
//  SOUND - everything heard in the game page. Before any key press (rendering needs no gesture) it renders, offline:
//  the film's own score (the kit's buildScore), the game's 16s music loop and every effect, the last two scaled by the
//  film mix's own loudness gain so they sit at the film's level. The first key creates the AudioContext; then it plays
//  the film once, loops the music, runs a live engine and fires the effects. Any failure leaves the game silent and is
//  logged with its stage; ?nosound starts it silent on purpose.
// =====================================================================
const SR = 48000;
const MUSIC_LEN = 8 * 4 * BEAT;                                       // 8 bars at 120 BPM: 16s
const BUS_GAIN = { film: 1, music: 0.8, sfx: 1, engine: 1 };          // the effects sit a little above the music
const ENGINE_IDLE = { level: 0.012, pitch: 55, bright: 320 }, ENGINE_FULL = { level: 0.05, pitch: 86, bright: 1600 };   // the film's engine keys
const ENGINE_GLIDE = 0.05, ENGINE_FADE = 0.08;                         // s: how fast the engine follows its drive, and stops
const ENGINE_STEP = 0.01;                                             // drive changes smaller than this are not rescheduled
const LIMITER = { threshold: -3, ratio: 20, attack: 0.003, release: 0.1 };
// the film's journey groove (src/score.js keeps it inside buildScore, so it is repeated here): one chord per bar
const GROOVE = {
  prog: [['D4', 'Fs4', 'A4', 'Cs5'], ['B3', 'D4', 'Fs4', 'A4'], ['G3', 'B3', 'D4', 'Fs4'], ['A3', 'Cs4', 'E4', 'G4']],
  roots: ['D3', 'B2', 'G2', 'A2'], arp: [0, 1, 2, 3, 2, 1, 2, 3],
};

// the offline voices: the shapes and levels of the film's score (square and sine tones, band-passed noise, a saw pad)
function clipVoices(ac, dest) {
  const noise = makeNoise(ac, 2);
  const env = (g, t, attack, peak, decay) => {
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  };
  const panned = (node, pan) => { const p = ac.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(dest); };
  return {
    tone(t, type, f0, f1, vel, dur, cut = 4000, pan = 0) {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      lp.type = 'lowpass'; lp.frequency.value = cut; env(g, t, 0.002, vel, dur);
      o.connect(lp); lp.connect(g); panned(g, pan); o.start(t); o.stop(t + dur + 0.05);
    },
    hiss(t, type, freq, q, vel, dur, sweepTo = 0, pan = 0) {
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noise; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      env(g, t, Math.min(0.004, dur * 0.3), vel, dur);
      s.connect(f); f.connect(g); panned(g, pan); s.start(t); s.stop(t + dur + 0.05);
    },
    pad(t0, t1, notes, peak, cut = 900) {
      const lp = ac.createBiquadFilter(), g = ac.createGain();
      lp.type = 'lowpass'; lp.frequency.value = cut;
      g.gain.value = 0; g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + 0.15);
      g.gain.setValueAtTime(peak, t1 - 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t1);
      for (const n of notes) for (const detune of [-7, 7]) {
        const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = nz(n); o.detune.value = detune;
        o.connect(lp); o.start(t0); o.stop(t1 + 0.05);
      }
      lp.connect(g); panned(g, 0);
    },
  };
}
function renderClip(seconds, body, gain) {
  const ac = new OfflineAudioContext(2, Math.ceil(seconds * SR), SR), out = ac.createGain();
  out.gain.value = gain; out.connect(ac.destination);
  body(clipVoices(ac, out));
  return ac.startRendering();
}
function toBuffer(left, right, sampleRate) {
  const b = new AudioBuffer({ length: left.length, numberOfChannels: 2, sampleRate });
  b.copyToChannel(left, 0); b.copyToChannel(right, 1);
  return b;
}
// the 16s loop: arpeggios on 8ths, the bass on beats, a kick on the beat and a hat on the off-beat, a soft chord bed;
// every note ends inside the loop, so it repeats without a seam
function musicLoop(v) {
  const barOf = (t) => Math.floor(t / (4 * BEAT)) % GROOVE.prog.length;
  for (let i = 0; i * E8 < MUSIC_LEN - 1e-6; i++) {
    const t = i * E8, f = nz(GROOVE.prog[barOf(t)][GROOVE.arp[i % GROOVE.arp.length]]);
    v.tone(t, 'square', f, f, 0.028, 0.1, 3200, i % 2 ? 0.15 : -0.15);
  }
  for (let i = 0; i * BEAT < MUSIC_LEN - 1e-6; i++) {
    const t = i * BEAT, root = nz(GROOVE.roots[barOf(t)]);
    v.tone(t, 'triangle', root, root, 0.09, 0.32, 8000);
    v.tone(t, 'sine', 150, 45, 0.07, 0.14, 8000);            // the kick
    v.hiss(t + E8, 'highpass', 7000, 0.8, 0.016, 0.03);       // the hat
  }
  for (let bar = 0; bar * 4 * BEAT < MUSIC_LEN - 1e-6; bar++) v.pad(bar * 4 * BEAT, (bar + 1) * 4 * BEAT, GROOVE.prog[bar % GROOVE.prog.length].slice(0, 3), 0.009);
}
// the effects: [length in s, body]
const SFX = {
  fire: [0.15, (v) => v.tone(0, 'square', 1400, 500, 0.05, 0.1, 5000)],
  rockHit: [0.08, (v) => v.hiss(0, 'bandpass', 2400, 2, 0.06, 0.04)],
  rockBreak: [0.4, (v) => { v.hiss(0, 'lowpass', 380, 0.8, 0.22, 0.16); v.hiss(0, 'bandpass', 1400, 1.2, 0.09, 0.05); v.hiss(0.02, 'bandpass', 3000, 0.9, 0.06, 0.25, 600); }],
  iceClank: [0.4, (v) => { v.tone(0, 'triangle', 1760, 1700, 0.05, 0.3, 6000); v.tone(0, 'square', 2637, 2600, 0.02, 0.12, 6000); }],
  cometWarn: [0.3, (v) => { v.tone(0, 'square', 1200, 1200, 0.04, 0.06); v.tone(0.15, 'square', 1200, 1200, 0.04, 0.06); }],
  cometWhoosh: [1.0, (v) => v.hiss(0, 'bandpass', 6000, 1.1, 0.16, 0.9, 500)],
  shieldHit: [0.5, (v) => { v.hiss(0, 'lowpass', 300, 0.8, 0.3, 0.2); v.tone(0.05, 'square', 880, 440, 0.05, 0.25, 3000); }],
  gameOver: [1.6, (v) => [['A4', 0], ['F4', 0.25], ['D4', 0.5], ['A3', 0.75]].forEach(([n, t]) => v.tone(t, 'square', nz(n), nz(n), 0.05, 0.5, 2400))],
  retry: [0.6, (v) => ['D5', 'Fs5', 'A5', 'D6'].forEach((n, i) => v.tone(i * E16, 'square', nz(n), nz(n), 0.06, 0.09))],
  pickup: [0.4, (v) => { v.tone(0, 'square', 880, 1760, 0.05, 0.12, 6000); v.tone(0.1, 'square', 1320, 2640, 0.04, 0.18, 6000); }],
  overheat: [0.5, (v) => { v.hiss(0, 'bandpass', 1400, 1.2, 0.12, 0.4, 400); v.tone(0, 'square', 330, 110, 0.04, 0.4, 1800); }],
  levelExit: [1.4, (v) => { v.hiss(0, 'bandpass', 800, 1.0, 0.1, 1.2, 5000); v.tone(0, 'square', 220, 880, 0.04, 1.2, 3000); }],
  levelComplete: [1.2, (v) => ['D5', 'Fs5', 'A5', 'D6', 'A5', 'D6'].forEach((n, i) => v.tone(i * E16, 'square', nz(n), nz(n), 0.06, i > 3 ? 0.3 : 0.12))],
  rocketFire: [0.25, (v) => v.hiss(0, 'lowpass', 900, 1.5, 0.14, 0.22)],
  bossWarn: [1.0, (v) => { [0, 0.25, 0.5].forEach((t, i) => v.tone(t, 'square', 200 + i * 100, 300 + i * 100, 0.10, 0.22, 1000)); }],
  bossHit: [0.1, (v) => v.hiss(0, 'bandpass', 2200, 1.8, 0.09, 0.08)],
  bossDeath: [2.0, (v) => { v.hiss(0, 'lowpass', 300, 0.8, 0.28, 1.0); v.hiss(0.15, 'bandpass', 1800, 1.2, 0.14, 0.35); [0, 0.35, 0.7, 1.1].forEach((t) => v.tone(t, 'square', 180, 70, 0.10, 0.45, 700)); }],
  bossShot: [0.18, (v) => v.hiss(0, 'bandpass', 2800, 2.0, 0.07, 0.14, 900)],
};

const Sound = {
  ready: false, failed: null, preparing: null, gain: 1, clips: {}, ac: null, master: null, buses: {},
  filmSource: null, musicSource: null, engine: null, engineDrive: null, muted: false,
  prepare() { if (!Sound.preparing) Sound.preparing = Sound.render(); return Sound.preparing; },
  async render() {
    if (new URLSearchParams(location.search).has('nosound')) { Sound.fail('prepare', new Error('started with ?nosound')); return; }
    try {
      const film = await buildScore(SR, 'mix');
      Sound.gain = film.norm.k;
      Sound.clips.film = toBuffer(film.left, film.right, film.sampleRate);
      Sound.clips.music = await renderClip(MUSIC_LEN, musicLoop, Sound.gain);
      for (const [name, [seconds, body]] of Object.entries(SFX)) Sound.clips[name] = await renderClip(seconds, body, Sound.gain);
      Sound.ready = true;
    } catch (e) { Sound.fail('prepare', e); }
  },
  fail(stage, e) { Sound.failed = stage; console.warn(`[sound] ${stage} failed, so the game runs silently:`, e); },
  // the first key: the AudioContext, a limiter so stacked effects cannot clip, one gain per bus
  start() {
    if (Sound.ac || Sound.failed) return;
    try {
      const ac = new AudioContext(), master = ac.createGain(), limiter = ac.createDynamicsCompressor();
      limiter.threshold.value = LIMITER.threshold; limiter.knee.value = 0; limiter.ratio.value = LIMITER.ratio;
      limiter.attack.value = LIMITER.attack; limiter.release.value = LIMITER.release;
      master.connect(limiter); limiter.connect(ac.destination);
      for (const [bus, gain] of Object.entries(BUS_GAIN)) {
        const node = ac.createGain();
        node.gain.value = bus === 'engine' ? gain * Sound.gain : gain;   // the live engine gets the film's loudness gain here
        node.connect(master); Sound.buses[bus] = node;
      }
      Sound.ac = ac; Sound.master = master; Sound.setMuted(Sound.muted);
    } catch (e) { Sound.fail('start', e); }
  },
  now() { return Sound.ac ? Sound.ac.currentTime : null; },
  running() { return !!Sound.ac && Sound.ac.state === 'running'; },
  // from inside a key event: create the context once the sounds are ready, and wake it if the browser suspended it
  unlock() {
    if (Sound.ready && !Sound.ac) Sound.start();
    if (Sound.ac && !Sound.running()) Sound.ac.resume().catch((e) => console.warn('[sound] the browser would not resume the audio:', e));
  },
  play(name, bus, o = {}) {
    if (!Sound.ac || !Sound.clips[name]) return null;
    const src = Sound.ac.createBufferSource();
    src.buffer = Sound.clips[name]; src.loop = !!o.loop; src.connect(Sound.buses[bus]);
    src.start(Math.max(o.at ?? 0, Sound.ac.currentTime));
    return src;
  },
  // starts the film score; returns its start time on the audio clock, or null without sound
  playFilm() {
    Sound.stopFilm();
    if (!Sound.ac) return null;
    const at = Sound.ac.currentTime + 0.05;
    Sound.filmSource = Sound.play('film', 'film', { at });
    return Sound.filmSource ? at : null;
  },
  stopFilm() { if (Sound.filmSource) Sound.filmSource.stop(); Sound.filmSource = null; },
  startMusic(at = null) { if (!Sound.musicSource) Sound.musicSource = Sound.play('music', 'music', { loop: true, at: at ?? 0 }); },
  sfx(name) { Sound.play(name, 'sfx'); },
  // the live engine: a filtered saw hum and a band-passed noise roar, as in the film's score
  engineOn() {
    if (!Sound.ac || Sound.engine) return;
    const ac = Sound.ac, hum = ac.createOscillator(), lp = ac.createBiquadFilter(), gHum = ac.createGain();
    const roar = ac.createBufferSource(), bp = ac.createBiquadFilter(), gRoar = ac.createGain();
    hum.type = 'sawtooth'; hum.frequency.value = ENGINE_IDLE.pitch; lp.type = 'lowpass'; lp.frequency.value = ENGINE_IDLE.bright; gHum.gain.value = 0;
    roar.buffer = makeNoise(ac, 2); roar.loop = true; bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = ENGINE_IDLE.bright * 0.6; gRoar.gain.value = 0;
    hum.connect(lp); lp.connect(gHum); gHum.connect(Sound.buses.engine);
    roar.connect(bp); bp.connect(gRoar); gRoar.connect(Sound.buses.engine);
    hum.start(); roar.start();
    Sound.engine = { hum, lp, gHum, bp, gRoar };
  },
  // drive 0 (idle) to 1 (full), between the film's idle and full keys; rescheduled only when the drive moves
  engineSet(drive) {
    const E = Sound.engine, k = clamp(drive);
    if (!E || (Sound.engineDrive != null && Math.abs(k - Sound.engineDrive) < ENGINE_STEP)) return;
    Sound.engineDrive = k;
    const t = Sound.ac.currentTime, at = (key) => lerp(ENGINE_IDLE[key], ENGINE_FULL[key], k);
    E.gHum.gain.setTargetAtTime(at('level'), t, ENGINE_GLIDE); E.gRoar.gain.setTargetAtTime(at('level') * 0.8, t, ENGINE_GLIDE);
    E.hum.frequency.setTargetAtTime(at('pitch'), t, ENGINE_GLIDE);
    E.lp.frequency.setTargetAtTime(at('bright'), t, ENGINE_GLIDE); E.bp.frequency.setTargetAtTime(at('bright') * 0.6, t, ENGINE_GLIDE);
  },
  engineOff() {
    const E = Sound.engine;
    if (!E) return;
    Sound.engineDrive = null;
    const t = Sound.ac.currentTime;
    E.gHum.gain.setTargetAtTime(0, t, ENGINE_FADE); E.gRoar.gain.setTargetAtTime(0, t, ENGINE_FADE);
  },
  setMuted(muted) { Sound.muted = muted; if (Sound.master) Sound.master.gain.value = muted ? 0 : 1; },
  pause(paused) {
    if (!Sound.ac) return;
    (paused ? Sound.ac.suspend() : Sound.ac.resume()).catch((e) => console.warn('[sound] pausing or resuming the audio failed:', e));
  },
};
