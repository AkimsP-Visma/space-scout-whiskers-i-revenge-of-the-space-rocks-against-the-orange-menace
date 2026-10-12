// =====================================================================
//  CONFIG - every tunable number of the scout run. Positions and sizes are low-res pixels (the 320x180 grid the film
//  draws on), times are seconds, speeds are pixels per second.
// =====================================================================
const CFG = {
  step: 1 / 60,            // the fixed update step
  maxCatchUp: 0.25,        // after a stall (a hidden tab, a debugger pause) play catches up at most this much
  seam: { startScroll: 18, throttleFrom: 0.35, throttleRamp: 0.75, logType: 1.0, logHold: 3.0, firstSpawn: 2.0, lookBack: 0.5 },
  scout: { minX: 16, maxX: 200, minY: 14, maxY: 166, speed: 110, ease: 12, shields: 3, invulnerable: 1.5, blink: 0.1, knockback: 8 },
  hitbox: [{ dx: 0, dy: 0, r: 5 }, { dx: 14, dy: 1, r: 3 }],
  bolt: { speed: 360, perSecond: 6, noseDx: 22, noseDy: 1, length: 4, r: 1, goneX: 330 },
  rocks: {
    small: { r: [3, 4], hp: 1, points: 10 },
    medium: { r: [5, 7], hp: 2, points: 25 },
    large: { r: [8, 11], hp: 3, points: 50, splitsInto: 'medium' },
  },
  rockSpeed: [0.8, 1.2], rockDrift: 10, splitDrift: 20,
  ice: { r: [8, 16], speed: [0.9, 1.0] },
  comet: { speed: 520, maxSlope: 0.1, warn: 1.0, warnX: 308, headR: 3, tail: 110, rowMargin: 6 },
  debris: { count: [6, 10], life: 0.6, speed: [20, 70], blinkFrom: 0.2, sparks: 2 },
  spawn: { x: 340, minY: 14, maxY: 166 },
  goneX: -40,
  difficulty: { ramp: 120, scroll: [150, 300], interval: [1.2, 0.45], iceFrom: 15, cometFrom: 30, ice: 0.3, comet: 0.1 },
  score: { pxPerPoint: 10, digits: 6, storageKey: 'scout-ring:best' },
  moon: { every: 60, r: 40, top: 170, depth: 0.6, enterX: 360 },
  gameOver: { scoutDebris: 24, burstLife: 0.8, card: 1.0, retryLockout: 0.6 },   // a fire tap right as the card shows does not skip it
  audioGrace: 0.5,         // how long the film waits for a suspended audio clock before running silently on the wall clock
  mood: { happy: 0.4, wow: 0.6 },
  engine: { cruise: 0.6, steer: 0.15 },   // the engine's drive at cruise pace, and how much steering adds
};
