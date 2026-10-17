// =====================================================================
//  BOSS - the Drift Warden: appears when score reaches CFG.boss.scoreAt, enters from the right, then flies a random
//  sequence of moves (track the scout, sweep the whole height, dash between spots, weave), fires volleys of enemy
//  bolts, and takes CFG.boss.hp hits to destroy. Suspends normal spawning while alive. Never draws.
// =====================================================================
const Boss = {
  // seed and num (which boss of the run) key its random moves, so a seed always gives the same fight
  create(hp = CFG.boss.hp, seed = 0, num = 1) {
    const C = CFG.boss;
    return { x: CFG.spawn.x + C.r, y: C.startY, px: CFG.spawn.x + C.r, py: C.startY, r: C.r, hp, maxHp: hp, vx: 0, vy: 0,
             nextFire: C.firstFire, volleys: 0, in: false, seed, num, moves: 0, move: 'track', moveLeft: C.moves.length[0], age: 0, spot: null, spotLeft: 0 };
  },
  entered(b) { return b.in || b.x <= CFG.boss.enterX; },
  // the top and bottom of where its centre may go: the scout's whole area
  span() { const r = CFG.boss.r; return [CFG.scout.minY + r, CFG.scout.maxY - r]; },
  // the next move: random, never the one it just did
  nextMove(b, phase2) {
    const M = CFG.boss.moves, R = RNG('bossMove', b.seed, b.num, b.moves++);
    b.move = R.pick(M.list.filter((m) => m !== b.move));
    b.moveLeft = R.r(M.length[0], M.length[1]) * (phase2 ? M.phase2Length : 1);
    b.age = 0; b.spotLeft = 0;
    return R;
  },
  // where it is heading now: { x, y, speed }
  aim(b, scout, dt, phase2) {
    const C = CFG.boss, M = C.moves, [top, bottom] = Boss.span(), mid = (top + bottom) / 2, half = (bottom - top) / 2 * M.reach;
    b.age += dt; b.moveLeft -= dt;
    let R = null;
    if (b.moveLeft <= 0) R = Boss.nextMove(b, phase2);
    const fast = phase2 ? M.phase2Speed : 1, home = C.enterX, two = Math.PI * 2;
    switch (b.move) {
      case 'sweep': return { x: home, y: mid + half * Math.sin(b.age * two / M.sweepPeriod), speed: M.speed * fast };
      case 'weave': return { x: home + M.weaveX * Math.sin(b.age * two / M.weavePeriod[0]), y: mid + half * 0.8 * Math.cos(b.age * two / M.weavePeriod[1]), speed: M.speed * fast };
      case 'dash':
        b.spotLeft -= dt;
        if (b.spotLeft <= 0 || !b.spot) {
          const D = R ?? RNG('bossSpot', b.seed, b.num, b.moves, Math.floor(b.age * 100));
          b.spot = { x: D.r(M.xRange[0], M.xRange[1]), y: D.r(top, bottom) };
          b.spotLeft = M.dashEvery / fast;
        }
        return { x: b.spot.x, y: b.spot.y, speed: M.speed * fast };
      default: return { x: home, y: clamp(scout.y, top, bottom), speed: C.trackSpeed * (phase2 ? C.moves.phase2Speed : 1) };
    }
  },
  // advance boss by dt; returns array of enemy bolt records to push into s.objects
  step(b, scout, dt) {
    const C = CFG.boss, [top, bottom] = Boss.span();
    b.px = b.x; b.py = b.y;
    const phase2 = b.hp <= b.maxHp * C.phaseAt;
    if (!b.in && b.x <= C.enterX) b.in = true;
    if (!b.in) {
      b.x = Math.max(C.enterX, b.x - C.enterSpeed * dt);
      b.vy = clamp((clamp(scout.y, top, bottom) - b.y) * C.trackEase, -C.trackSpeed, C.trackSpeed);
    } else {
      const a = Boss.aim(b, scout, dt, phase2);
      b.vx = clamp((a.x - b.x) * C.trackEase, -a.speed, a.speed);
      b.vy = clamp((a.y - b.y) * C.trackEase, -a.speed, a.speed);
      b.x = clamp(b.x + b.vx * dt, C.moves.xRange[0], C.moves.xRange[1]);
    }
    b.y = clamp(b.y + b.vy * dt, top, bottom);
    b.nextFire -= dt;
    if (!b.in || b.nextFire > 0) return [];
    b.nextFire = phase2 ? C.fireRate[1] : C.fireRate[0];
    const n = RNG('bossShot', b.volleys++).i(C.shots[0], C.shots[1]);
    return Boss.volley(b, n);
  },
  volley(b, n) {
    const C = CFG.boss, off = -(n - 1) * C.shotSpread / 2;
    return Array.from({ length: n }, (_, i) => ({
      kind: 'enemyBolt', x: b.x - C.r, y: b.y + off + i * C.shotSpread,
      r: C.shotR, vx: -C.shotSpeed, vy: 0, angle: 0, spin: 0,
    }));
  },
};
