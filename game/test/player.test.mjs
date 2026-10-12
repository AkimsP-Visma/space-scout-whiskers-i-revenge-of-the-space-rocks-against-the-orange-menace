import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, plain } from './load.mjs';

const $ = loadGame(['config.js', 'player.js']), P = $('Player'), CFG = $('CFG');
const idle = { x: 0, y: 0, fire: false };

test('the scout stays inside its area', () => {
  const p = P.create(100, 100);
  for (let i = 0; i < 600; i++) P.steer(p, { x: 1, y: -1, fire: false }, 1 / 60);
  assert.equal(p.x, CFG.scout.maxX); assert.equal(p.y, CFG.scout.minY);
  for (let i = 0; i < 600; i++) P.steer(p, { x: -1, y: 1, fire: false }, 1 / 60);
  assert.equal(p.x, CFG.scout.minX); assert.equal(p.y, CFG.scout.maxY);
});
test('holding fire gives at most 6 bolts a second', () => {
  const p = P.create(100, 100);
  let n = 0;
  for (let i = 0; i < 60; i++) if (P.tryFire(p, true, 1 / 60)) n++;
  assert.equal(n, 6);
});
test('a bolt leaves from the nose', () => {
  assert.deepEqual(plain(P.tryFire(P.create(100, 100), true, 1 / 60)), { x: 122, y: 101 });
});
test('a hit costs one shield; hits while invulnerable cost nothing', () => {
  const p = P.create(100, 100);
  assert.equal(P.hit(p), true); assert.equal(p.shields, 2);
  assert.equal(P.hit(p), false); assert.equal(p.shields, 2);
  for (let i = 0; i < 91; i++) P.steer(p, idle, 1 / 60);
  assert.equal(P.hit(p), true); assert.equal(p.shields, 1);
});
test('a hit knocks the scout back 8 px', () => {
  const p = P.create(100, 100);
  P.hit(p);
  assert.equal(p.x, 92);
});
test('the third hit ends the run, and nothing hits after it', () => {
  const p = P.create(100, 100);
  for (let k = 0; k < 3; k++) { P.hit(p); p.invulnerable = 0; }
  assert.equal(p.shields, 0); assert.equal(p.alive, false); assert.equal(P.hit(p), false);
});
test('the scout blinks while invulnerable and not after', () => {
  const p = P.create(100, 100);
  P.hit(p);
  assert.equal(P.isBlinkedOut(p, 0.15), true); assert.equal(P.isBlinkedOut(p, 0.25), false);
  p.invulnerable = 0;
  assert.equal(P.isBlinkedOut(p, 0.15), false);
});
