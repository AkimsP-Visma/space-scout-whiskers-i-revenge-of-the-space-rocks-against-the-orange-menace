// =====================================================================
//  COLLIDE - circle tests. The scout's hitbox is two circles along its hull, smaller than the sprite, so near misses
//  feel fair. Touching circles do not count as a hit.
// =====================================================================
const Collide = {
  circles(a, b) { const dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r; return dx * dx + dy * dy < r * r; },
  scoutHitbox(x, y) { return CFG.hitbox.map((c) => ({ x: x + c.dx, y: y + c.dy, r: c.r })); },
  hitsScout(scout, o) { return Collide.scoutHitbox(scout.x, scout.y).some((c) => Collide.circles(c, o)); },
};
