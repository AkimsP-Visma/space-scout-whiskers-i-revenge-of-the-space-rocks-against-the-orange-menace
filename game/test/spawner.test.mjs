import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame } from './load.mjs';

const $ = loadGame(['config.js', 'spawner.js']), Spawner = $('Spawner'), CFG = $('CFG');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('at the start: slow, sparse, rocks only', () => {
  const d = Spawner.difficulty(0);
  near(d.scroll, 150); near(d.interval, 1.2); near(d.mix.rock, 1); near(d.mix.ice, 0); near(d.mix.comet, 0);
});
test('no ice up to 15s, no comets up to 30s', () => {
  near(Spawner.difficulty(15).mix.ice, 0); near(Spawner.difficulty(30).mix.comet, 0);
  assert.ok(Spawner.difficulty(16).mix.ice > 0); assert.ok(Spawner.difficulty(31).mix.comet > 0);
});
test('at 120s and after: the hard level, held', () => {
  for (const t of [120, 500]) {
    const d = Spawner.difficulty(t);
    near(d.scroll, 300); near(d.interval, 0.45); near(d.mix.rock, 0.6); near(d.mix.ice, 0.3); near(d.mix.comet, 0.1);
  }
});
test('the scroll speed never drops as time goes on', () => {
  let last = 0;
  for (let t = 0; t <= 130; t += 0.5) { const s = Spawner.difficulty(t).scroll; assert.ok(s >= last - 1e-9); last = s; }
});
test('ice never spawns before 15s and comets never before 30s', () => {
  for (let n = 0; n < 400; n++) assert.notEqual(Spawner.next(7, n, (n / 400) * 15).kind, 'ice');
  for (let n = 0; n < 400; n++) assert.notEqual(Spawner.next(7, n, (n / 400) * 30).kind, 'comet');
});
test('the same seed brings the same spawns; another seed does not', () => {
  const run = (seed) => JSON.stringify(Array.from({ length: 50 }, (_, n) => Spawner.next(seed, n, n)));
  assert.equal(run(3), run(3));
  assert.notEqual(run(3), run(4));
});
test('spawned sizes stay inside the configured ranges', () => {
  for (let n = 0; n < 300; n++) {
    const s = Spawner.next(9, n, 200);
    if (s.kind === 'rock') { const [a, b] = CFG.rocks[s.size].r; assert.ok(s.r >= a && s.r <= b); }
    if (s.kind === 'ice') assert.ok(s.r >= CFG.ice.r[0] && s.r <= CFG.ice.r[1]);
  }
});
