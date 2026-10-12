// =====================================================================
//  SHOTS, THE PLANET (beats 4-7) - the scale, the pilot close up, the dive, the sunlight, home. lowres(RES), TT on 2s.
// =====================================================================
// ---- beat 4: the scale. The planet fills the frame; the scout is a speck heading for the gap
const WIDE_PLANET = { x: 206, y: 92, r: 86, tilt: 0.2, rot: -0.2 };
const WIDE_GAP_PHI = 2.55;   // where on the near ring the scout dives through: front left, in frame
function sceneWide() {
  const P = WIDE_PLANET, t0 = 12.5, t1 = 14.5;
  lowres(RES, () => {
    pfill(Q.ink);
    nebula(TT * 3, { amt: 0.7, y: 40 });
    starfield(TT * 3, { keepOut: [P.x, P.y, P.r + 2] });
    pcircle(34 - Math.floor((TT - t0) * 2), 28, 3, Q.grey); pset(33 - Math.floor((TT - t0) * 2), 27, Q.white);   // a far moon
    ringedPlanet(P.x, P.y, P.r, P);
    for (let k = 0; k < 6; k++) {   // ice glinting on the rings, on alternate 8ths
      const [gx, gy] = ringPoint(P.x, P.y, P.r, P, 1.6 + 0.12 * k, 1.9 + k * 0.32);
      if ((eighthN() + k) % 3 === 0) sprite(SPR.twinkle, { a: Q.ice, b: Q.white }, gx - 1, gy - 1);
    }
    const [gx, gy] = ringPoint(P.x, P.y, P.r, P, RING_GAP, WIDE_GAP_PHI), from = [10, 92], u = 0.92 * EZ.io(seg(TT, t0, t1));
    const sx = lerp(from[0], gx, u), sy = lerp(from[1], gy, u), hd = Math.hypot(gx - from[0], gy - from[1]);
    scoutSpeck(sx, sy, (gx - from[0]) / hd, (gy - from[1]) / hd, 14);
  }, { fx: { pal: PAL16 } });
}

// ---- beat 4: the extreme close-up. The pilot's eyes go wide; the rings slide across the canopy glass
const DOME = { x: 160, y: 156, rx: 150, ry: 142 };
const insideDome = (i, j, k = 0) => ((i - DOME.x) / (DOME.rx - k)) ** 2 + ((j - DOME.y) / (DOME.ry - k)) ** 2 <= 1;
function glassReflection(shift) {   // a curved band of ring light and the planet's pink crescent, dithered thin over the glass
  PLOT_C = null;
  for (let j = 0; j < 150; j++) for (let i = 0; i < PX_W; i++) {
    if (!insideDome(i, j, 3)) continue;
    const dr = Math.hypot(i - 250 - shift, j - 260) - 205, b = bayer(i, j);
    if (Math.abs(dr) < 5 && b < 0.32 - Math.abs(dr) * 0.04) plot(i, j, Q.ice);
    else if (Math.abs(dr - 13) < 2 && b < 0.18) plot(i, j, Q.grey);
    const dp = Math.hypot(i - 96 - shift, j - 52) - 14;
    if (Math.abs(dp) < 1.5 && i > 96 + shift && b < 0.4) plot(i, j, Q.pink);
  }
}
function scenePilot() {
  const cu = cue(), shift = beatN() % 2;
  lowres(RES, () => {
    pfill(Q.ink);
    starfield(0, { dim: true });
    ringHalf(330, -40, 70, { tilt: 0.35, rot: 0.5, glow: 0.05 }, 'front');   // the real rings, outside the glass at top right
    // inside the dome: the dark cockpit, two instrument panels blinking at the back
    PLOT_C = null;
    for (let j = 0; j < PX_H; j++) for (let i = 0; i < PX_W; i++) if (insideDome(i, j, 3)) plot(i, j, j > 120 && bayer(i, j) < 0.25 ? Q.purple : Q.night);
    // a reflection only shows over the dark glass, not over the bright face, so it goes under the pilot
    glassReflection(shift);
    [[52, 118], [244, 112]].forEach(([x, y], k) => {
      pixBox(x, y, 26, 14, { bg: Q.ink, edge: Q.slate });
      for (let n = 0; n < 4; n++) prect(x + 3 + n * 6, y + 5, 3, 3, (beatN() + n + k) % 4 === 0 ? [Q.lime, Q.red, Q.yellow, Q.sky][n] : Q.slate);
    });
    pilotCloseUp(160, 98, 46, { look: [0.7, -0.8], blink: TT >= cu.gulp - 0.17 && TT < cu.gulp });
    if (TT >= cu.gulp && TT < cu.gulp + 0.75) {   // the gulp: a sweat drop slides down the brow
      const dy = Math.floor((TT - cu.gulp) * 12);
      prect(208, 70 + dy, 3, 4, Q.ice); prect(209, 69 + dy, 1, 1, Q.ice); pset(208, 70 + dy, Q.white);
    }
    // the dome rim, then the hull edge across the bottom with the scout's stripe
    for (let j = 0; j < PX_H; j++) for (let i = 0; i < PX_W; i++) if (insideDome(i, j) && !insideDome(i, j, 3)) pset(i, j, j < 60 && i < 160 ? Q.grey : Q.slate);
    prect(0, 150, PX_W, 1, Q.ink); prect(0, 151, PX_W, 14, Q.white); prect(0, 159, PX_W, 3, Q.orange); prect(0, 165, PX_W, 15, Q.grey);
    for (const x of [40, 120, 200, 280]) prect(x, 151, 1, 8, Q.grey);
    for (const [x, y] of [[44, 40], [40, 46], [36, 52]]) prect(x, y, 4, 1, Q.white);   // a glint on the glass
  }, { fx: { pal: PAL16 } });
}

