// =====================================================================
//  FLOW - the page's states and main loop. title: the film's first frame while the sounds render; film: the film once,
//  on the audio clock; select: the level list over a live scene (after the film, and after a level); play: a level, from
//  its start to its boss; over: the burst, then the card; complete: the level complete card. P pauses, M mutes; a crash
//  stops the loop and shows itself on screen. ?test exposes window.GAME (the state, a hit and a win trigger) for the smoke test.
// =====================================================================
const CANVAS = document.getElementById('c');
const IS_TEST = new URLSearchParams(location.search).has('test');
const EVENT_SOUND = { fire: 'fire', rocketFire: 'rocketFire', pickup: 'pickup', overheat: 'overheat', rockHit: 'rockHit', rockBreak: 'rockBreak', iceClank: 'iceClank', cometWarn: 'cometWarn', cometGo: 'cometWhoosh', shieldHit: 'shieldHit', gameOver: 'gameOver', bossWarn: 'bossWarn', bossShot: 'bossShot', bossHit: 'bossHit', bossDeath: 'bossDeath', levelExit: 'levelExit' };
const PILOT_CARD = { from: 14.6, length: 1.4 };   // the film's close-up (14.5-16.0s) looped behind the card: eyes wide, a blink, the gulp
const FRAME_SAMPLES = 600;                        // play frames kept for the frame-time figures
const Flow = {
  name: 'title', since: 0, filmAt: null, filmFrame: null, run: null, runs: 0, bests: [], level: 0, menu: null, deniedAt: -1e9, paused: false, error: null,
  acc: 0, last: 0, frameMs: [], titleFrame: null, card: null, cardB: null, escPending: false, escAt: 0,
  go(name, now) { Flow.name = name; Flow.since = now; },
  levelId() { return CFG.levels[Flow.level].id; },
  best() { return Flow.bests[Flow.level] ?? 0; },
  secondsIn(now) { return (now - Flow.since) / 1000; },
  seed() { return IS_TEST ? 1 + Flow.runs : (Date.now() % 1e9) + Flow.runs; },
  canvas() { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; },
  // ---- title: the film's first frame, drawn once, with the prompt over it
  title(now) {
    if (!Flow.titleFrame) { Flow.titleFrame = Flow.canvas(); renderFrame(0, Flow.titleFrame); }
    ctx = CANVAS.getContext('2d');
    ctx.drawImage(Flow.titleFrame, 0, 0);
    Hud.overlay(CANVAS, () => Hud.title(Flow.secondsIn(now), Sound.failed ? 'silent' : Sound.ready ? 'ready' : 'loading'));
  },
  startFilm(now) { Sound.start(); Flow.filmAt = Sound.playFilm(); Flow.filmFrame = null; Flow.go('film', now); },
  // the film's clock: the audio's while it runs, the wall clock without sound (a context still starting reads as 0)
  filmTime(now) { return Flow.filmAt == null ? Flow.secondsIn(now) : Sound.running() ? Sound.now() - Flow.filmAt : 0; },
  // a context the browser keeps suspended gets a short grace; then the film restarts silently on the wall clock
  // instead of waiting on frame 0 for sound that never comes
  fallBackIfSilent(now) {
    if (Flow.filmAt == null || Sound.running() || Flow.secondsIn(now) < CFG.audioGrace) return;
    Sound.stopFilm();
    Sound.fail('start', new Error('the browser kept the audio suspended'));
    Flow.filmAt = null;
    Flow.go('film', now);
  },
  // ---- film: its frames on the audio clock (the wall clock without sound), redrawn only when the frame changes
  film(now) {
    Flow.fallBackIfSilent(now);
    const t = Flow.filmTime(now);
    if (t >= LOOP_T) { Flow.filmDone(now, Flow.filmAt != null ? Flow.filmAt + LOOP_T : null); return; }
    const f = Math.max(0, Math.floor(t * FPS));
    if (f !== Flow.filmFrame) { renderFrame(f / FPS, CANVAS); Flow.filmFrame = f; }
    if (Flow.escPending && now - Flow.escAt < 3000) Hud.overlay(CANVAS, () => pixText('PRESS ESC AGAIN TO SKIP', PX_W / 2, 170, Q.white, { align: 'center', shadow: Q.ink }));
  },
  // the film is over (it ran out, or was skipped): its last frame eases out into the level select; the music carries on from
  // the film's bar line, and the level chosen starts from wherever the scout and the stars are
  filmDone(now, musicAt = null) {
    Sound.stopFilm(); Sound.startMusic(musicAt);
    Flow.escPending = false;
    Flow.enterMenu(now, true);
    Flow.go('select', now);
  },
  // ---- a new run: from the film's last frame (after the film or a skip), or else flying in on the whole field (a retry
  // or a level chosen from the list); musicAt keeps the music on the film's bar line
  startRun(now, musicAt = null, fromMenu = false) {
    Sound.stopFilm(); Sound.startMusic(musicAt); Sound.engineOn();
    const m = Flow.menu, opts = { flyIn: true };
    if (fromMenu) Object.assign(opts, { from: { x: m.marker.x, y: m.marker.y + Draw.bobAt(m.t0 + (now - m.at) / 1000) }, scrolled: m.scrolled, scroll0: m.scroll, throttle0: CFG.menu.throttle });
    Flow.run = Play.create(Flow.seed(), SEAM_START, opts); Flow.runs++;
    Flow.acc = 0; Flow.last = now; Flow.paused = false; Flow.escPending = false;
    Flow.go('play', now);
  },
  play(now) {
    if (!Flow.paused) Flow.advance(now);
    const t0 = performance.now();
    Draw.frame(CANVAS, Flow.run);
    Flow.frameMs.push(performance.now() - t0);
    if (Flow.frameMs.length > FRAME_SAMPLES) Flow.frameMs.shift();
    if (Flow.paused) { const v = View.of(Flow.run); Hud.overlay(CANVAS, () => Hud.paused(), [v.w, v.h]); }
    if (Flow.run.over && Flow.run.t - Flow.run.overAt >= CFG.gameOver.card) Flow.endRun(now);
    if (Flow.run.exited) Flow.completeLevel(now);
  },
  advance(now) {
    const { steps, acc } = Play.catchUp(Flow.acc, (now - Flow.last) / 1000);
    Flow.acc = acc; Flow.last = now;
    for (let i = 0; i < steps; i++) {
      Play.step(Flow.run, Input.steer(), CFG.step);
      for (const e of Flow.run.events) {
        if (EVENT_SOUND[e]) Sound.sfx(EVENT_SOUND[e]);
        if (e === 'gameOver') Sound.engineOff();
      }
    }
    if (!Flow.run.over) Sound.engineSet(Play.engineAt(Flow.run));
  },
  // ---- over: the card over the film's pilot close-up, redrawn only when the close-up's clock steps
  saveBest(score) { Flow.bests[Flow.level] = Math.max(Flow.best(), score); BestScore.save(Flow.bests[Flow.level], Flow.levelId()); },
  endRun(now) { Flow.saveBest(Flow.run.score); Flow.cardB = null; Flow.go('over', now); },
  // ---- complete and select: the belt's backdrop scrolling on (stars flying past, nothing that can hurt), with a card or the list
  // over it. After the film it is the film's last frame easing out and speeding up (the seam, with no scout in the way of the
  // list: the scout is the marker); after a level it carries on from where the run stopped.
  enterMenu(now, fromFilm) {
    const r = Flow.run, M = CFG.menu, start = CFG.seam.startScroll;
    Flow.menu = fromFilm
      ? { fromFilm, at: now, t0: 0, scrolled: 0, scroll: start, scroll0: start, last: now, dt: 0, marker: { x: MENU_X, y: MENU_Y0 + Flow.level * M.rowGap } }
      : { fromFilm, at: now, t0: r.t, scrolled: r.base + r.scrolled, scroll: r.scroll, scroll0: r.scroll, last: now, dt: 0, marker: { x: M.enterFrom, y: MENU_Y0 + Flow.level * M.rowGap } };
  },
  completeLevel(now) {
    Flow.saveBest(Flow.run.score);
    Sound.engineOff(); Sound.sfx('levelComplete');
    Flow.enterMenu(now, false);
    Flow.go('complete', now);
  },
  // the menu's world this frame: its clock, how far the stars have travelled, how fast, the camera, the scout's throttle
  menuState(now) {
    const m = Flow.menu, M = CFG.menu, secs = (now - m.at) / 1000;
    m.dt = clamp((now - m.last) / 1000, 0, 0.1); m.last = now;
    m.scroll = m.fromFilm ? lerp(m.scroll0, M.scroll, Play.rampAt(secs)) : lerp(m.scroll0, M.scroll, EZ.io(seg(secs, 0, M.settle)));
    m.scrolled += m.scroll * m.dt;
    return {
      t: m.t0 + secs, secs, fromFilm: m.fromFilm, scrolled: m.scrolled, scroll: m.scroll, moonFrom: null,
      view: m.fromFilm ? View.at(secs) : View.at(0, true),
      throttle: m.fromFilm ? lerp(CFG.seam.throttleFrom, M.throttle, Play.rampAt(secs)) : M.throttle,
    };
  },
  menuReady(now) { return Flow.secondsIn(now) >= (Flow.menu.fromFilm ? CFG.menu.uiFilm : CFG.menu.uiRun); },
  complete(now) {
    Draw.menu(CANVAS, Flow.menuState(now), () => { hudTag({ at: -1 }); Hud.levelComplete(Flow.run.score, Flow.best(), Flow.secondsIn(now)); });
  },
  select(now) {
    const s = Flow.menuState(now), m = Flow.menu, M = CFG.menu, k = Math.min(1, M.ease * m.dt);
    m.marker.x += (MENU_X - m.marker.x) * k;
    m.marker.y += (MENU_Y0 + Flow.level * M.rowGap - m.marker.y) * k;
    const bests = CFG.levels.map((_, i) => Flow.bests[i] ?? 0), notice = now - Flow.deniedAt < M.notice * 1000;
    Draw.menu(CANVAS, s, (v) => {
      hudTag({ at: -1 });
      Draw.marker(s, m.marker, v);
      if (Flow.menuReady(now)) Hud.select(CFG.levels, Flow.level, bests, Flow.secondsIn(now), notice);
    });
  },
  // start the chosen level from the select: the stars and the scout carry on from where they are; a locked level only says so
  startChosen(now) {
    if (CFG.levels[Flow.level].locked) { Flow.deniedAt = now; Sound.sfx('iceClank'); return; }
    Sound.sfx('retry'); Flow.startRun(now, null, true);
  },
  over(now) {
    const t = Flow.secondsIn(now);
    TT = PILOT_CARD.from + mod(t, PILOT_CARD.length); B = Math.floor(TT * 12 + 1e-6); E0 = 0;
    if (B !== Flow.cardB) {
      Flow.card = Flow.card ?? Flow.canvas();
      ctx = Flow.card.getContext('2d');
      scenePilot();
      PostOverlay.draw();
      Flow.cardB = B;
    }
    ctx = CANVAS.getContext('2d');
    ctx.drawImage(Flow.card, 0, 0);
    Hud.overlay(CANVAS, () => Hud.card(Flow.run.score, Flow.best(), t));
  },
  // ---- one-shot keys per state; steering and firing come from the held keys during play
  keys(now) {
    for (const code of Input.takePressed()) {
      if (Input.is(code, 'mute')) { Sound.setMuted(!Sound.muted); continue; }
      if (Flow.name === 'title') { if (Sound.ready || Sound.failed) Flow.startFilm(now); continue; }
      if (Flow.name === 'film') {
        if (Input.is(code, 'skip')) { Flow.filmDone(now); continue; }
        if (Input.is(code, 'skipEsc')) {
          if (Flow.escPending && now - Flow.escAt < 3000) { Flow.filmDone(now); continue; }
          Flow.escPending = true; Flow.escAt = now; Flow.filmFrame = -1; continue;
        }
      }
      if (Flow.name === 'play' && Input.is(code, 'pause')) { Flow.paused = !Flow.paused; Flow.last = now; Sound.pause(Flow.paused); continue; }
      if (Flow.name === 'complete' && (Input.is(code, 'fire') || Input.is(code, 'skip')) && Flow.secondsIn(now) >= CFG.gameOver.retryLockout) { Sound.sfx('retry'); Flow.go('select', now); continue; }
      if (Flow.name === 'select') {
        const n = CFG.levels.length;
        if (!Flow.menuReady(now)) continue;
        if (Input.is(code, 'up')) Flow.level = (Flow.level + n - 1) % n;
        else if (Input.is(code, 'down')) Flow.level = (Flow.level + 1) % n;
        else if ((Input.is(code, 'fire') || Input.is(code, 'skip')) && Flow.menuReady(now)) Flow.startChosen(now);
        continue;
      }
      if (Flow.name === 'over' && (Input.is(code, 'fire') || Input.is(code, 'skip')) && Flow.secondsIn(now) >= CFG.gameOver.retryLockout) { Sound.sfx('retry'); Flow.startRun(now); }
    }
  },
  frame(now) {
    if (Flow.error) return;
    try {
      Flow.keys(now);
      Flow[Flow.name](now);
      requestAnimationFrame(Flow.frame);
    } catch (e) { Flow.crash(e); }
  },
  crash(e) {
    Flow.error = e;
    console.error(`[game] a frame failed in state "${Flow.name}", so the loop has stopped:`, e);
    try { Hud.overlay(CANVAS, () => Hud.error(e && e.message ? e.message : e)); }
    catch (drawError) { console.error('[game] the error card could not be drawn either:', drawError); }
  },
};

