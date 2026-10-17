import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, plain } from './load.mjs';

const $ = loadGame(['config.js', 'view.js']);
const View = $('View'), CFG = $('CFG');

test('the run opens on the film frame, centred in the field', () => {
  const v = plain(View.at(0));
  assert.deepEqual([v.w, v.h, v.ox, v.oy], [320, 180, 80, 45]);
  assert.deepEqual(plain(View.at(CFG.view.delay)), v);   // it holds that frame for the delay
});
test('the camera pulls back to the whole field and stays', () => {
  for (const t of [CFG.view.delay + CFG.view.dur, 30]) assert.deepEqual([View.at(t).w, View.at(t).h, View.at(t).ox, View.at(t).oy], [480, 270, 0, 0]);
});
test('the view only grows, stays 16:9 and stays centred', () => {
  let w = 0;
  for (let t = 0; t < 2; t += 1 / 60) {
    const v = View.at(t);
    assert.ok(v.w >= w); w = v.w;
    assert.ok(Math.abs(v.h - v.w * 9 / 16) <= 1);
    assert.ok(Math.abs(v.ox + v.w / 2 - 240) < 1e-9);
  }
});
test('the scout stays inside what the camera shows', () => {
  const b = View.bounds(View.at(0));
  assert.ok(b.minX >= 80 && b.maxX <= 400 && b.minY >= 45 && b.maxY <= 225);
  const f = View.bounds(View.at(5));
  assert.deepEqual([f.minX, f.minY, f.maxX, f.maxY], [CFG.scout.minX, CFG.scout.minY, CFG.scout.maxX, CFG.scout.maxY]);
});
