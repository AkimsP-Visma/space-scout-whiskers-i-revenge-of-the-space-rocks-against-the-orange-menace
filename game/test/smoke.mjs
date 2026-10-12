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

// the walk through the page
async function walk(browser) {
  const p = await open(browser, '?test');
  check((await p.state()).name === 'title', 'the page opens on the title');
  await p.shot('1-title');
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