Input.attach(window);
window.addEventListener('keydown', Sound.unlock);   // some browsers only start audio inside the key event itself
CFG.levels.forEach((L, i) => { Flow.bests[i] = BestScore.load(L.id); });
Sound.prepare();
if (IS_TEST) window.GAME = {
  state() {
    const r = Flow.run, ms = [...Flow.frameMs].sort((a, b) => a - b);
    return {
      name: Flow.name, ready: Sound.ready, soundFailed: Sound.failed, paused: Flow.paused, error: Flow.error ? String(Flow.error) : null,
      marker: Flow.menu ? { x: Flow.menu.marker.x, y: Flow.menu.marker.y } : null, filmTime: Flow.name === 'film' ? Flow.filmTime(performance.now()) : null, best: Flow.best(), level: Flow.level,
      t: r ? r.t : null, score: r ? r.score : null, shields: r ? r.player.shields : null, x: r ? r.player.x : null, y: r ? r.player.y : null,
      fired: r ? r.fired : null, objects: r ? r.objects.length : null,
      frameMs: { median: ms.length ? ms[Math.floor(ms.length / 2)] : null, worst: ms.length ? ms[ms.length - 1] : null, samples: ms.length },
    };
  },
  hit() { if (Flow.run) Play.forceHit(Flow.run); },
  // beats the level at once: the boss appears and falls
  win() { const r = Flow.run; if (!r || r.complete) return; if (!r.boss) Play.forceBoss(r); Play.defeatBoss(r); r.score = Play.scoreOf(r); },
};
requestAnimationFrame((now) => { Flow.go('title', now); Flow.frame(now); });
