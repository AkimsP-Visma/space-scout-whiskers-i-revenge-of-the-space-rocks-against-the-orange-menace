// =====================================================================
//  BOSS - the Drift Warden: appears when score reaches CFG.boss.scoreAt, enters from the right, tracks the scout
//  vertically, fires volleys of enemy bolts, and takes CFG.boss.hp hits to destroy. Suspends normal spawning while
//  alive. Never draws.
// =====================================================================
const Boss = {
  create(hp = CFG.boss.hp) {
    const C = CFG.boss;
    return { x: CFG.spawn.x + C.r, y: 90, px: CFG.spawn.x + C.r, py: 90, r: C.r,
             hp, maxHp: hp, vy: 0, nextFire: 1.5, volleys: 0 };
  },
  entered(b) { return b.x <= CFG.boss.enterX; },
  // advance boss by dt; returns array of enemy bolt records to push into s.objects
  step(b, scout, dt) {
    const C = CFG.boss;
    b.px = b.x; b.py = b.y;
    const phase2 = b.hp <= b.maxHp * C.phaseAt;
    if (!Boss.entered(b)) {
      b.x = Math.max(C.enterX, b.x - C.enterSpeed * dt);
    }
    const targetY = clamp(scout.y, CFG.scout.minY + C.r, CFG.scout.maxY - C.r);
    const spd = phase2 ? C.trackSpeed * 1.6 : C.trackSpeed;
    b.vy = clamp((targetY - b.y) * C.trackEase, -spd, spd);
    b.y = clamp(b.y + b.vy * dt, CFG.scout.minY + C.r, CFG.scout.maxY - C.r);
    b.nextFire -= dt;
    if (!Boss.entered(b) || b.nextFire > 0) return [];
    b.nextFire = phase2 ? C.fireRate[1] : C.fireRate[0];
    const n = RNG('bossShot', b.volleys++).i(C.shots[0], C.shots[1]);
    return Boss.volley(b, n);
  },
  volley(b, n) {
    const C = CFG.boss, off = -(n - 1) * C.shotSpread / 2;
    return Array.from({ length: n }, (_, i) => ({
      kind: 'enemyBolt', x: b.x - C.r, y: b.y + off + i * C.shotSpread,
      r: 2, vx: -C.shotSpeed, vy: 0, angle: 0, spin: 0,
    }));
  },
};
