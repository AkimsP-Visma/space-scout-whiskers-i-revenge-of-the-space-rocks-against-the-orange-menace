// =====================================================================
//  SHOTS, THE JOURNEY (beats 1-3, 0-12.5s) - one continuous shot: the scout holds its spot while one world flows
//  past it. Every rock, the moon and the comet has a place in that world and enters and leaves the frame on its own;
//  the planet ahead grows the whole way. Drawn inside lowres(RES) in 320x180 pixels, TT on 2s.
// =====================================================================
const RES = [PX_W, PX_H];
const SHIP = [112, 100];                 // the pinned spot: x 35%, y 55% of the frame
const PLANET_AHEAD = [268, 62];           // where the odd star sits, and the planet grows, ahead of the scout
const PLANET_NEAR = [252, 84];            // where the grown planet's centre has moved to by the end of the approach
const CRUISE_IDLE = 5, CRUISE_FAST = 150, RUSH_EXTRA = 110;   // near-layer star speed, px/s
const STREAK_FROM = 30, STREAK_PER = 10;  // stars start to streak above 30 px/s, one pixel of trail per 10 px/s
const RANGE_START = 9600, JOURNEY_END = 12.5, RUSH_FROM = 11.0, RUSH_PEAK = 12.0;
const cue = () => TIMELINE.cues;

// the HUD: the scout's tag top left, and the range to the planet counting down from the throttle to the scale shot.
// In the rush the range box flashes on 16ths.
const rangeAt = (t) => Math.round(RANGE_START * (1 - seg(t, cue().throttle, JOURNEY_END)) ** 1.3);
function hudRange(t) {
  const alarm = t >= RUSH_PEAK && Math.floor(t / E16 + 1e-6) % 2;
  pixOverlay(() => {
    const txt = 'RANGE ' + String(rangeAt(t)).padStart(4, '0'), w = pixTextW(txt) + 6;
    pixBox(PX_W - 11 - w, 10, w, 13, { bg: Q.ink, edge: alarm ? Q.red : Q.slate });
    pixText(txt, PX_W - 8 - w, 13, alarm ? Q.white : Q.ice);
  });
}
const hudTag = (o = {}) => pixTag('SCOUT 07', { x: 66, y: 60, fg: Q.white, edge: Q.orange, ...o });

// the odd star: the only pink light in the sky, in a purple halo, flaring to a long cross on every other beat
function oddStar(x, y) {
  pglow(x, y, 1, 7, Q.purple, 0.5);
  if (beatN() % 2) { sprite(SPR.spark, { a: Q.pink, b: Q.white }, x - 2, y - 2); pset(x - 3, y, Q.purple); pset(x + 3, y, Q.purple); }
  else sprite(SPR.twinkle, { a: Q.pink, b: Q.white }, x - 1, y - 1);
}
// a far planet shines: a purple halo that fades out (by dither density) as the disc grows
const HALO_UNTIL = 6;
const halo = (x, y, r) => { if (r < HALO_UNTIL) pglow(x, y, r + 1, r * 2.2 + 5, Q.purple, 0.5 * (1 - r / HALO_UNTIL)); };

// ---- the world's clock: the scout idles, throttles up to cruising speed, then pushes harder in the approach
const cruiseSpeed = (t) => lerp(CRUISE_IDLE, CRUISE_FAST, EZ.io(seg(t, cue().throttle, cue().throttle + 1.5))) + RUSH_EXTRA * EZ.i2(seg(t, RUSH_FROM, JOURNEY_END));
const JOURNEY_DIST = distTable(cruiseSpeed, 0, JOURNEY_END);
const journeyDist = (t) => tableAt(JOURNEY_DIST, 0, t);
// a thing at depth (1 = the near stars) that crosses screen x `at` at time tp: its screen x now
const worldX = (tp, depth, at = PX_W / 2) => Math.round(at + (journeyDist(tp) - journeyDist(TT)) * depth);

// the planet ahead grows by these keys (time, radius), geometrically between them: slow far away, racing at the end
const PLANET_KEYS = [[0, 0.6], [2.0, 0.6], [6.0, 7], [8.0, 9], [10.0, 11.5], [11.0, 14], [11.75, 30], [12.25, 66], [JOURNEY_END, 110]];
function planetRAt(t) {
  const k = Math.max(0, PLANET_KEYS.findIndex(([kt], i) => i + 1 < PLANET_KEYS.length && t < PLANET_KEYS[i + 1][0]));
  const [t0, r0] = PLANET_KEYS[k], [t1, r1] = PLANET_KEYS[Math.min(k + 1, PLANET_KEYS.length - 1)];
  return Math.exp(lerp(Math.log(r0), Math.log(r1), seg(t, t0, t1)));
}
const planetAt = (r) => { const u = clamp(Math.log(r / 14) / Math.log(110 / 14)); return [Math.round(lerp(PLANET_AHEAD[0], PLANET_NEAR[0], u)), Math.round(lerp(PLANET_AHEAD[1], PLANET_NEAR[1], u))]; };

