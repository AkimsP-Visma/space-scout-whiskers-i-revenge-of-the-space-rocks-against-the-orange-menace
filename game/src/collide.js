// =====================================================================
//  COLLIDE - circle tests. The scout's hitbox is two circles along its hull, smaller than the sprite, so near misses
//  feel fair. Touching circles do not count as a hit.
// =====================================================================
const Collide = {
  circles(a, b) { const dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r; return dx * dx + dy * dy < r * r; },
  scoutHitbox(x, y) { return CFG.hitbox.map((c) => ({ x: x + c.dx, y: y + c.dy, r: c.r })); },
  hitsScout(scout, o) { return Collide.scoutHitbox(scout.x, scout.y).some((c) => Collide.circles(c, o)); },
  // a against b over one step (px, py: where each was before it): true if they overlap at any moment of the step, not
  // only at its end, because a bolt and a rock close in by up to 12px a step, more than a small rock is wide
  swept(a, b) {
    const sx = (a.px ?? a.x) - (b.px ?? b.x), sy = (a.py ?? a.y) - (b.py ?? b.y), vx = a.x - b.x - sx, vy = a.y - b.y - sy;
    const vv = vx * vx + vy * vy, t = vv > 0 ? clamp(-(sx * vx + sy * vy) / vv) : 0, cx = sx + vx * t, cy = sy + vy * t, r = a.r + b.r;
    return cx * cx + cy * cy < r * r;
  },
};
