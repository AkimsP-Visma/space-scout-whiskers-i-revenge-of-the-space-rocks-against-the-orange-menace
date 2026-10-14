// =====================================================================
//  OBJECTS - everything that flies in the belt, as plain records { kind, x, y, r, vx, vy, angle, spin, ... }. These
//  functions create and move them and decide what a hit does; they never draw.
//  Kinds: 'rock' (shootable: small, medium, large), 'ice' and 'comet' (indestructible), 'bolt', 'debris'.
//  Debris carries a colour role ('rock' | 'spark' | 'scout') and a shade index; the drawing picks the colours.
// =====================================================================
const Objects = {
  // a spawn description from Spawner.next, at the current scroll speed; id makes the key that shapes a rock
  fromSpawn(sp, scroll, id) {
    const key = 'o' + id;
    if (sp.kind === 'comet') return { kind: 'comet', key, x: CFG.spawn.x, y: sp.y, r: CFG.comet.headR, vx: -CFG.comet.speed, vy: CFG.comet.speed * sp.slope, angle: 0, spin: 0, warn: CFG.comet.warn };
    if (sp.kind === 'ice') return { kind: 'ice', key, x: CFG.spawn.x + sp.r, y: sp.y, r: sp.r, vx: -scroll * sp.speed, vy: 0, angle: 0, spin: sp.spin };
    if (sp.kind === 'pickup') return { kind: 'pickup', role: sp.role, key, x: CFG.spawn.x, y: sp.y, r: CFG.pickup.r, vx: -scroll * sp.speed, vy: 0, angle: 0, spin: CFG.pickup.spinRate };
    return Objects.rock(sp.size, CFG.spawn.x + sp.r, sp.y, sp.r, -scroll * sp.speed, sp.vy, sp.spin, key);
  },
  rock(size, x, y, r, vx, vy, spin, key) { return { kind: 'rock', size, key, x, y, r, vx, vy, angle: 0, spin, hp: CFG.rocks[size].hp }; },
  bolt(x, y, vy = 0) { return { kind: 'bolt', x, y, r: CFG.bolt.r, vx: CFG.bolt.speed, vy }; },
  rocketBolt(x, y) { return { kind: 'bolt', role: 'rocket', x, y, r: CFG.rocket.r, vx: CFG.rocket.speed, vy: 0 }; },
  // count single pixels flying out of (x, y); key seeds the spray, so the same break always looks the same
  debris(x, y, count, role, key, life = CFG.debris.life) {
    const R = RNG('debris', key), D = CFG.debris;
    return Array.from({ length: count }, () => {
      const a = R.r(0, TAU), v = R.r(D.speed[0], D.speed[1]);
      return { kind: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, role, shade: R.i(0, 2) };
    });
  },
  // advance by dt; a comet first sits out its warning at the edge, then moves for the time left over
  move(o, dt) {
    if (o.warn > 0) { o.warn -= dt; if (o.warn > 0) return; dt = -o.warn; o.warn = 0; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.spin) o.angle += o.spin * dt;
    if (o.kind === 'debris') o.life -= dt;
  },
  isGone(o) {
    if (o.kind === 'debris') return o.life <= 0;
    if (o.kind === 'bolt') return o.x > CFG.bolt.goneX;
    return o.x < CFG.goneX - (o.kind === 'comet' ? CFG.comet.tail : o.r);   // a comet waits for its whole tail to leave
  },
  // a bolt hits rock o: { destroyed, points, pieces }; a destroyed large rock leaves two medium rocks, the rest debris
  hitRock(o) {
    o.hp -= 1;
    if (o.hp > 0) return { destroyed: false, points: 0, pieces: [] };
    const S = CFG.rocks[o.size];
    if (!S.splitsInto) return { destroyed: true, points: S.points, pieces: Objects.debris(o.x, o.y, RNG('debris-count', o.key).i(CFG.debris.count[0], CFG.debris.count[1]), 'rock', o.key) };
    const into = CFG.rocks[S.splitsInto], r = Math.round((into.r[0] + into.r[1]) / 2);
    const pieces = [-1, 1].map((s) => Objects.rock(S.splitsInto, o.x, o.y + s * r, r, o.vx, o.vy + s * CFG.splitDrift, -s * o.spin, o.key + (s < 0 ? 'a' : 'b')));
    return { destroyed: true, points: S.points, pieces };
  },
};
