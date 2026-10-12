#!/usr/bin/env node
// The browser smoke test: builds game/index.html, opens it in headless Chromium with ?test, walks it and checks every
// page for errors. Screenshots go to game/test-output/.   usage: node game/test/smoke.mjs
import { createRequire } from 'node:module';
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); } })();
const GAME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), OUT = path.join(GAME, 'test-output');
const results = [], PAGES = [];
const check = (ok, text) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`); };

// opens the page with a query, collecting its uncaught exceptions and console errors
async function open(browser, query) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } }), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  PAGES.push({ query, errors });
  await page.goto(pathToFileURL(path.join(GAME, 'index.html')).href + query);
  await page.waitForFunction(() => window.GAME);
  const state = () => page.evaluate(() => window.GAME.state());
  const until = async (pred, ms, what) => {
    const t0 = Date.now();
    for (;;) {
      const s = await state();
      if (pred(s)) return s;
      if (Date.now() - t0 > ms) throw new Error(`timed out after ${ms}ms waiting for ${what} (state: ${JSON.stringify(s)})`);
      await page.waitForTimeout(50);
    }
  };
  const shot = async (name) => {
    const url = await page.evaluate(() => document.getElementById('c').toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  };
  return { page, errors, state, until, shot };
}

// the seam: the game's first frame against the film's last, outside the HUD rows and the log line; then the draw
// time of a busy frame (ten seconds into a run, steering and firing)
async function seamAndDrawTime(p) {
  const r = await p.page.evaluate(() => {
    const film = document.createElement('canvas'), game = document.createElement('canvas');
    film.width = game.width = W; film.height = game.height = H;
    renderFrame(FILM_END, film);
    const run = Play.create(1, SEAM_START);
    Draw.frame(game, run);
    const thumb = (c) => { const s = document.createElement('canvas'); s.width = 160; s.height = 90; const g = s.getContext('2d'); g.drawImage(c, 0, 0, 160, 90); return g.getImageData(0, 0, 160, 90).data; };
    const a = thumb(film), b = thumb(game);
    let sum = 0, n = 0;
    for (let y = 18; y < 90; y++) {
      if (y >= 70 && y < 86) continue;
      for (let x = 0; x < 160; x++) for (let c = 0; c < 3; c++) { const i = (y * 160 + x) * 4 + c; sum += Math.abs(a[i] - b[i]); n++; }
    }
    for (let k = 0; k < 600; k++) Play.step(run, { x: 0, y: k % 120 < 60 ? -1 : 1, fire: true }, CFG.step);
    const t0 = performance.now();
    for (let k = 0; k < 30; k++) Draw.frame(game, run);
    return { diff: sum / n, ms: (performance.now() - t0) / 30, things: run.objects.length + run.bolts.length + run.debris.length };
  });
  check(r.diff < 2, `the seam: the game's first frame matches the film's last (mean difference ${r.diff.toFixed(2)} of 255 outside the HUD)`);
  check(r.ms < 16.7, `a play frame with ${r.things} things in it draws in ${r.ms.toFixed(1)}ms (budget 16.7ms)`);
}

// the sounds render offline before any key: the film score, the music loop and every effect, none of them silent
const CLIPS = ['film', 'music', 'fire', 'rockHit', 'rockBreak', 'iceClank', 'cometWarn', 'cometWhoosh', 'shieldHit', 'gameOver', 'retry'];
async function soundRenders(p) {
  const r = await p.page.evaluate(async () => {
    await Sound.prepare();
    const peak = (b) => { let m = 0; for (let c = 0; c < b.numberOfChannels; c++) for (const v of b.getChannelData(c)) m = Math.max(m, Math.abs(v)); return m; };
    return { ready: Sound.ready, failed: Sound.failed, clips: Object.fromEntries(Object.entries(Sound.clips).map(([k, b]) => [k, { seconds: b.duration, peak: peak(b) }])) };
  });
  check(r.ready, `the sounds render before any key press (failed stage: ${r.failed})`);
  const missing = CLIPS.filter((k) => !r.clips[k]);
  check(missing.length === 0, `every clip is there${missing.length ? '; missing: ' + missing.join(', ') : ''}`);
  const film = r.clips.film?.seconds ?? 0, music = r.clips.music?.seconds ?? 0;
  check(Math.abs(film - 28) < 0.01 && Math.abs(music - 16) < 0.01, `the film score is 28s and the music loop 16s (${film.toFixed(2)}s, ${music.toFixed(2)}s)`);
  const silent = CLIPS.filter((k) => r.clips[k] && !(r.clips[k].peak > 0.01));
  check(silent.length === 0, `no clip is silent${silent.length ? '; silent: ' + silent.join(', ') : ''}`);
}

// the walk through the page: a key while loading, the title, the film, a skip, the seam, steering and firing, pause,
// game over and a retry; then the same page without sound
async function walk(browser) {
  const p = await open(browser, '?test');
  let s = await p.state();
  if (!s.ready && !s.soundFailed) {
    await p.page.keyboard.press('KeyX');
    await p.page.waitForTimeout(100);
    check((await p.state()).name === 'title', 'a key during LOADING is ignored');
  }
  await seamAndDrawTime(p);
  await soundRenders(p);
  s = await p.until((x) => x.ready || x.soundFailed, 30000, 'the sounds to render');
  check(s.name === 'title' && s.ready, `the title waits with the sounds ready (failed stage: ${s.soundFailed})`);
  await p.shot('1-title');
  await p.page.keyboard.press('KeyX');
  await p.until((x) => x.name === 'film', 2000, 'the film to start');
  await p.page.waitForTimeout(1500);
  s = await p.state();
  check(s.filmTime > 1, `the film plays on the audio clock (at ${s.filmTime.toFixed(2)}s)`);
  await p.shot('2-film');
  await p.page.keyboard.press('Enter');
  s = await p.until((x) => x.name === 'play', 2000, 'the seam after a skip');
  check(s.shields === 3 && s.t < 0.5, 'Enter skips the film into a new run with 3 shields');
  await p.page.waitForTimeout(200);
  await p.shot('3-seam');
  const y0 = (await p.state()).y;
  await p.page.keyboard.down('Space'); await p.page.keyboard.down('ArrowUp');
  await p.page.waitForTimeout(1200);
  await p.page.keyboard.up('ArrowUp');
  const yUp = (await p.state()).y;
  await p.page.keyboard.down('ArrowDown');
  await p.page.waitForTimeout(1200);
  await p.page.keyboard.up('ArrowDown'); await p.page.keyboard.up('Space');
  s = await p.state();
  check(yUp < y0 && s.y > yUp && s.fired > 0, `steering and firing work (y ${y0.toFixed(0)}, up to ${yUp.toFixed(0)}, down to ${s.y.toFixed(0)}; ${s.fired} bolts)`);
  await p.until((x) => x.objects > 0, 6000, 'the first objects');
  await p.page.keyboard.down('Space');   // objects spawn beyond the right edge: give the first one time to drift in, with bolts flying
  await p.page.waitForTimeout(1200);
  await p.shot('4-play');
  await p.page.keyboard.up('Space');
  await p.page.keyboard.press('KeyP');
  const paused = await p.until((x) => x.paused, 1000, 'the pause');
  await p.page.waitForTimeout(400);
  check((await p.state()).t === paused.t, 'P pauses the run');
  await p.page.keyboard.press('KeyP');
  await p.until((x) => !x.paused, 1000, 'the run to go on');
  for (let k = 0; k < 3; k++) await p.page.evaluate(() => window.GAME.hit());
  s = await p.until((x) => x.name === 'over', 3000, 'the game-over card');
  await p.page.waitForTimeout(300);
  await p.shot('5-game-over');
  check(s.score > 0 && s.best >= s.score, `the card shows the score ${s.score} and the best ${s.best}`);
  await p.page.keyboard.press('Space');
  s = await p.until((x) => x.name === 'play', 2000, 'a new run');
  check(s.shields === 3 && s.t < 0.5, 'Space on the card starts a new run');
  await p.page.waitForTimeout(1500);
  const ms = (await p.state()).frameMs;
  check(ms.median < 16.7, `play frames draw in ${ms.median.toFixed(1)}ms median, ${ms.worst.toFixed(1)}ms worst, over ${ms.samples} frames (budget 16.7ms)`);
  const q = await open(browser, '?test&nosound');
  await q.until((x) => x.soundFailed, 5000, 'the silent start');
  await q.page.keyboard.press('KeyX');
  await q.until((x) => x.name === 'film', 2000, 'the silent film');
  await q.page.waitForTimeout(600);
  const silentFilm = await q.state();
  check(silentFilm.filmTime > 0.3, `?nosound: the film runs on the wall clock (at ${silentFilm.filmTime.toFixed(2)}s)`);
  await q.page.keyboard.press('Escape');
  const silentPlay = await q.until((x) => x.name === 'play', 2000, 'play without sound');
  check(silentPlay.shields === 3, '?nosound: Esc skips into play');
}

const built = spawnSync(process.execPath, [path.join(GAME, 'build.mjs')], { stdio: 'inherit' });
if (built.status !== 0) process.exit(built.status ?? 1);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
try { await walk(browser); } catch (e) { check(false, e.message); }
for (const { query, errors } of PAGES) check(errors.length === 0, `no page errors with ${query}${errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(failed ? `smoke: FAIL (${failed} of ${results.length})` : `smoke: PASS (${results.length} checks)`);
process.exit(failed ? 1 : 0);
