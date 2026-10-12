import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, plain } from './load.mjs';

const $ = loadGame(['config.js', 'collide.js']), Collide = $('Collide');

test('overlapping circles hit', () => assert.equal(Collide.circles({ x: 0, y: 0, r: 3 }, { x: 4, y: 0, r: 2 }), true));
test('touching circles do not hit', () => assert.equal(Collide.circles({ x: 0, y: 0, r: 3 }, { x: 5, y: 0, r: 2 }), false));
test('separate circles do not hit', () => assert.equal(Collide.circles({ x: 0, y: 0, r: 3 }, { x: 9, y: 0, r: 2 }), false));
test('the hitbox follows the scout: the hull centre and the nose', () => {
  assert.deepEqual(plain(Collide.scoutHitbox(100, 50)), [{ x: 100, y: 50, r: 5 }, { x: 114, y: 51, r: 3 }]);
});
test('a rock at the nose hits; the same rock above the canopy misses', () => {
  const scout = { x: 100, y: 50 };
  assert.equal(Collide.hitsScout(scout, { x: 118, y: 51, r: 2 }), true);
  assert.equal(Collide.hitsScout(scout, { x: 100, y: 38, r: 2 }), false);
});
