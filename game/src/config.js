// =====================================================================
//  CONFIG - every tunable number of the scout run. Positions and sizes are low-res pixels (the 320x180 grid the film
//  draws on), times are seconds, speeds are pixels per second.
// =====================================================================
// The play field is VIEW_K times the film's 320x180 grid in each direction (480x270), drawn with the same sprites, so
// everything in it is smaller on screen and there is more room. Distances and speeds that were tuned on the film's
// grid are scaled by VIEW_K, and spawn intervals divided by it, so a run plays the way it did, in a bigger field.
const VIEW_K = 1.5;
const CFG = {
  view: { from: [320, 180], to: [480, 270], delay: 0.3, dur: 1.2 },   // the camera pulls back from the film's frame to the field, starting delay s into the run
  step: 1 / 60,            // the fixed update step
  maxCatchUp: 0.25,        // after a stall (a hidden tab, a debugger pause) play catches up at most this much
  seam: { startScroll: 18, throttleFrom: 0.35, throttleRamp: 0.75, logType: 1.0, logHold: 3.0, firstSpawn: 2.0, lookBack: 0.5 },
  scout: { minX: 16, maxX: 200 * VIEW_K, minY: 14, maxY: 270 - 14, speed: 110 * VIEW_K, ease: 12, shields: 3, invulnerable: 1.5, blink: 0.1, knockback: 8 },
  hitbox: [{ dx: 0, dy: 0, r: 5 }, { dx: 14, dy: 1, r: 3 }],
  bolt: { speed: 360 * VIEW_K, perSecond: 6, noseDx: 22, noseDy: 1, length: 4, r: 1, goneX: 330 + 160 },
  rocks: {
    small: { r: [3, 4], hp: 1, points: 10 },
    medium: { r: [5, 7], hp: 2, points: 25 },
    large: { r: [8, 11], hp: 3, points: 50, splitsInto: 'medium' },
  },
  rockSpeed: [0.8, 1.2], rockDrift: 10 * VIEW_K, splitDrift: 20 * VIEW_K,
  ice: { r: [8, 16], speed: [0.9, 1.0] },
  comet: { speed: 520 * VIEW_K, maxSlope: 0.1, warn: 1.0, warnX: 468, headR: 3, tail: 110, rowMargin: 6 },
  debris: { count: [6, 10], life: 0.6, speed: [20, 70], blinkFrom: 0.2, sparks: 2 },
  spawn: { x: 500, minY: 14, maxY: 270 - 14 },
  goneX: -40,
  difficulty: { ramp: 120, scroll: [150 * VIEW_K, 300 * VIEW_K], interval: [1.2 / VIEW_K, 0.45 / VIEW_K], iceFrom: 15, cometFrom: 30, ice: 0.3, comet: 0.1 },
  hud: { heatW: 40, heatWarn: 0.7 },   // the heat bar's width, and the heat above which it turns red
  score: { pxPerPoint: 10 * VIEW_K, digits: 6, storageKey: 'scout-ring:best' },
  moon: { every: 60, r: 40, top: 260, depth: 0.6, enterX: 520 },
  gameOver: { scoutDebris: 24, burstLife: 0.8, card: 1.0, retryLockout: 0.6 },   // a fire tap right as the card shows does not skip it
  audioGrace: 0.5,         // how long the film waits for a suspended audio clock before running silently on the wall clock
  mood: { happy: 0.4, wow: 0.6 },
  engine: { cruise: 0.6, steer: 0.15 },   // the engine's drive at cruise pace, and how much steering adds
  pickup: { r: 5, speed: [0.5, 0.7], spinRate: 0.8, ammo: { spread: 24, rocket: 10 }, spawnFrom: 0, share: 0.4 },   // ammo: trigger pulls a pickup weapon lasts
  heat: { perShot: 0.12, cool: 0.35, resumeAt: 0.35 },   // the default gun: heat per shot (0..1), cooling per second, and the heat at which a jammed gun fires again
  rocket: { speed: 200 * VIEW_K, r: 4, length: 7, debrisCount: 12, sparkCount: 6 },
  spread: { vy: 14 * VIEW_K },
  boss: {
    scoreAt: 2000,
    hp: 100, hpStep: 50, r: 14, startY: 135, firstFire: 1.5, shotR: 2,
    enterX: 390, enterSpeed: 90 * VIEW_K,
    trackSpeed: 65 * VIEW_K, trackEase: 4,
    fireRate: [2.2, 1.1], shots: [1, 3], shotSpeed: 135 * VIEW_K, shotSpread: 20, shotLength: 6,
    phaseAt: 0.5,
    points: 300, debrisCount: 28, sparkCount: 14,
  },
};
