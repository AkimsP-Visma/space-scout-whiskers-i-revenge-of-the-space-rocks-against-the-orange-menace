import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'objects.js']), O = $('Objects'), CFG = $('CFG');

test('a large rock takes 3 hits and splits into two medium rocks', () => {
  const r = O.rock('large', 100, 50, 9, -150, 0, 1, 'k');
  assert.equal(O.hitRock(r).destroyed, false);
  assert.equal(O.hitRock(r).destroyed, false);
  const out = O.hitRock(r);
  assert.equal(out.destroyed, true); assert.equal(out.points, 50); assert.equal(out.pieces.length, 2);
  assert.ok(out.pieces.every((p) => p.kind === 'rock' && p.size === 'medium' && p.hp === 2));
  assert.ok(out.pieces[0].y < 50 && out.pieces[1].y > 50);
});
test('medium and small rocks break into 6-10 debris', () => {
  for (const [size, hits, points] of [['medium', 2, 25], ['small', 1, 10]]) {
    const r = O.rock(size, 100, 50, 5, -150, 0, 0, size);
    let out;
    for (let i = 0; i < hits; i++) out = O.hitRock(r);
    assert.equal(out.destroyed, true); assert.equal(out.points, points);
    assert.ok(out.pieces.length >= 6 && out.pieces.length <= 10);
    assert.ok(out.pieces.every((p) => p.kind === 'debris' && p.role === 'rock'));
  }
});
test('debris expires at 0.6s', () => {
  const [d] = O.debris(0, 0, 1, 'rock', 'x');
  for (let i = 0; i < 35; i++) O.move(d, 1 / 60);
  assert.equal(O.isGone(d), false);
  for (let i = 0; i < 2; i++) O.move(d, 1 / 60);
  assert.equal(O.isGone(d), true);
});
test('bolts are gone past x 330, objects past the left edge', () => {
  const b = O.bolt(329, 50);
  assert.equal(O.isGone(b), false); O.move(b, 0.01); assert.equal(O.isGone(b), true);
  const r = O.rock('small', -40, 50, 3, -150, 0, 0, 'g');
  assert.equal(O.isGone(r), false); O.move(r, 0.1); assert.equal(O.isGone(r), true);
});
test('a comet waits at the edge for its warning, then crosses', () => {
  const c = O.fromSpawn({ kind: 'comet', y: 80, slope: 0 }, 150, 1);
  O.move(c, 0.5); assert.equal(c.x, CFG.spawn.x);
  O.move(c, 0.6); assert.ok(c.x < CFG.spawn.x);
});
test('a spawned rock enters beyond the right edge at the scroll speed', () => {
  const r = O.fromSpawn({ kind: 'rock', size: 'small', y: 60, r: 3, speed: 1, vy: 0, spin: 0 }, 150, 7);
  assert.equal(r.x, CFG.spawn.x + 3); assert.equal(r.vx, -150); assert.equal(r.hp, 1); assert.equal(r.key, 'o7');
});
