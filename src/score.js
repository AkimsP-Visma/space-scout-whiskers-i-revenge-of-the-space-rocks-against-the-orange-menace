  // SCORE BODY - scout-ring (inside buildScore(); see kit/score-head.js). Chiptune in D: square arps, a triangle bass,
  // noise hats and a soft kick, one chord per bar (D, Bm, G, A) from the throttle. Under it the scout's engine runs the
  // whole piece, following the throttle. The journey is a flat groove, the approach the busiest, the dive silent (the
  // engine cut), and the loudest hit is the burst into sunlight.
  const T = TIMELINE, cu = T.cues;
  const PROG = [['D4', 'Fs4', 'A4', 'Cs5'], ['B3', 'D4', 'Fs4', 'A4'], ['G3', 'B3', 'D4', 'Fs4'], ['A3', 'Cs4', 'E4', 'G4']];
  const ROOT = ['D3', 'B2', 'G2', 'A2'];
  const GROOVE_END = JOURNEY_END, JOURNEY = 6.0, BAR = 4 * BEAT;
  const barOf = (t) => Math.floor((t - cu.throttle) / BAR + 1e-6) % PROG.length;
  const chip = (t, n, vel, dur = 0.11, pan = 0, type = 'square', cut = 3200, send = 0.12) => {
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut;
    const g = ac.createGain(); env(g, t, 0.002, vel, dur);
    osc(type, nz(n), t, t + dur + 0.05).connect(lp); lp.connect(g); out(g, pan, send);
  };
  const tri = (t, n, vel, dur = 0.3) => { const g = ac.createGain(); env(g, t, 0.003, vel, dur); osc('triangle', nz(n), t, t + dur + 0.05).connect(g); out(g, 0, 0); };
  const hat = (t, vel) => noiseHit(t, 0.03, 'highpass', 7000, 0.8, vel, 0.15);
  const kick = (t, vel) => { const o = osc('sine', 150, t, t + 0.2); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); const g = ac.createGain(); env(g, t, 0.002, vel, 0.14); o.connect(g); out(g, 0, 0); };
  const hop = (t) => { const o = osc('square', 300, t, t + 0.2); o.frequency.exponentialRampToValueAtTime(900, t + 0.16); const g = ac.createGain(); env(g, t, 0.002, 0.08, 0.16); const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; o.connect(lp); lp.connect(g); out(g, -0.1, 0.1); };
  const thud = (t, vel, pan = 0) => { noiseHit(t, 0.16, 'lowpass', 380, 0.8, vel, pan); noiseHit(t, 0.05, 'bandpass', 1400, 1.2, vel * 0.4, pan); };

  // ---- the engine: a filtered saw hum and a band-passed noise roar, following the throttle shot by shot
  // [time, level, pitch Hz, brightness Hz]; linear ramps between, so a step is a ramp across the gap between two keys
  to = 's';
  const ENGINE = [
    [0.0, 0.012, 55, 320], [cu.throttle, 0.012, 55, 320], [cu.throttle + 0.75, 0.05, 86, 1600], [3.5, 0.034, 78, 950],
    [RUSH_FROM, 0.034, 78, 950], [GROOVE_END - 0.05, 0.05, 100, 2000],
    [GROOVE_END, 0.005, 60, 420], [14.5, 0.005, 60, 420],                    // the wide: far away
    [14.52, 0.012, 58, 380], [DIVE_T0, 0.012, 58, 380],                      // the close-up: the cockpit hum
    [DIVE_T0 + 0.02, 0.04, 72, 1300], [DIVE_T0 + DIVE_BRAKE, 0.02, 62, 650], [cu.hush - 0.1, 0.0001, 50, 300],   // the plunge, then cut
    [cu.burst, 0.0001, 50, 300], [cu.burst + 0.02, 0.045, 86, 1600], [AWAY_T0, 0.036, 80, 1200], [AWAY_T1, 0.014, 58, 360], [DURATION, 0.012, 55, 320],
  ];
  {
    const hum = osc('sawtooth', ENGINE[0][2], 0, DURATION + 0.1), lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    const roar = ac.createBufferSource(); roar.buffer = noise; roar.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
    const gHum = ac.createGain(), gRoar = ac.createGain();
    ENGINE.forEach(([t, level, pitch, bright], i) => {
      const at = i ? 'linearRampToValueAtTime' : 'setValueAtTime';
      gHum.gain[at](level, t); gRoar.gain[at](level * 0.8, t); hum.frequency[at](pitch, t); lp.frequency[at](bright, t); bp.frequency[at](bright * 0.6, t);
    });
    hum.connect(lp); lp.connect(gHum); roar.connect(bp); bp.connect(gRoar);
    out(gHum, -0.1, 0); out(gRoar, 0.1, 0);
    roar.start(0); roar.stop(DURATION + 0.1);
  }

  // ---- 1 hold: a low pad; the wake-up blip; the throttle
  to = 'm';
  pad(0.0, 2.3, ['D3', 'A3'], 0.011, { type: 'triangle', cut: 700, att: 0.6, rel: 0.4, send: 0.2 });
  to = 's';
  blip(cu.wake, 900, 1800, 0.08, 0.08);
  sweep(cu.throttle - 0.25, cu.throttle + 0.9, 0.06, 300, 4000);

  // ---- 2 travel and 3 journey: arps on 8ths, the bass on beats and a chord bed per bar; from the belt on,
  // a soft kick and hats join (a flat groove to the end of the approach)
  to = 'm';
  for (let t = cu.throttle; t < GROOVE_END - 1e-6; t += E8) {
    const k = Math.round((t - cu.throttle) / E8), ch = PROG[barOf(t)];
    chip(t, ch[[0, 1, 2, 3, 2, 1, 2, 3][k % 8]], 0.028, 0.1, k % 2 ? 0.15 : -0.15, 'square', t < JOURNEY ? 2200 : 3200);
  }
  for (let t = cu.throttle; t < GROOVE_END - 1e-6; t += BEAT) tri(t, ROOT[barOf(t)], 0.09, 0.32);
  for (let t = cu.throttle; t < GROOVE_END - 1e-6; t += BAR) pad(t, Math.min(t + BAR, GROOVE_END), PROG[barOf(t)].slice(0, 3), 0.009, { cut: 900, att: 0.15, rel: 0.2, send: 0.15 });
  for (let t = JOURNEY; t < GROOVE_END - 1e-6; t += BEAT) { kick(t, 0.07); hat(t + E8, 0.016); }
  // each thing voices itself as it passes: the bigger rocks thud (panned by height), the moon rings low,
  // the outpost blips, the comet whooshes overhead
  to = 's';
  BELT.filter((k) => k.r >= 6).forEach((k) => thud(k.tp, k.key === 'near' ? 0.3 : 0.22, k.y < SHIP[1] ? -0.4 : 0.4));
  hop(cu.dodge - 0.25);
  chime(MOON.tp - 1.0, [nz('D3'), nz('A3'), nz('D4')], 0.08);
  [8.5, 9.0, 9.5].forEach((t) => blip(t, 2200, 2000, 0.04, 0.04, -0.3));
  sweep(COMET.t0, COMET.t1 - 0.1, 0.16, 6000, 500, 0.3);
  // ---- 4 the approach: the engine strains, a hit on every 16th as the HUD flashes, and a riser into the slam
  for (let i = 0; i < 4; i++) noiseHit(RUSH_PEAK + i * E16, 0.07, 'bandpass', 1800 + i * 600, 1.5, 0.12, i % 2 ? 0.3 : -0.3);
  riser(RUSH_FROM, GROOVE_END - 0.02, 0.01);

  // ---- 5 the scale: the groove stops; one deep note, and a dry suspended pad swells until the dive, then a hard stop
  to = 'm';
  sub(GROOVE_END, 0.2);
  pad(GROOVE_END, 16.75, ['D2', 'A2', 'E3', 'A3'], 0.014, { swellTo: 0.03, swellAt: 15.5, cut: 900, att: 0.3, rel: 0.6, send: 0 });
  to = 's';
  blip(cu.gulp, 700, 330, 0.14, 0.07);
  noiseHit(DIVE_T0, DIVE_BRAKE, 'bandpass', 3000, 0.9, 0.08, 0, 0, 300);   // the rush of ice at the plunge, dry so it ends before the hush
  // ---- 6 the glide: silence from the hush to the burst (the engine is off, nothing is scheduled, every tail has ended)

  // ---- 7 the payoff: a short chord stab and a sub on the hit, then a flat warm chord; the cheer, the roll
  to = 'm';
  chime(cu.burst, [nz('D5'), nz('Fs5'), nz('A5')], 0.18);
  chip(cu.burst, 'D5', 0.1, 0.4, -0.2); chip(cu.burst, 'A4', 0.09, 0.4, 0.2); chip(cu.burst, 'D4', 0.09, 0.4, 0);
  sub(cu.burst, 0.9);
  noiseHit(cu.burst, 0.35, 'lowpass', 3000, 0.7, 0.16);
  pad(cu.burst + 0.05, 23.9, ['D3', 'A3', 'D4', 'Fs4'], 0.05, { cut: 1600, att: 0.25, rel: 0.6, send: 0.4 });
  for (let t = cu.burst + 1.0; t < 24.0 - 1e-6; t += BEAT) tri(t, ['D3', 'A2'][Math.round((t - cu.burst) / BEAT) % 2], 0.07, 0.3);
  for (let t = cu.burst + 1.0; t < 24.0 - 1e-6; t += E8) chip(t, ['D5', 'A4', 'Fs5', 'A4'][Math.round((t - cu.burst) / E8) % 4], 0.016, 0.08, 0.1, 'square', 2600);
  to = 's';
  ['D5', 'Fs5', 'A5', 'D6'].forEach((n, i) => chip(cu.cheer + i * E16, n, 0.06, 0.09, 0.15));
  sweep(cu.roll, cu.roll + 1.0, 0.13, 800, 5000, -0.2);

  // ---- 8 home: the opening pad returns, the arp fades out; a wave, and the log typing itself on
  to = 'm';
  pad(24.0, 28.0, ['D3', 'A3'], 0.018, { type: 'triangle', cut: 700, att: 0.4, rel: 0.8, send: 0.2 });
  for (let t = 24.0; t < 26.5 - 1e-6; t += E8) chip(t, PROG[0][[0, 1, 2, 3][Math.round((t - 24) / E8) % 4]], 0.022 * (1 - (t - 24) / 2.5), 0.1, 0.1, 'square', 1800);
  to = 's';
  [cu.wave, cu.wave + E8].forEach((t) => blip(t, 1300, 1700, 0.05, 0.05));
  for (let k = 0; k < 12; k++) noiseHit(cu.log + k * 0.1, 0.012, 'highpass', 5000, 1, 0.02, 0.2);