// ---- beat 5: the dive. The scout plunges into the gap: the ring sheets' leading edge sweeps in from ahead and past,
// the scout brakes, cuts its engine at the hush and glides in silence; at the end the far side of the gap glows
const DIVE_T0 = 16.0, DIVE_T1 = 19.0, DIVE_SHIP_Y = 92, DIVE_GLOW_AT = 18.25;
const DIVE_CRUISE = 18, DIVE_PLUNGE = 1100, DIVE_BRAKE = 0.75;   // px/s; the plunge brakes to a glide over DIVE_BRAKE s
const ICE_DIM = [Q.slate, Q.night, Q.ink], ICE_LIT = [Q.grey, Q.slate, Q.ink];
const diveSpeed = (t) => DIVE_CRUISE + DIVE_PLUNGE * (1 - EZ.o2(seg(t, DIVE_T0, DIVE_T0 + DIVE_BRAKE)));
const DIVE_DIST = distTable(diveSpeed, DIVE_T0, DIVE_T1);
const DIVE_ENTRY = PX_W + 10;   // where the sheets' leading edge is when the shot opens: just beyond the right edge
// ice in the gap, in world space from the leading edge: near chunks at the sheets' inner edges, far ones behind them
const DIVE_ICE = (() => {
  const R = RNG('dive-ice'), ice = [], add = (n, depth, y0, y1, r0, r1, cols) => { for (let k = 0; k < n; k++) ice.push({ key: 'di' + ice.length, wx: R.r(0, 700), depth, y: R.i(y0, y1), r: R.r(r0, r1), spin: R.n(1.2), cols }); };
  add(26, 0.65, 36, 52, 2, 4, ICE_DIM); add(26, 0.65, 128, 144, 2, 4, ICE_DIM);
  add(12, 1.0, 30, 44, 6, 11, ICE_LIT); add(12, 1.0, 138, 152, 6, 11, ICE_LIT);
  return ice;
})();
function sceneDive() {
  const cu = cue(), d = tableAt(DIVE_DIST, DIVE_T0, TT), edge = Math.round(DIVE_ENTRY - d);
  lowres(RES, () => {
    pfill(Q.ink);
    starfield(d * 0.2, { dim: true });
    ringSheet(0, 44, 44, d * 0.3, edge);
    ringSheet(136, PX_H, 136, d * 0.3, edge);
    for (const k of DIVE_ICE) {
      const x = Math.round(DIVE_ENTRY + k.wx - d * k.depth);
      if (x < edge || x < -k.r || x > PX_W + k.r) continue;
      rock(x, k.y, k.r, TT * k.spin, k.key, k.cols);
    }
    for (let k = 0; k < 14; k++) {   // ice glints catching what little light there is
      const R = RNG('dive-glint', k), x = Math.round(DIVE_ENTRY + R.r(0, 700) - d), y = R.pick([R.i(6, 44), R.i(136, 174)]);
      if (x >= Math.max(edge, 0) && x < PX_W && (B + k * 3) % 9 < 2) pset(x, y, Q.ice);
    }
    const g = ev(DIVE_GLOW_AT, 0.75);
    if (g > 0) pdither(PX_W - 90, 40, 90, 104, null, Q.white, (i, j) => g * clamp((i - (PX_W - 90)) / 90) ** 1.5 * (1 - Math.abs(j - DIVE_SHIP_Y) / 52));
    const throttle = TT >= cu.hush ? 0 : lerp(0.6, 0.3, seg(TT, DIVE_T0, DIVE_T0 + DIVE_BRAKE));
    scout(SHIP[0], DIVE_SHIP_Y, { throttle, pilot: { look: [1, 0], mood: g > 0.4 ? 'wow' : 'smile' } });
  }, { fx: { pal: PAL16 } });
}