// the asteroid belt, in world space: each rock crosses the frame's middle at tp; far rocks drift, mid rocks tumble past
// (clear of the scout's row), one comes straight at the scout and it hops over, one near rock sweeps through in front
const BELT = (() => {
  const R = RNG('belt'), rocks = [];
  for (let k = 0; k < 10; k++) rocks.push({ key: 'bf' + k, tp: R.r(6.3, 8.0), depth: 0.45, y: R.i(6, 174), r: R.r(1.5, 3.5), spin: R.n(1.5), cols: [Q.slate, Q.night, Q.ink] });
  for (let k = 0; k < 9; k++) rocks.push({ key: 'bm' + k, tp: R.r(6.0, 7.9), depth: 0.8, y: R.pick([R.i(8, 70), R.i(124, 172)]), r: R.r(4, 8), spin: R.n(1.5), cols: [Q.grey, Q.brown, Q.ink] });
  rocks.push({ key: 'dodge', tp: cue().dodge, depth: 0.9, at: SHIP[0], y: SHIP[1] + 15, r: 9, spin: 2, cols: [Q.grey, Q.brown, Q.ink] });
  rocks.push({ key: 'near', tp: 7.7, depth: 1.7, y: 168, r: 24, spin: 0.8, cols: [Q.slate, Q.night, Q.ink] });
  return rocks;
})();
const BELT_MARGIN = 30;
function belt() {
  for (const k of BELT) {
    const x = worldX(k.tp, k.depth, k.at);
    if (x < -k.r - BELT_MARGIN || x > PX_W + k.r + BELT_MARGIN) continue;
    rock(x, k.y, k.r, TT * k.spin, k.key, k.cols);
  }
}
// the moon slides past below on the same world clock, a little outpost blinking on its skyline
const MOON = { tp: 9.0, depth: 0.8, y: 214, r: 74 };
function moonPass() {
  const mx = worldX(MOON.tp, MOON.depth);
  if (mx < -MOON.r || mx > PX_W + MOON.r) return;
  moonBody(mx, MOON.y, MOON.r);
  const ox = mx - 18, oy = MOON.y - MOON.r + 1;
  pellipse(ox, oy, 4, 3, Q.grey); prect(ox - 4, oy, 9, 2, Q.slate); pline(ox + 2, oy - 3, ox + 2, oy - 8, Q.grey);
  pset(ox + 2, oy - 9, B % 4 < 2 ? Q.red : Q.slate);
}
// the comet crosses above on its own path, from beyond the right edge to beyond the left
const COMET = { t0: 10.0, t1: 11.0, from: [340, 10], to: [-30, 54] };
function cometPass() {
  if (TT < COMET.t0 || TT >= COMET.t1) return null;
  const u = seg(TT, COMET.t0, COMET.t1), x = Math.round(lerp(COMET.from[0], COMET.to[0], u)), y = Math.round(lerp(COMET.from[1], COMET.to[1], u));
  comet(x, y, COMET.to[0] - COMET.from[0], COMET.to[1] - COMET.from[1], 110);
  return x;
}
// where the pilot looks and how it feels, through the journey
function pilotOnJourney(cu, cometX, lift) {
  if (TT < cu.wake) return { asleep: true, look: [0, 0] };
  if (TT < cu.throttle + 0.5) return { mood: 'wow', look: [1, -0.4] };
  if (lift > 1) return { mood: 'wow', look: [1, 0.8] };
  if (cometX != null) return { mood: 'wow', look: [cometX > SHIP[0] ? 1 : -1, -1] };
  if (TT >= 8.0 && TT < 9.8) return { look: [0.2, 1] };   // down at the moon
  if (TT >= 11.5) return { mood: 'wow', look: [1, -0.3] };
  return { look: [1, 0] };
}

// ---- beats 1-3, one shot: hold, wake, throttle, the belt, the moon, the comet, the approach
function sceneJourney() {
  const cu = cue();
  lowres(RES, () => {
    pfill(Q.ink);
    const d = journeyDist(TT), speed = cruiseSpeed(TT), pr = planetRAt(TT), at = planetAt(pr);
    nebula(d, { amt: lerp(1, 0.6, seg(TT, 5.0, 7.0)) });
    starfield(d, { streak: Math.max(0, speed - STREAK_FROM) / STREAK_PER, keepOut: [...at, pr * 3 + 2] });
    if (pr < 1.5) oddStar(...at);
    else { halo(...at, pr); ringedPlanet(...at, pr); }
    moonPass();
    const cometX = cometPass();
    belt();
    const lift = Math.round(6 * Math.sin(Math.PI * seg(TT, cu.dodge - 0.25, cu.dodge + 0.5)));
    const bob = TT < cu.throttle ? beatN() % 2 : 0, shake = TT >= RUSH_PEAK ? Math.floor(TT / E16 + 1e-6) % 2 : 0;   // the engine strains in the rush
    scout(SHIP[0], SHIP[1] + bob + shake - lift, {
      throttle: lerp(0.1, 1, EZ.io(seg(TT, cu.throttle, cu.throttle + 0.75))),
      pilot: pilotOnJourney(cu, cometX, lift),
    });
    if (TT >= cu.wake && TT < cu.wake + 0.5) pixBubble('!', SHIP[0] + PILOT_AT[0], SHIP[1] - 17, { bg: Q.white, edge: Q.ink, fg: Q.ink });
    hudTag();
    if (TT >= cu.throttle) hudRange(TT);
  }, { fx: { pal: PAL16 } });
}
