// =====================================================================
//  SPAWNER - how hard the belt is at run time t, and what comes next. Spawns come from the kit's seeded RNG, so a run
//  with the same seed always brings the same objects.
// =====================================================================
const Spawner = {
  // scroll speed (px/s), spawn interval (s) and the mix of kinds (shares that sum to 1) at run time t
  difficulty(t) {
    const D = CFG.difficulty, u = seg(t, 0, D.ramp);
    const ice = t < D.iceFrom ? 0 : D.ice * seg(t, D.iceFrom, D.ramp);
    const comet = t < D.cometFrom ? 0 : D.comet * seg(t, D.cometFrom, D.ramp);
    return { scroll: lerp(D.scroll[0], D.scroll[1], EZ.io(u)), interval: lerp(D.interval[0], D.interval[1], u), mix: { rock: 1 - ice - comet, ice, comet } };
  },
  // the n-th spawn of the run with this seed, at run time t: a description that Objects.fromSpawn turns into an object
  next(seed, n, t) {
    const R = RNG('spawn', seed, n), mix = Spawner.difficulty(t).mix, roll = R.f(), Y = CFG.spawn;
    if (roll < mix.comet) return { kind: 'comet', y: R.i(Y.minY + CFG.comet.rowMargin, Y.maxY - CFG.comet.rowMargin), slope: R.r(-CFG.comet.maxSlope, CFG.comet.maxSlope) };
    if (roll < mix.comet + mix.ice) return { kind: 'ice', y: R.i(Y.minY, Y.maxY), r: R.i(CFG.ice.r[0], CFG.ice.r[1]), speed: R.r(CFG.ice.speed[0], CFG.ice.speed[1]), spin: R.n(1) };
    const size = R.pick(Object.keys(CFG.rocks)), S = CFG.rocks[size];
    return { kind: 'rock', size, y: R.i(Y.minY, Y.maxY), r: R.i(S.r[0], S.r[1]), speed: R.r(CFG.rockSpeed[0], CFG.rockSpeed[1]), vy: R.n(CFG.rockDrift), spin: R.n(1.5) };
  },
};