// ---- beats 6-7, one shot: the payoff and the way home. The sun breaks over the planet's edge, the rings blaze, the
// scout cheers and rolls; then it pulls away: the planet shrinks back behind it, the sun sets behind the planet, the
// stars and the nebula come back, and the scout settles into its opening spot. The planet ends as one pink star behind
const BURST_PLANET = { x: 70, y: 232, r: 128, tilt: 0.17, rot: -0.2 };
const BURST_SHIP = [108, 62];
const BURST_SUN_X = 172, BURST_SUN_Y0 = 150, BURST_SUN_Y1 = 120;   // the sun rises from behind the limb
const AWAY_T0 = 22.25, AWAY_T1 = 25.0, HOME_STAR_AT = 27.75;        // the pull-away, then the shrink to a star
const PLANET_BEHIND = [46, 64], HOME_R0 = 20, STAR_R = 1.2, SUN_SINK = 0.7;
const SUN_DRIFT = 8, HOME_SPEED = 18;
const awayAt = (t) => EZ.io(seg(t, AWAY_T0, AWAY_T1));
const SUN_DIST = distTable((t) => lerp(SUN_DRIFT, HOME_SPEED, awayAt(t)), cue().burst, DURATION);
function planetOnTheWayHome() {
  const away = awayAt(TT), r = TT < AWAY_T1 ? Math.exp(lerp(Math.log(BURST_PLANET.r), Math.log(HOME_R0), away)) : lerp(HOME_R0, STAR_R, seg(TT, AWAY_T1, HOME_STAR_AT));
  // it rises late, once it is small, so its rings pass under the scout instead of through it
  return { r, x: Math.round(lerp(BURST_PLANET.x, PLANET_BEHIND[0], away)), y: Math.round(lerp(BURST_PLANET.y, PLANET_BEHIND[1], EZ.i2(away))) };
}
// the sun keeps its place against the planet as both recede, and sinks behind the limb on the way out
function sunOnTheWayHome(p) {
  const cu = cue(), away = awayAt(TT), rise = lerp(BURST_SUN_Y0, BURST_SUN_Y1, EZ.o2(seg(TT, cu.burst, cu.burst + 1.75)));
  const k = (p.r / BURST_PLANET.r) * lerp(1, SUN_SINK, away);
  return { x: Math.round(p.x + (BURST_SUN_X - BURST_PLANET.x) * k), y: Math.round(p.y + (rise - BURST_PLANET.y) * k), r: Math.max(2, Math.round(9 * p.r / BURST_PLANET.r + 2 * (1 - away))), glare: 1 - seg(TT, AWAY_T0 + 1.25, AWAY_T1) };
}
function sceneSunlight() {
  const cu = cue(), away = awayAt(TT), p = planetOnTheWayHome(), s = sunOnTheWayHome(p), d = tableAt(SUN_DIST, cu.burst, TT);
  const L = (() => { const v = [s.x - p.x, s.y - p.y, -150 * p.r / BURST_PLANET.r], n = Math.hypot(...v); return v.map((c) => c / n); })();   // from behind: a blazing rim
  lowres(RES, () => {
    pfill(Q.ink);
    if (s.glare > 0) { pglow(s.x, s.y, 0, 150 * s.glare, Q.night, 0.75); pglow(s.x, s.y, 0, 70 * s.glare, Q.purple, 0.45); }
    nebula(d, { amt: away });
    starfield(d, { farShare: away, keepOut: s.glare > 0.5 ? [s.x, s.y, 60 * s.glare] : [p.x, p.y, p.r * 3 + 2] });
    if (s.glare > 0) sun(s.x, s.y, s.r);
    if (p.r < 1.5) oddStar(p.x, p.y);
    else { halo(p.x, p.y, p.r); ringedPlanet(p.x, p.y, p.r, { ...BURST_PLANET, light: L, glow: lerp(0.22, 0.05, away), ramp: RING_LIT, lift: 0.04 }); }
    for (let k = 0; k < 16; k++) {   // ice crystals in the sunlight stream past and out of the frame; none come after the roll
      const R = RNG('glint', k), te = R.r(cu.burst - 2.5, cu.roll + 1.0), x = Math.round(PX_W + 20 - (TT - te) * R.r(70, 110)), y = R.i(20, 150);
      if (TT < te || x < -2) continue;
      if ((B + k * 5) % 7 < 3) sprite(SPR.twinkle, { a: Q.yellow, b: Q.white }, x - 1, y - 1); else pset(x, y, Q.ice);
    }
    const cheer = TT >= cu.cheer, hop = cheer && TT < cu.roll ? (beatN() % 2) * 2 : 0;
    const glide = springMove(cu.roll + 1.0, 0, 12, SPRING.heavy), home = TT >= AWAY_T1, waving = TT >= cu.wave && TT < cu.wave + 1.0;
    scout(Math.round(lerp(BURST_SHIP[0] + glide, SHIP[0], away)), Math.round(lerp(BURST_SHIP[1] - hop, SHIP[1], away)) + (home ? beatN() % 2 : 0), {
      throttle: lerp(1, 0.35, away), roll: TAU * EZ.io(seg(TT, cu.roll, cu.roll + 1.0)),
      pilot: { mood: !cheer ? 'wow' : 'happy', look: TT >= cu.look ? [-1, -0.4] : [1, -0.6], paw: waving ? 2 + (eighthN() % 2) * 2 : 0 },
    });
    flash(seg(TT, cu.burst, cu.burst + 0.34));
    hudTag({ at: AWAY_T1 - 0.5 - cu.burst });
    pixCaption('LOG 01: FOUND A RINGED ONE', { at: cu.log - cu.burst, dur: 1.2, y: 900, fg: Q.white, edge: Q.orange });
  }, { fx: { pal: PAL16 } });
}
