// =====================================================================
//  FLOW - the page's states and main loop. title: the film's first frame while the sounds render; film: the film once,
//  on the audio clock; play: the seam, then the belt; over: the burst, then the card. P pauses, M mutes; a crash stops
//  the loop and shows itself on screen. ?test exposes window.GAME (the state and a hit trigger) for the smoke test.
// =====================================================================
const CANVAS = document.getElementById('c');
const IS_TEST = new URLSearchParams(location.search).has('test');
const EVENT_SOUND = { fire: 'fire', rockHit: 'rockHit', rockBreak: 'rockBreak', iceClank: 'iceClank', cometWarn: 'cometWarn', cometGo: 'cometWhoosh', shieldHit: 'shieldHit', gameOver: 'gameOver' };
const PILOT_CARD = { from: 14.6, length: 1.4 };   // the film's close-up (14.5-16.0s) looped behind the card: eyes wide, a blink, the gulp
const FRAME_SAMPLES = 600;                        // play frames kept for the frame-time figures
const Flow = {
  name: 'title', since: 0, filmAt: null, filmFrame: null, run: null, runs: 0, best: 0, paused: false, error: null,
  acc: 0, last: 0, frameMs: [], titleFrame: null, card: null, cardB: null,
  go(name, now) { Flow.name = name; Flow.since = now; },
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
    if (t >= LOOP_T) { Flow.startRun(now, Flow.filmAt != null ? Flow.filmAt + LOOP_T : null); Flow.play(now); return; }
    const f = Math.max(0, Math.floor(t * FPS));
    if (f !== Flow.filmFrame) { renderFrame(f / FPS, CANVAS); Flow.filmFrame = f; }
  },
  // ---- a new run from the seam (after the film, a skip or a retry); musicAt keeps the music on the film's bar line
  startRun(now, musicAt = null) {
    Sound.stopFilm(); Sound.startMusic(musicAt); Sound.engineOn();
    Flow.run = Play.create(Flow.seed(), SEAM_START); Flow.runs++;
    Flow.acc = 0; Flow.last = now; Flow.paused = false;
    Flow.go('play', now);
  },
  play(now) {
    if (!Flow.paused) Flow.advance(now);
    const t0 = performance.now();
    Draw.frame(CANVAS, Flow.run);
    Flow.frameMs.push(performance.now() - t0);
    if (Flow.frameMs.length > FRAME_SAMPLES) Flow.frameMs.shift();
    if (Flow.paused) Hud.overlay(CANVAS, () => Hud.paused());
    if (Flow.run.over && Flow.run.t - Flow.run.overAt >= CFG.gameOver.card) Flow.endRun(now);
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
  endRun(now) { Flow.best = Math.max(Flow.best, Flow.run.score); BestScore.save(Flow.best); Flow.cardB = null; Flow.go('over', now); },
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
    Hud.overlay(CANVAS, () => Hud.card(Flow.run.score, Flow.best, t));
  },
  // ---- one-shot keys per state; steering and firing come from the held keys during play
  keys(now) {
    for (const code of Input.takePressed()) {
      if (Input.is(code, 'mute')) { Sound.setMuted(!Sound.muted); continue; }
      if (Flow.name === 'title') { if (Sound.ready || Sound.failed) Flow.startFilm(now); continue; }
      if (Flow.name === 'film' && Input.is(code, 'skip')) { Flow.startRun(now); continue; }
      if (Flow.name === 'play' && Input.is(code, 'pause')) { Flow.paused = !Flow.paused; Flow.last = now; Sound.pause(Flow.paused); continue; }
      if (Flow.name === 'over' && Input.is(code, 'fire') && Flow.secondsIn(now) >= CFG.gameOver.retryLockout) { Sound.sfx('retry'); Flow.startRun(now); }
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
Flow.best = BestScore.load();
Sound.prepare();
if (IS_TEST) window.GAME = {
  state() {
    const r = Flow.run, ms = [...Flow.frameMs].sort((a, b) => a - b);
    return {
      name: Flow.name, ready: Sound.ready, soundFailed: Sound.failed, paused: Flow.paused, error: Flow.error ? String(Flow.error) : null,
      filmTime: Flow.name === 'film' ? Flow.filmTime(performance.now()) : null, best: Flow.best,
      t: r ? r.t : null, score: r ? r.score : null, shields: r ? r.player.shields : null, x: r ? r.player.x : null, y: r ? r.player.y : null,
      fired: r ? r.fired : null, objects: r ? r.objects.length : null,
      frameMs: { median: ms.length ? ms[Math.floor(ms.length / 2)] : null, worst: ms.length ? ms[ms.length - 1] : null, samples: ms.length },
    };
  },
  hit() { if (Flow.run) Play.forceHit(Flow.run); },
};
requestAnimationFrame((now) => { Flow.go('title', now); Flow.frame(now); });
